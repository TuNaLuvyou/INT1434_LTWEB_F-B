'use client';
import { useState, useEffect } from 'react';

export default function MyScheduleClient({ userId }: { userId: string }) {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await fetch(`${API_URL}/api/schedules?userId=${userId}`, { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setSchedules(data.data.schedules);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSchedules();
  }, [userId]);

  if (loading) return <div className="py-10 text-center text-gray-500 font-medium">Đang tải lịch làm việc...</div>;

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ca làm</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Vị trí</th>
            <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Ghi chú</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {schedules.length === 0 ? (
            <tr><td colSpan={4} className="px-6 py-12 text-center text-gray-500">Bạn chưa có lịch làm việc nào được xếp.</td></tr>
          ) : (
            schedules.map(sch => (
              <tr key={sch.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-800">
                    {new Date(sch.date).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                  {sch.shiftStart} <span className="text-gray-400 mx-1">→</span> {sch.shiftEnd}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  <span className="font-medium text-purple-700 bg-purple-50 px-2 py-1 rounded">{sch.position}</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {sch.note || <span className="text-gray-300 italic">Không có</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
