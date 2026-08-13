"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";
import { getAccessTokenFromCookie, setAccessToken } from "@/lib/auth/client";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Tab = "day" | "week" | "month" | "year";
type MethodView = "both" | "transfer" | "cash";

type TrendPoint = {
  bucket: string;
  transfer: number;
  cash: number;
  total: number;
  label: string;
};

const TRANSFER_COLOR = "#a78bfa";
const CASH_COLOR = "#f87171";

const pad2 = (n: number) => String(n).padStart(2, "0");

const toYMD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const getVNDate = (d: Date = new Date()) => {
  const [y, m, dd] = d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).split("-");
  return `${y}-${m}-${dd}`;
};

const fmtVND = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}tr`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${n}`;
};

const weekdayVN = (d: Date) => ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][d.getDay()];

const isoWeek = (d: Date) => {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNum = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - dayNum + 3);
  const firstThursday = new Date(date.getFullYear(), 0, 4);
  const firstDayNum = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDayNum + 3);
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
};

const inputCls =
  "bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-[11px] text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-all font-mono";

export default function RevenueTrendChart() {
  const [tab, setTab] = useState<Tab>("day");
  const [methodView, setMethodView] = useState<MethodView>("both");

  const [dayDate, setDayDate] = useState(getVNDate());
  const [hourFrom, setHourFrom] = useState(8);
  const [hourTo, setHourTo] = useState(23);

  const [weekDate, setWeekDate] = useState(getVNDate());
  const [monthDate, setMonthDate] = useState(() => getVNDate().slice(0, 7));
  const [yearDate, setYearDate] = useState(() => getVNDate().slice(0, 4));
  const monthInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const refreshAccessToken = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${API}/api/auth/refresh`, { method: "POST", credentials: "include" });
      if (res.ok) {
        const d = await res.json();
        setAccessToken(d.data.accessToken);
        return d.data.accessToken;
      }
    } catch {}
    return null;
  };

  const buildRange = (): { from: string; to: string; groupBy: string } => {
    if (tab === "day") {
      return {
        from: new Date(`${dayDate}T${pad2(hourFrom)}:00:00`).toISOString(),
        to: new Date(`${dayDate}T${pad2(hourTo)}:59:59`).toISOString(),
        groupBy: "hour",
      };
    }
    if (tab === "week") {
      const d = new Date(weekDate);
      const dow = (d.getDay() + 6) % 7;
      const monday = new Date(d);
      monday.setDate(d.getDate() - dow);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        from: new Date(`${toYMD(monday)}T00:00:00`).toISOString(),
        to: new Date(`${toYMD(sunday)}T23:59:59`).toISOString(),
        groupBy: "day",
      };
    }
    if (tab === "month") {
      const [y, m] = monthDate.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return {
        from: new Date(`${monthDate}-01T00:00:00`).toISOString(),
        to: new Date(`${monthDate}-${pad2(lastDay)}T23:59:59`).toISOString(),
        groupBy: "week",
      };
    }
    return {
      from: new Date(`${yearDate}-01-01T00:00:00`).toISOString(),
      to: new Date(`${yearDate}-12-31T23:59:59`).toISOString(),
      groupBy: "month",
    };
  };

  const formatBucketLabel = (bucket: string): string => {
    const d = new Date(bucket);
    if (tab === "day") return `${pad2(d.getHours())}:00`;
    if (tab === "week") {
      const ymd = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
      return `${weekdayVN(d)} ${ymd}`;
    }
    if (tab === "month") return `Tuần ${isoWeek(d)}`;
    return `T${d.getMonth() + 1}`;
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    let token = getAccessTokenFromCookie();
    if (!token) token = await refreshAccessToken();
    if (!token) {
      setData([]);
      setLoading(false);
      return;
    }

    const { from, to, groupBy } = buildRange();
    const params = new URLSearchParams({ from, to, groupBy });
    const url = `${API}/api/analytics/revenue-trend?${params.toString()}`;

    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401) {
      const newToken = await refreshAccessToken();
      if (newToken) {
        res = await fetch(url, { headers: { Authorization: `Bearer ${newToken}` } });
      }
    }

    if (!res.ok) {
      setData([]);
      setError(`Không thể tải dữ liệu (${res.status})`);
      setLoading(false);
      return;
    }

    const json = await res.json();
    setData(json.success && Array.isArray(json.data) ? json.data : []);
    setLoading(false);
  }, [tab, dayDate, hourFrom, hourTo, weekDate, monthDate, yearDate]);

  useEffect(() => {
    load();
  }, [load]);

  const points = useMemo(
    () => data.map(d => ({ ...d, label: formatBucketLabel(d.bucket) })),
    [data, tab]
  );

  // ── Chart geometry ──────────────────────────────────────────────
  const W = 760;
  const H = 260;
  const padL = 54;
  const padR = 16;
  const padT = 20;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const showTransfer = methodView !== "cash";
  const showCash = methodView !== "transfer";

  const maxV = Math.max(
    1,
    ...points.flatMap(p => [showTransfer ? p.transfer : 0, showCash ? p.cash : 0])
  );

  const x = (i: number) => (points.length <= 1 ? padL + innerW / 2 : padL + (innerW * i) / (points.length - 1));
  const y = (v: number) => padT + innerH * (1 - v / maxV);

  const smoothPath = (key: "transfer" | "cash") => {
    if (points.length === 0) return "";
    if (points.length === 1) return `M${x(0).toFixed(1)},${y(points[0][key]).toFixed(1)}`;
    const pts = points.map((p, i) => ({ px: x(i), py: y(p[key]) }));
    let d = `M${pts[0].px.toFixed(1)},${pts[0].py.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.px + (p2.px - p0.px) / 6;
      const c1y = p1.py + (p2.py - p0.py) / 6;
      const c2x = p2.px - (p3.px - p1.px) / 6;
      const c2y = p2.py - (p3.py - p1.py) / 6;
      d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.px.toFixed(1)},${p2.py.toFixed(1)}`;
    }
    return d;
  };

  const linePath = smoothPath;

  const areaPath = (key: "transfer" | "cash") =>
    points.length === 0
      ? ""
      : `${smoothPath(key)} L${x(points.length - 1).toFixed(1)},${padT + innerH} L${x(0).toFixed(1)},${padT + innerH} Z`;

  const gridCount = 4;
  const stepX = points.length > 12 ? Math.ceil(points.length / 8) : 1;

  const handleMouseMove = (e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg || points.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = W / rect.width;
    const mx = (e.clientX - rect.left) * scaleX;
    const frac = Math.max(0, Math.min(1, (mx - padL) / innerW));
    const idx = points.length <= 1 ? 0 : Math.round(frac * (points.length - 1));
    setHoverIndex(idx);
  };

  const handleMouseLeave = () => setHoverIndex(null);

  const tabs: { key: Tab; label: string }[] = [
    { key: "day", label: "Ngày" },
    { key: "week", label: "Tuần" },
    { key: "month", label: "Tháng" },
    { key: "year", label: "Năm" },
  ];

  const methodOptions: { key: MethodView; label: string }[] = [
    { key: "both", label: "Cả hai" },
    { key: "transfer", label: "Chuyển khoản" },
    { key: "cash", label: "Tiền mặt" },
  ];

  return (
    <div className="bg-zinc-900/40 border border-zinc-900 rounded-3xl p-4 sm:p-5 shrink-0">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            Xu Hướng Doanh Thu
          </h2>
          <p className="text-[11px] text-zinc-400 font-light mt-0.5">
            Chuyển khoản (tím) · Tiền mặt (đỏ)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {/* Tabs */}
          <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 gap-0.5">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer active:scale-95 ${
                  tab === t.key
                    ? "bg-violet-600/20 text-violet-300 border border-violet-500/30"
                    : "text-zinc-500 hover:text-zinc-200 border border-transparent"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Method selector */}
          <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 p-0.5 gap-0.5">
            {methodOptions.map(m => (
              <button
                key={m.key}
                onClick={() => setMethodView(m.key)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all cursor-pointer active:scale-95 ${
                  methodView === m.key
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters per tab */}
      <div className="flex flex-wrap items-end gap-3 mb-4">
        {tab === "day" && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Ngày</span>
              <input
                type="date"
                value={dayDate}
                max={getVNDate()}
                onChange={e => e.target.value && setDayDate(e.target.value)}
                className={inputCls}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Từ giờ</span>
              <select
                value={hourFrom}
                onChange={e => {
                  const v = Number(e.target.value);
                  setHourFrom(v);
                  if (v > hourTo) setHourTo(v);
                }}
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{pad2(i)}:00</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Đến giờ</span>
              <select
                value={hourTo}
                onChange={e => {
                  const v = Number(e.target.value);
                  setHourTo(v);
                  if (v < hourFrom) setHourFrom(v);
                }}
                className={inputCls}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>{pad2(i)}:00</option>
                ))}
              </select>
            </label>
          </>
        )}

        {tab === "week" && (
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Chọn ngày trong tuần</span>
            <input
              type="date"
              value={weekDate}
              onChange={e => e.target.value && setWeekDate(e.target.value)}
              className={inputCls}
            />
          </label>
        )}

        {tab === "month" && (
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Chọn tháng</span>
            <div className="relative flex items-center">
              <button
                type="button"
                onClick={() => monthInputRef.current?.showPicker()}
                className={`${inputCls} w-44 text-left cursor-pointer`}
              >
                {(() => {
                  const [y, m] = monthDate.split("-").map(Number);
                  return `Tháng ${m} ${y}`;
                })()}
              </button>
              <input
                ref={monthInputRef}
                type="month"
                value={monthDate}
                onChange={e => e.target.value && setMonthDate(e.target.value)}
                className="absolute w-0 h-0 opacity-0 pointer-events-none"
              />
            </div>
          </label>
        )}

        {tab === "year" && (
          <label className="flex flex-col gap-1">
            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Chọn năm</span>
            <input
              type="number"
              min={2000}
              max={2100}
              value={yearDate}
              onChange={e => e.target.value && setYearDate(e.target.value)}
              className={inputCls}
            />
          </label>
        )}
      </div>

      {/* Chart */}
      <div className="relative w-full aspect-[760/260]">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900/40 backdrop-blur-sm rounded-2xl transition-all">
            <Loader2 className="h-8 w-8 text-violet-500 animate-spin" />
          </div>
        )}
        
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-rose-400">{error}</div>
        ) : points.length === 0 && !loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-zinc-500">
            Chưa có dữ liệu doanh thu trong khoảng thời gian đã chọn.
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 w-full h-full cursor-crosshair select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Grid + Y axis */}
            {Array.from({ length: gridCount + 1 }, (_, i) => {
              const gv = (maxV * i) / gridCount;
              const gy = y(gv);
              return (
                <g key={i}>
                  <line x1={padL} y1={gy} x2={W - padR} y2={gy} stroke="#27272a" strokeWidth="1" />
                  <text x={padL - 8} y={gy + 3} textAnchor="end" fill="#71717a" fontSize="10" fontFamily="monospace">
                    {fmtCompact(gv)}
                  </text>
                </g>
              );
            })}

            {/* Gradients */}
            <defs>
              <linearGradient id="gradTransfer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={TRANSFER_COLOR} stopOpacity="0.35" />
                <stop offset="100%" stopColor={TRANSFER_COLOR} stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradCash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CASH_COLOR} stopOpacity="0.35" />
                <stop offset="100%" stopColor={CASH_COLOR} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Areas */}
            {showTransfer && points.length > 1 && (
              <path d={areaPath("transfer")} fill="url(#gradTransfer)" stroke="none" />
            )}
            {showCash && points.length > 1 && (
              <path d={areaPath("cash")} fill="url(#gradCash)" stroke="none" />
            )}

            {/* Lines */}
            {showTransfer && points.length > 1 && (
              <path
                d={linePath("transfer")}
                fill="none"
                stroke={TRANSFER_COLOR}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
            {showCash && points.length > 1 && (
              <path
                d={linePath("cash")}
                fill="none"
                stroke={CASH_COLOR}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            )}

            {/* Points */}
            {points.map((p, i) => (
              <g key={i}>
                {showTransfer && (
                  <circle
                    cx={x(i)} cy={y(p.transfer)} r="3"
                    fill={TRANSFER_COLOR}
                    stroke="#09090b" strokeWidth="1.5"
                    opacity={p.transfer > 0 ? 1 : 0.35}
                  />
                )}
                {showCash && (
                  <circle
                    cx={x(i)} cy={y(p.cash)} r="3"
                    fill={CASH_COLOR}
                    stroke="#09090b" strokeWidth="1.5"
                    opacity={p.cash > 0 ? 1 : 0.35}
                  />
                )}
              </g>
            ))}

            {/* X labels */}
            {points.map((p, i) =>
              i % stepX === 0 || i === points.length - 1 ? (
                <text
                  key={`x-${i}`}
                  x={x(i)} y={H - 10}
                  textAnchor="middle"
                  fill="#71717a"
                  fontSize="10"
                  fontFamily="monospace"
                >
                  {p.label}
                </text>
              ) : null
            )}

            {/* Hover guide + tooltip */}
            {hoverIndex != null && points[hoverIndex] && (
              <g>
                <line
                  x1={x(hoverIndex)} y1={padT} x2={x(hoverIndex)} y2={padT + innerH}
                  stroke="#a1a1aa" strokeWidth="1" strokeDasharray="4 4" opacity="0.6"
                />
              </g>
            )}
          </svg>
        )}

        {/* HTML tooltip — bám theo điểm hover */}
        {hoverIndex != null && points[hoverIndex] && !loading && (() => {
          const p = points[hoverIndex];
          let peak = 0;
          if (showTransfer) peak = Math.max(peak, p.transfer);
          if (showCash) peak = Math.max(peak, p.cash);
          const left = (x(hoverIndex) / W) * 100;
          const top = (y(peak) / H) * 100;
          return <TooltipBox p={p} left={left} top={top} />;
        })()}
      </div>
    </div>
  );
}

function TooltipBox({ p, left, top }: { p: TrendPoint; left: number; top: number }) {
  const translateX = left < 18 ? "0%" : left > 82 ? "-100%" : "-50%";
  return (
    <div
      className="pointer-events-none absolute z-20 bg-zinc-950/95 border border-zinc-700 rounded-xl px-3 py-2 shadow-2xl text-[11px] font-mono space-y-1 whitespace-nowrap"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        transform: `translate(${translateX}, calc(-100% - 10px))`,
      }}
    >
      <div className="font-bold text-zinc-200 text-[10px] uppercase tracking-wider">{p.label}</div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: TRANSFER_COLOR }} />
        <span className="text-zinc-400">Chuyển khoản</span>
        <span className="ml-auto font-bold" style={{ color: TRANSFER_COLOR }}>{fmtVND(p.transfer)}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: CASH_COLOR }} />
        <span className="text-zinc-400">Tiền mặt</span>
        <span className="ml-auto font-bold" style={{ color: CASH_COLOR }}>{fmtVND(p.cash)}</span>
      </div>
    </div>
  );
}
