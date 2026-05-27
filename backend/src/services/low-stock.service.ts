/**
 * src/services/low-stock.service.ts
 *
 * Low-stock detection — tách riêng để dễ test và tái sử dụng.
 *
 * Được gọi sau bất kỳ sự kiện nào có thể làm giảm tồn kho:
 *   - ORDER_DEDUCT (deductInventory)
 *   - WASTE (recordWaste)
 *   - ADJUSTMENT (adjustStock)
 *
 * Luồng:
 *  1. Query DB lấy danh sách ingredient có stock <= minStock trong tập ingredientIds
 *  2. Nếu có → fire-and-forget sendLowStockAlert (không await để không block)
 *  3. Trả về danh sách item thấp để caller có thể đưa vào response body
 */

import prisma from '../config/prisma';
import { sendLowStockAlert, LowStockItem } from '../utils/mailer';

/**
 * Kiểm tra tồn kho thấp cho các nguyên liệu đã cho và gửi email alert nếu cần.
 *
 * @param ingredientIds  Tập ID cần kiểm tra (undefined = kiểm tra tất cả)
 * @param trigger        Nhãn sự kiện kích hoạt, ghi vào email subject/body
 * @returns              Danh sách LowStockItem (rỗng nếu tất cả đều ổn)
 */
export async function checkAndAlertLowStock(
  ingredientIds: string[] | undefined,
  trigger: string
): Promise<LowStockItem[]> {
  // Query: lấy tất cả ingredient trong tập ID mà stock <= minStock
  const raw = await prisma.$queryRawUnsafe<
    Array<{ id: string; name: string; unit: string; stock: string; minStock: string }>
  >(
    ingredientIds && ingredientIds.length > 0
      ? `SELECT id, name, unit, stock, "minStock"
         FROM "Ingredient"
         WHERE id = ANY($1::text[])
           AND stock <= "minStock"`
      : `SELECT id, name, unit, stock, "minStock"
         FROM "Ingredient"
         WHERE stock <= "minStock"`,
    ...(ingredientIds && ingredientIds.length > 0 ? [ingredientIds] : [])
  );

  if (raw.length === 0) return [];

  const items: LowStockItem[] = raw.map(r => ({
    id:       r.id,
    name:     r.name,
    unit:     r.unit,
    stock:    Number(r.stock),
    minStock: Number(r.minStock),
  }));

  // Fire-and-forget — không block luồng chính nếu SMTP chậm/lỗi
  sendLowStockAlert(items, trigger).catch(err =>
    console.error('[low-stock.service] sendLowStockAlert error:', err)
  );

  return items;
}
