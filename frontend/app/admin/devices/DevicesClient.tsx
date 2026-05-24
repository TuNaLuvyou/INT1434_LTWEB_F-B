'use client';

import { useState, useEffect } from 'react';

export default function DevicesClient() {
  const [devices, setDevices] = useState<any[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({ userId: '', label: '' });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${API_URL}/api/devices`, { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setDevices(data.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_URL}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setNewToken(data.data.device.token);
        setFormData({ userId: '', label: '' });
        fetchDevices();
      } else {
        alert(data.message);
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const handleRevoke = async (id: string, label: string) => {
    if (!confirm(`Bạn có chắc chắn muốn thu hồi thiết bị "${label}"?`)) return;
    try {
      const res = await fetch(`${API_URL}/api/devices/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (res.ok) {
        fetchDevices();
      } else {
        alert('Lỗi khi thu hồi');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    }
  };

  const copyToken = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      alert('Đã copy token vào clipboard!');
    }
  };

  if (isLoading) return <div className="py-10 text-center">Đang tải...</div>;

  return (
    <div className="space-y-8">
      {newToken && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md shadow-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-yellow-400 text-2xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Đăng ký thiết bị thành công!</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Sao chép token này ngay — sẽ KHÔNG hiển thị lại nữa.</p>
                <code className="block mt-2 bg-yellow-100 p-2 rounded break-all">{newToken}</code>
              </div>
              <div className="mt-4">
                <button
                  onClick={copyToken}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
                >
                  Copy token
                </button>
                <button
                  onClick={() => setNewToken(null)}
                  className="ml-3 text-yellow-800 hover:text-yellow-900 underline text-sm"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold mb-4">Đăng ký thiết bị mới</h2>
        <form onSubmit={handleRegister} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
            <input
              type="text"
              required
              value={formData.userId}
              onChange={e => setFormData({ ...formData, userId: e.target.value })}
              className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
              placeholder="Nhập User ID..."
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên thiết bị (Label)</label>
            <input
              type="text"
              required
              value={formData.label}
              onChange={e => setFormData({ ...formData, label: e.target.value })}
              className="w-full border-gray-300 rounded-md shadow-sm p-2 border"
              placeholder="VD: iPad quầy thu ngân"
            />
          </div>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-md">
            Đăng ký
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Thiết bị</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Người dùng</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sử dụng lần cuối</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Thao tác</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {devices.map(device => (
              <tr key={device.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{device.label}</div>
                  <div className="text-xs text-gray-500">ID: {device.id.substring(0,8)}...</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{device.user.name}</div>
                  <div className="text-xs text-gray-500">{device.user.role}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {device.lastUsed ? new Date(device.lastUsed).toLocaleString() : 'Chưa sử dụng'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleRevoke(device.id, device.label)}
                    className="text-red-600 hover:text-red-900"
                  >
                    Thu hồi
                  </button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                  Chưa có thiết bị nào được đăng ký
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
