'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Menu Display Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-sm border max-w-md w-full text-center space-y-4">
        <h2 className="text-2xl font-bold text-red-600">Đã xảy ra lỗi!</h2>
        <p className="text-gray-600">
          Không thể tải thực đơn lúc này hoặc bàn không tồn tại. Vui lòng thử lại sau.
        </p>
        <button
          onClick={() => reset()}
          className="px-6 py-2 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-colors shadow-sm"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
