'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CheckInClient({ user }: { user: any }) {
  const [attendance, setAttendance] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const router = useRouter();

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchToday();
  }, []);

  const fetchToday = async () => {
    try {
      const res = await fetch(`${API_URL}/api/attendance/today`, {
        credentials: 'include', 
      });
      if (res.ok) {
        const data = await res.json();
        setAttendance(data.data.attendance);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    const token = localStorage.getItem('deviceToken');
    if (!token) {
      setErrorModal('Thiết bị chưa đăng ký. Liên hệ Admin để đăng ký thiết bị này.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': token
        },
        credentials: 'include', 
      });
      const data = await res.json();
      
      if (res.ok) {
        setAttendance(data.data.attendance);
        alert(`Check-in thành công lúc ${new Date(data.data.attendance.checkInAt).toLocaleTimeString()}`);
        router.refresh();
      } else {
        if (data.code === 'INVALID_DEVICE' || data.code === 'NO_DEVICE_TOKEN') {
          setErrorModal('Thiết bị không hợp lệ. Vui lòng liên hệ Admin.');
        } else {
          alert(data.message || 'Lỗi check-in');
        }
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckOut = async () => {
    const token = localStorage.getItem('deviceToken');
    if (!token) {
      setErrorModal('Thiết bị chưa đăng ký. Liên hệ Admin để đăng ký thiết bị này.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/attendance/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': token
        },
        credentials: 'include',
      });
      const data = await res.json();
      
      if (res.ok) {
        setAttendance(data.data.attendance);
        alert(`Check-out thành công! Tổng thời gian làm: ${data.data.attendance.duration}`);
      } else {
        alert(data.message || 'Lỗi check-out');
      }
    } catch (error) {
      alert('Lỗi kết nối');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <div className="text-center py-10">Đang tải...</div>;

  return (
    <div className="space-y-6">
      {errorModal && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl relative">
          <strong className="font-bold">Lỗi: </strong>
          <span className="block sm:inline">{errorModal}</span>
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setErrorModal(null)}>
            ×
          </button>
        </div>
      )}

      {!attendance ? (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">👋</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Xin chào, {user.userId}</h2>
          <p className="text-gray-500 mb-6">Bạn chưa check-in ca làm việc hôm nay.</p>
          <button 
            onClick={handleCheckIn}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Check-in Ngay
          </button>
        </div>
      ) : !attendance.checkOutAt ? (
        <div className="bg-green-50 p-8 rounded-2xl shadow-sm border border-green-100 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">⏳</div>
          <h2 className="text-xl font-bold text-green-800 mb-2">Đang trong ca làm</h2>
          <p className="text-green-600 mb-6">
            Check-in lúc: {new Date(attendance.checkInAt).toLocaleTimeString()}
          </p>
          <button 
            onClick={handleCheckOut}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 px-4 rounded-xl transition-colors"
          >
            Check-out Kết thúc ca
          </button>
        </div>
      ) : (
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✅</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Đã hoàn thành ca làm</h2>
          <p className="text-gray-500">
            Check-in: {new Date(attendance.checkInAt).toLocaleTimeString()}<br/>
            Check-out: {new Date(attendance.checkOutAt).toLocaleTimeString()}
          </p>
          {attendance.duration && (
            <p className="mt-4 font-semibold text-blue-600 bg-blue-50 py-2 rounded-lg">
              Thời gian: {attendance.duration}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
