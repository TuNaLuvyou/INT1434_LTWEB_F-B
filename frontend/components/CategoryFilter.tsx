'use client';

/**
 * CategoryFilter — Bộ lọc danh mục món ăn dạng thanh cuộn ngang thông minh.
 *
 * Tính năng chính:
 *   - Bám dính sát trên cùng (sticky top-0) với màu nền trắng mờ 80% (backdrop-blur).
 *   - Cuộn ngang mượt mà trên mobile, tự động ẩn thanh cuộn (scrollbar-hide).
 *   - Tự động căn giữa các tab danh mục trên màn hình desktop (không cuộn).
 *   - Tự động cuộn tab active ra chính giữa màn hình (Auto scroll-into-view) để tối ưu trải nghiệm.
 *
 * Khả năng tiếp cận (Accessibility):
 *   - role="tablist" trên thẻ cha.
 *   - role="tab" và aria-selected trên từng nút chọn.
 *   - aria-label rõ ràng cho việc lọc thực đơn.
 */

import { useEffect, useRef } from 'react';

type Category = {
  id: string;
  name: string;
  slug: string;
};

type CategoryFilterProps = {
  categories: Category[];
  activeId: string | null;
  onChange: (categoryId: string | null) => void;
};

export default function CategoryFilter({
  categories,
  activeId,
  onChange,
}: CategoryFilterProps) {
  // Tạo danh sách đầy đủ với tab "Tất cả" luôn đứng đầu
  const allTabs = [{ id: null, name: 'Tất cả', slug: 'all' }, ...categories];
  
  // Ref quản lý khung cuộn để hỗ trợ tính năng auto center tab active
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Hiệu ứng tự động cuộn tab active vào trung tâm khung nhìn khi thay đổi danh mục
  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeElement = scrollContainerRef.current.querySelector(
        '[aria-selected="true"]'
      ) as HTMLElement;
      
      if (activeElement) {
        // Tính toán khoảng cách cuộn để đưa tab active vào chính giữa thanh trượt
        const container = scrollContainerRef.current;
        const containerWidth = container.clientWidth;
        const elementOffsetLeft = activeElement.offsetLeft;
        const elementWidth = activeElement.clientWidth;
        
        // Vị trí cuộn mong muốn để căn giữa
        const targetScrollLeft = elementOffsetLeft - containerWidth / 2 + elementWidth / 2;
        
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        });
      }
    }
  }, [activeId]);

  return (
    <nav
      aria-label="Lọc món ăn theo danh mục"
      className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100/80 shadow-2xs"
    >
      <div
        ref={scrollContainerRef}
        role="tablist"
        aria-orientation="horizontal"
        className="
          flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5
          overflow-x-auto scroll-smooth scrollbar-hide
          sm:justify-center sm:overflow-x-visible
        "
      >
        {allTabs.map((tab) => {
          const isActive = tab.id === activeId;
          return (
            <button
              key={tab.id ?? 'all'}
              role="tab"
              aria-selected={isActive}
              aria-controls={tab.id ? `category-${tab.slug}` : undefined}
              onClick={() => onChange(tab.id)}
              className={`
                flex-shrink-0 px-3 py-1.5 sm:px-4 rounded-full text-xs sm:text-sm font-medium
                border transition-all duration-200 focus-visible:outline-none
                cursor-pointer select-none
                ${isActive
                  ? 'text-white shadow-md'
                  : 'bg-gray-50 text-gray-600 border-gray-200/70'
                }
              `}
              style={
                isActive
                  ? {
                      background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                      borderColor: 'transparent',
                      boxShadow: '0 4px 6px -1px color-mix(in srgb, var(--color-primary) 50%, transparent)',
                    }
                  : {}
              }
            >
              {tab.name}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
