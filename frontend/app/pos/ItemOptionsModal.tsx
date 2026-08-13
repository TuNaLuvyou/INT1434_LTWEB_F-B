"use client";

import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Plus, 
  Minus, 
  SlidersHorizontal, 
  CheckSquare, 
  Square,
  Scaling
} from "lucide-react";
import { getStoredSugar, getStoredIce } from "@/lib/options";
import { getStoredSizes, OptionItem } from "@/components/ToppingManagerModal";

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category?: any;
  bgColor?: string;
  emoji?: string;
  description?: string;
  imageUrl?: string | null;
  isSoldOut?: boolean;
  hasSizes?: boolean;
}

interface ItemOptions {
  selectedSize?: OptionItem | null;
  sugar?: string;
  ice?: string;
  toppings: string[];
  note?: string;
  quantity: number;
  selectedModifiers?: any;
  itemDiscountType?: 'PERCENT' | 'FIXED' | null;
  itemDiscountValue?: number;
  isDrink?: boolean;
}

interface ItemOptionsModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  modifiers?: any[];
  onClose: () => void;
  onAddToCart: (item: MenuItem, options: ItemOptions) => void;
}

export default function ItemOptionsModal({ 
  isOpen, 
  item, 
  modifiers = [],
  onClose, 
  onAddToCart 
}: ItemOptionsModalProps) {
  const [sugarList, setSugarList] = useState<string[]>([]);
  const [iceList, setIceList] = useState<string[]>([]);
  const [sizeList, setSizeList] = useState<OptionItem[]>([]);

  useEffect(() => {
    const loadDynamicOptions = () => {
      setSugarList(getStoredSugar());
      setIceList(getStoredIce());
      setSizeList(getStoredSizes().filter(s => s.isActive));
    };
    loadDynamicOptions();
    window.addEventListener("options_updated", loadDynamicOptions);
    return () => window.removeEventListener("options_updated", loadDynamicOptions);
  }, []);

  const [options, setOptions] = useState<ItemOptions>({ 
    selectedSize: null,
    sugar: "",
    ice: "",
    toppings: [], 
    note: "", 
    quantity: 1,
    selectedModifiers: {},
    itemDiscountType: null,
    itemDiscountValue: 0,
  });

  // Multi select groups (e.g. Topping)
  const multiSelectGroups = useMemo(() => {
    const groups = modifiers.filter(m => m.type === 'MULTI_SELECT' && !m.modifierGroupId);
    if (groups.length > 0) return groups;
    const hasMultiOptions = modifiers.some(m => m.type === 'MULTI_SELECT' && m.modifierGroupId);
    if (hasMultiOptions) {
      return [{ id: 'group-topping', name: 'Thêm Topping', type: 'MULTI_SELECT' }];
    }
    return [];
  }, [modifiers]);

  const getGroupOptions = (group: any) => {
    const directOptions = modifiers.filter(m => m.modifierGroupId === group.id && m.isActive !== false);
    if (directOptions.length > 0) return directOptions;
    return modifiers.filter(m => m.type === group.type && m.modifierGroupId && m.isActive !== false);
  };

  // Check if item is a drink based on category or item name
  const isDrink = useMemo(() => {
    if (!item) return false;
    const name = String(item.name || "").toLowerCase();
    const catRaw = item.category || (item as any).categoryName || (item as any).categorySlug || "";
    const cat = (typeof catRaw === "string" ? catRaw : String((catRaw as any)?.name || "")).toLowerCase();
    const drinkKeywords = [
      "uống", "trà", "cà phê", "coffee", "tea", "sinh tố", "nước", 
      "sữa", "soda", "nước ngọt", "juice", "smoothie", "latte", 
      "espresso", "matcha", "boba", "đồ uống", "cocktail", "bia"
    ];
    return drinkKeywords.some((k) => name.includes(k) || cat.includes(k));
  }, [item]);

  const basePrice = Number(item?.price || 0);

  const selectedSizePrice = (isDrink && options.selectedSize) ? Number(options.selectedSize.priceAdjustment || 0) : 0;

  const selectedToppingsPrice = isDrink ? options.toppings.reduce((sum, toppingName) => {
    const topping = modifiers.find(m => m.name === toppingName && m.type === 'MULTI_SELECT');
    return sum + (topping ? Number(topping.priceAdjustment || 0) : 0);
  }, 0) : 0;

  const priceBeforeDiscount = basePrice + selectedSizePrice + selectedToppingsPrice;

  const itemDiscountAmount = useMemo(() => {
    if (!options.itemDiscountType || !options.itemDiscountValue || options.itemDiscountValue <= 0) return 0;
    if (options.itemDiscountType === 'PERCENT') {
      return Math.round(priceBeforeDiscount * Math.min(options.itemDiscountValue, 100) / 100);
    }
    return Math.min(options.itemDiscountValue, priceBeforeDiscount);
  }, [options.itemDiscountType, options.itemDiscountValue, priceBeforeDiscount]);

  const finalUnitPrice = priceBeforeDiscount - itemDiscountAmount;

  useEffect(() => {
    if (item) {
      const s = getStoredSugar();
      const i = getStoredIce();
      const activeSizes = getStoredSizes().filter(sz => sz.isActive);
      setOptions({
        selectedSize: isDrink && activeSizes.length > 0 ? activeSizes[0] : null,
        sugar: isDrink && s.length > 0 ? s[0] : "",
        ice: isDrink && i.length > 0 ? i[0] : "",
        toppings: [],
        note: "",
        quantity: 1,
        selectedModifiers: {},
        itemDiscountType: null,
        itemDiscountValue: 0,
      });
    }
  }, [item, modifiers, isDrink]);

  if (!isOpen || !item) return null;

  const handleToppingToggle = (toppingName: string) => {
    setOptions(prev => ({
      ...prev,
      toppings: prev.toppings.includes(toppingName)
        ? prev.toppings.filter(t => t !== toppingName)
        : [...prev.toppings, toppingName]
    }));
  };

  const handleQuantityChange = (delta: number) => {
    setOptions(prev => ({
      ...prev,
      quantity: Math.max(1, prev.quantity + delta)
    }));
  };

  const handleAddToCart = () => {
    const selectedModifiers: Record<string, any[]> = {};

    if (isDrink) {
      if (options.selectedSize) {
        selectedModifiers["Kích thước"] = [{ name: options.selectedSize.name, price: Number(options.selectedSize.priceAdjustment || 0) }];
      }
      if (options.sugar) {
        selectedModifiers["Đường"] = [{ name: options.sugar, price: 0 }];
      }
      if (options.ice) {
        selectedModifiers["Đá"] = [{ name: options.ice, price: 0 }];
      }

      modifiers.forEach(group => {
        if (group.type === 'MULTI_SELECT') {
          const groupSelections: any[] = [];
          options.toppings.forEach(toppingName => {
            const topping = modifiers.find(m => m.name === toppingName && m.type === 'MULTI_SELECT');
            if (topping) {
              groupSelections.push({ name: toppingName, price: Number(topping.priceAdjustment || 0) });
            }
          });
          if (groupSelections.length > 0) {
            selectedModifiers[group.name || 'Modifier'] = groupSelections;
          }
        }
      });
    }

    const itemWithOptions = {
      ...item,
      name: (isDrink && options.selectedSize) ? `${item.name} (${options.selectedSize.name})` : item.name,
      price: finalUnitPrice,
      selectedModifiers,
      itemDiscountType: options.itemDiscountType || null,
      itemDiscountValue: options.itemDiscountValue || 0,
    };

    onAddToCart(itemWithOptions, { ...options, isDrink });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-zinc-950 animate-in fade-in duration-200">
      <div 
        onClick={(e) => e.stopPropagation()}
        className="w-full h-full max-w-none bg-zinc-900 border-none rounded-none shadow-none flex flex-col overflow-hidden text-zinc-100"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-950/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
              <SlidersHorizontal size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-black text-zinc-100">Tuỳ chọn</h3>
                <span className="text-[10px] font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  POS Panel
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800/80 transition-all active:scale-95 cursor-pointer"
            title="Đóng"
          >
            <X size={22} />
          </button>
        </div>

        {/* Main Form Content (2 Column Layout) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* LEFT PANEL: All Customization Options Form (Scrollable) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 border-b lg:border-b-0 lg:border-r border-zinc-800/80 bg-zinc-900/60">
            
            {/* 1. Size Selection Section (CHỈ HIỂN THỊ KHI LÀ ĐỒ UỐNG) */}
            {isDrink && sizeList.length > 0 && item.hasSizes !== false && (
              <div className="space-y-3 bg-zinc-950/40 border border-zinc-800/60 p-5 rounded-2xl">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <Scaling size={18} className="text-blue-400" />
                    <h4 className="font-bold text-zinc-100 text-base">Kích Thước (Size)</h4>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                    {options.selectedSize ? options.selectedSize.name : "Mặc định"}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {sizeList.map(sizeOpt => {
                    const isSelected = options.selectedSize?.id === sizeOpt.id;
                    const adjPrice = Number(sizeOpt.priceAdjustment || 0);
                    return (
                      <button
                        key={sizeOpt.id}
                        type="button"
                        onClick={() => setOptions(prev => ({ ...prev, selectedSize: sizeOpt }))}
                        className={`p-3.5 rounded-xl border text-left font-bold text-xs transition-all cursor-pointer flex flex-col justify-between min-h-[70px] ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/15 text-blue-200 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/40'
                            : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <span className="text-sm font-extrabold">{sizeOpt.name}</span>
                        <span className={`text-xs font-bold mt-1 ${isSelected ? 'text-blue-300' : 'text-zinc-500'}`}>
                          +{adjPrice.toLocaleString('vi-VN')} VND
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2 & 3. Sugar & Ice Selection (CHỈ HIỂN THỊ KHI LÀ ĐỒ UỐNG) */}
            {isDrink && item.hasSizes !== false && (
              <>
                <div className="space-y-3 bg-zinc-950/40 border border-zinc-800/60 p-5 rounded-2xl">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h4 className="font-bold text-zinc-100 text-base">Đường</h4>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      {options.sugar || "100% đường"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {sugarList.map(sugarOpt => {
                      const isSelected = options.sugar === sugarOpt;
                      return (
                        <button
                          key={sugarOpt}
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, sugar: sugarOpt }))}
                          className={`py-3 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/15 text-blue-200 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/40'
                              : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          {sugarOpt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-3 bg-zinc-950/40 border border-zinc-800/60 p-5 rounded-2xl">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h4 className="font-bold text-zinc-100 text-base">Đá</h4>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      {options.ice || (iceList.length > 0 ? iceList[0] : "100% đá")}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
                    {iceList.map(iceOpt => {
                      const isSelected = options.ice === iceOpt;
                      return (
                        <button
                          key={iceOpt}
                          type="button"
                          onClick={() => setOptions(prev => ({ ...prev, ice: iceOpt }))}
                          className={`py-3 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/15 text-blue-200 shadow-md shadow-blue-500/10 ring-2 ring-blue-500/40'
                              : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          {iceOpt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* 4. Topping Options Section (CHỈ HIỂN THỊ KHI LÀ ĐỒ UỐNG) */}
            {isDrink && item.hasSizes !== false && multiSelectGroups.map(group => {
              const groupOpts = getGroupOptions(group);
              return (
                <div key={group.id} className="space-y-4 bg-zinc-950/40 border border-zinc-800/60 p-5 rounded-2xl">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/40">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                      <h4 className="font-bold text-zinc-100 text-base">{group.name}</h4>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300">
                      Tùy chọn chọn nhiều ({options.toppings.length} đã chọn)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                    {groupOpts.map(option => {
                      const isSelected = options.toppings.includes(option.name);
                      const adjPrice = Number(option.priceAdjustment || 0);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => handleToppingToggle(option.name)}
                          className={`flex flex-col justify-between p-4 rounded-2xl border text-left transition-all cursor-pointer min-h-[90px] ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10 text-blue-200 shadow-lg shadow-blue-500/10 ring-2 ring-blue-500/50'
                              : 'border-zinc-800 bg-zinc-900/80 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800/60'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full mb-2">
                            <span className="font-bold text-base">{option.name}</span>
                            {isSelected ? (
                              <CheckSquare size={22} className="text-blue-400 shrink-0" />
                            ) : (
                              <Square size={22} className="text-zinc-600 shrink-0" />
                            )}
                          </div>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-xl w-fit border ${
                            isSelected 
                              ? 'bg-blue-500/20 border-blue-400/40 text-blue-300' 
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}>
                            +{adjPrice.toLocaleString('vi-VN')} VND
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* 5. Note Section */}
            <div className="space-y-4 bg-zinc-950/40 border border-zinc-800/60 p-5 rounded-2xl">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/40">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <h4 className="font-bold text-zinc-100 text-base">Ghi chú</h4>
              </div>

              <textarea
                value={options.note}
                onChange={(e) => setOptions(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Nhập ghi chú cụ thể cho nhà bếp..."
                className="w-full p-4 bg-zinc-900 border border-zinc-800 rounded-2xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 text-sm resize-none h-24 transition-all"
              />
            </div>

          </div>

          {/* RIGHT PANEL: Fixed Order Summary & Action Sidebar (Fixed, No Scroll) */}
          <div className="w-full lg:w-[380px] xl:w-[420px] shrink-0 bg-zinc-950/80 p-4 lg:p-5 flex flex-col justify-between overflow-hidden h-full">
            {/* Top Item Summary */}
            <div className="space-y-3 lg:space-y-3.5 min-h-0 overflow-y-auto pr-0.5 scrollbar-none">
              <div className="flex items-start gap-3 p-3 lg:p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800/80 shadow-md">
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${item.bgColor || 'from-blue-600 to-indigo-700'} border border-zinc-700 flex items-center justify-center text-2xl shadow-lg shrink-0`}>
                  {(item as any).emoji || '🍽️'}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-zinc-100 text-base leading-snug truncate">{item.name}</h4>
                  {item.description && (
                    <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">{item.description}</p>
                  )}
                  <p className="text-xs font-semibold text-zinc-400 mt-1">
                    Giá gốc: <span className="text-zinc-200 font-bold">{basePrice.toLocaleString('vi-VN')} VND</span>
                  </p>
                </div>
              </div>

              {/* Real-time Order Summary Checklist */}
              <div className="p-3 lg:p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 space-y-2">
                <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800 pb-1.5">
                  Tóm tắt lựa chọn
                </h5>
                
                <div className="space-y-1.5 text-xs lg:text-sm">
                  {options.selectedSize && isDrink && (
                    <div className="flex justify-between items-center text-zinc-300">
                      <span className="text-zinc-400">Kích thước:</span>
                      <span className="font-bold text-blue-300">{options.selectedSize.name} (+{Number(options.selectedSize.priceAdjustment || 0).toLocaleString('vi-VN')}đ)</span>
                    </div>
                  )}

                  {isDrink && item.hasSizes !== false && (
                    <>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span className="text-zinc-400">Đường:</span>
                        <span className="font-bold text-blue-300">{options.sugar || "100% đường"}</span>
                      </div>

                      <div className="flex justify-between items-center text-zinc-300">
                        <span className="text-zinc-400">Đá:</span>
                        <span className="font-bold text-blue-300">{options.ice || "100% đá"}</span>
                      </div>
                    </>
                  )}

                  {isDrink && item.hasSizes !== false && (
                    <div className="flex justify-between items-start text-zinc-300">
                      <span className="text-zinc-400 shrink-0">Topping ({options.toppings.length}):</span>
                      <span className="font-semibold text-right max-w-[200px] text-blue-300 truncate">
                        {options.toppings.length > 0 
                          ? options.toppings.join(", ") 
                          : "Không chọn"}
                      </span>
                    </div>
                  )}

                  {options.note && (
                    <div className="flex justify-between items-start text-zinc-300 pt-1 border-t border-zinc-800/50">
                      <span className="text-zinc-400 shrink-0">Ghi chú:</span>
                      <span className="font-bold text-blue-300 text-right line-clamp-1">{options.note}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-baseline text-xs lg:text-sm pt-1 border-t border-zinc-800/40">
                  <span className="text-xs text-zinc-400 shrink-0">Chiết khấu:</span>
                  <span className="text-xs lg:text-sm font-bold text-rose-400 text-right tabular-nums min-w-[120px]">{itemDiscountAmount > 0 ? '-' : ''}{itemDiscountAmount.toLocaleString('vi-VN')} VND</span>
                </div>
                <div className="pt-2 border-t border-zinc-800 flex justify-between items-baseline">
                  <span className="text-xs text-zinc-400 font-medium shrink-0">Đơn giá 1 món:</span>
                  <span className="text-base lg:text-lg font-bold text-zinc-100 text-right tabular-nums min-w-[120px]">{finalUnitPrice.toLocaleString('vi-VN')} VND</span>
                </div>
              </div>

              {/* Chiết khấu trực tiếp trên món */}
              <div className="p-3 lg:p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Chiết khấu trực tiếp
                  </h5>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800/50 text-zinc-500 min-w-[68px] text-center">
                    {options.itemDiscountType && (options.itemDiscountValue ?? 0) > 0 ? (
                      <span className="text-rose-400">Đang giảm</span>
                    ) : '—'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (options.itemDiscountType === 'PERCENT') {
                        setOptions(prev => ({ ...prev, itemDiscountType: null, itemDiscountValue: 0 }));
                      } else {
                        setOptions(prev => ({ ...prev, itemDiscountType: 'PERCENT', itemDiscountValue: 0 }));
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      options.itemDiscountType === 'PERCENT'
                        ? 'border-rose-500 bg-rose-500/15 text-rose-200 shadow-sm ring-1 ring-rose-500/40'
                        : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    Giảm theo %
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (options.itemDiscountType === 'FIXED') {
                        setOptions(prev => ({ ...prev, itemDiscountType: null, itemDiscountValue: 0 }));
                      } else {
                        setOptions(prev => ({ ...prev, itemDiscountType: 'FIXED', itemDiscountValue: 0 }));
                      }
                    }}
                    className={`py-1.5 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                      options.itemDiscountType === 'FIXED'
                        ? 'border-rose-500 bg-rose-500/15 text-rose-200 shadow-sm ring-1 ring-rose-500/40'
                        : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                    }`}
                  >
                    Giảm số tiền
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                    {!options.itemDiscountType ? 'Chiết khấu' : options.itemDiscountType === 'PERCENT' ? 'Phần trăm giảm (%)' : 'Số tiền giảm (VND)'}
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="1"
                        max={options.itemDiscountType === 'PERCENT' ? '100' : undefined}
                        placeholder={options.itemDiscountType === 'PERCENT' ? '10, 20' : '10000, 20000'}
                        value={options.itemDiscountValue || ''}
                        onChange={(e) => setOptions(prev => ({ ...prev, itemDiscountValue: Number(e.target.value) }))}
                        disabled={!options.itemDiscountType}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-all font-mono tabular-nums disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                      <span className="absolute right-3 top-1.5 text-[10px] font-bold text-zinc-500 font-mono">
                        {options.itemDiscountType === 'PERCENT' ? '%' : options.itemDiscountType === 'FIXED' ? '₫' : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!options.itemDiscountValue || options.itemDiscountValue <= 0) {
                          setOptions(prev => ({ ...prev, itemDiscountType: null, itemDiscountValue: 0 }));
                        }
                      }}
                      disabled={!options.itemDiscountValue || options.itemDiscountValue <= 0}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Block (Always Visible & Fixed) */}
            <div className="pt-3 lg:pt-4 border-t border-zinc-800/80 space-y-3 shrink-0">
              {/* Quantity controller */}
              <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-1.5 px-3 rounded-2xl">
                <span className="text-xs lg:text-sm font-semibold text-zinc-400">Số lượng món:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(-1)}
                    disabled={options.quantity <= 1}
                    className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="w-8 text-center font-black text-zinc-100 text-lg">
                    {options.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantityChange(1)}
                    className="w-9 h-9 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center justify-center transition-all active:scale-95"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              {/* Total & Submit Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full py-3.5 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base shadow-xl shadow-blue-600/30 border border-blue-400/30 flex items-center justify-center transition-all active:scale-[0.98] cursor-pointer"
              >
                Thêm vào giỏ
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}