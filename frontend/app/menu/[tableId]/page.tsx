import Image from 'next/image';
import { notFound } from 'next/navigation';

export const revalidate = 300; // ISR: Cache 5 phút

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

// TẠI SAO DÙNG SSG + ISR (revalidate = 300) THAY VÌ SSR?
// 1. Menu nhà hàng hiếm khi thay đổi liên tục từng giây (thường thay đổi theo ngày/tuần).
//    Nếu dùng SSR, mỗi lần user quét QR code server phải tính toán lại và query DB từ đầu -> tăng tải server vô ích, thời gian load trang chậm.
// 2. Dùng SSG (Static Site Generation), trang được render sẵn thành file HTML siêu nhẹ lúc build. User tải trang "nhanh như chớp" (Zero delay).
// 3. Kết hợp ISR (revalidate = 300), cứ mỗi 5 phút, Next.js sẽ âm thầm fetch data mới ở background nếu có yêu cầu truy cập. 
//    Nhờ vậy, data luôn được cập nhật mà không bắt người dùng nào phải chờ đợi.

interface Table {
  id: string;
  tableNumber: number;
  label: string;
  status: string;
}

interface CategoryInfo {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: string;
  imageUrl: string | null;
  categoryId: string;
  isSoldOut: boolean;
  isActive: boolean;
}

interface MenuData {
  categories: CategoryInfo[];
  items: MenuItem[];
}

interface PageProps {
  params: Promise<{
    tableId: string;
  }>;
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${API_URL}/api/tables`);
    if (!res.ok) return [];
    
    const result = await res.json();
    if (!result.success || !result.data) return [];
    
    // Trả về danh sách params cho các bàn đang active (hoặc tất cả)
    return result.data.map((table: Table) => ({
      tableId: table.id,
    }));
  } catch (error) {
    console.error('[Menu API] Lỗi khi fetch tables trong generateStaticParams:', error);
    return []; // Trả về mảng rỗng để không cản trở quá trình build
  }
}

export async function generateMetadata({ params }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId || '';
  
  return {
    title: `Menu - Bàn ${tableId.substring(0, 4)} | RestoFlow`,
    description: 'Thực đơn món ăn tại RestoFlow',
  };
}

export default async function MenuPage({ params }: PageProps) {
  const resolvedParams = await params;
  const tableId = resolvedParams?.tableId;

  // Validate tableId (Nếu API hỗ trợ check table, bạn có thể gọi API ở đây. Nếu không tìm thấy gọi notFound())
  if (!tableId) {
    return notFound();
  }

  // Fetch dữ liệu menu từ backend Express
  const res = await fetch(`${API_URL}/api/menu`);
  
  if (!res.ok) {
    return notFound();
  }

  const result = await res.json();
  if (!result.success || !result.data) {
    return notFound();
  }

  const { categories, items }: MenuData = result.data;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header Sticky */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 text-center">
          <h1 className="text-2xl font-extrabold text-gray-850 bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">
            Thực đơn RestoFlow
          </h1>
          <p className="text-xs text-gray-400 mt-1 font-medium bg-gray-100 inline-block px-3 py-1 rounded-full">
            Mã Bàn: {tableId}
          </p>
        </div>

        {/* Tab Danh mục (Horizontal Scroll & centered on larger screens) */}
        <div className="border-t bg-white">
          <div className="max-w-6xl mx-auto px-4 py-3 flex overflow-x-auto gap-3 scrollbar-hide md:justify-center scroll-smooth">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`#category-${cat.id}`}
                className="flex-shrink-0 px-5 py-2 bg-gray-50 text-gray-600 rounded-full text-xs font-bold hover:bg-orange-500 hover:text-white transition-all shadow-sm border border-gray-100"
              >
                {cat.name}
              </a>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-12">
        {categories.map((cat) => {
          const catItems = items.filter((item) => item.categoryId === cat.id);
          
          if (catItems.length === 0) return null;

          return (
            <section key={cat.id} id={`category-${cat.id}`} className="scroll-mt-36">
              {/* Centered Category Heading with beautiful gradient lines */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="h-[2px] bg-gradient-to-r from-transparent to-orange-400 w-12 md:w-20" />
                <h2 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-wide text-center">
                  {cat.name}
                </h2>
                <div className="h-[2px] bg-gradient-to-l from-transparent to-orange-400 w-12 md:w-20" />
              </div>
              
              {/* Flex wrapper for centering food cards */}
              <div className="flex flex-wrap justify-center gap-6">
                {catItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`flex gap-4.5 p-4 bg-white rounded-xl shadow-sm border border-gray-100 transition-all w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.33%-16px)] max-w-sm shrink-0 ${
                      item.isSoldOut ? 'opacity-50 pointer-events-none' : 'hover:border-orange-100 hover:shadow-md hover:-translate-y-0.5'
                    }`}
                  >
                    {/* Hình ảnh */}
                    <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-100">
                      <Image
                        src={item.imageUrl || '/placeholder-food.svg'}
                        alt={item.name}
                        fill
                        className="object-cover"
                        priority={idx === 0}
                      />
                    </div>

                    {/* Thông tin món */}
                    <div className="flex flex-col flex-grow justify-between py-0.5">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h3 className="text-sm font-extrabold text-gray-800 line-clamp-2 leading-snug">
                            {item.name}
                          </h3>
                          {item.isSoldOut && (
                            <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-0.5 rounded-md whitespace-nowrap border border-red-100">
                              Hết món
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] text-gray-400 line-clamp-2 mt-1 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-2">
                        <span className="text-base font-black text-orange-600">
                          {new Intl.NumberFormat('vi-VN', {
                            style: 'currency',
                            currency: 'VND',
                          }).format(Number(item.price))}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </main>
    </div>
  );
}
