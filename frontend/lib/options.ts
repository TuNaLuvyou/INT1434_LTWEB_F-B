/**
 * options.ts — Shared utility cho Sugar/Ice option helpers
 *
 * Được tách ra từ OptionManagerModal.tsx (đã xóa) để tránh phụ thuộc
 * vào component modal khi chỉ cần các hàm getStored helper.
 */

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_SUGAR_OPTIONS = [
  "100% đường",
  "70% đường",
  "50% đường",
  "30% đường",
  "Không đường",
];

const DEFAULT_ICE_OPTIONS = [
  "100% đá",
  "70% đá",
  "50% đá",
  "Ít đá",
  "Không đá",
  "Đá riêng",
];

// ─── Storage keys ─────────────────────────────────────────────────────────────

const STORAGE_KEY_SUGAR = "hiai_custom_sugar";
const STORAGE_KEY_ICE = "hiai_custom_ice";

// ─── Sugar helpers ────────────────────────────────────────────────────────────

export function getStoredSugar(): string[] {
  if (typeof window === "undefined") return DEFAULT_SUGAR_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SUGAR);
    if (!raw) return DEFAULT_SUGAR_OPTIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((s: any) => (typeof s === "string" ? s : s.name)).filter(Boolean);
    }
    return DEFAULT_SUGAR_OPTIONS;
  } catch {
    return DEFAULT_SUGAR_OPTIONS;
  }
}

function saveStoredSugar(sugarList: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_SUGAR, JSON.stringify(sugarList));
  window.dispatchEvent(new Event("options_updated"));
}

// ─── Ice helpers ──────────────────────────────────────────────────────────────

export function getStoredIce(): string[] {
  if (typeof window === "undefined") return DEFAULT_ICE_OPTIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ICE);
    if (!raw) return DEFAULT_ICE_OPTIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((i: any) => (typeof i === "string" ? i : i.name)).filter(Boolean);
    }
    return DEFAULT_ICE_OPTIONS;
  } catch {
    return DEFAULT_ICE_OPTIONS;
  }
}

function saveStoredIce(iceList: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY_ICE, JSON.stringify(iceList));
  window.dispatchEvent(new Event("options_updated"));
}
