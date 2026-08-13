import prisma from '../config/prisma';
import { SessionStatus } from '@prisma/client';
import { emitTableStatusChanged, emitSessionClosed, emitKitchenNewTicket } from '../socket/emit.helpers';
import { AppError } from '../utils/app-error';
import { deductInventory, InsufficientStockError } from './inventory.service';
import { dispatchEvent } from './webhook.service';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionWithItems {
  id: string;
  tableId: string;
  status: SessionStatus;
  version: number;
  openedAt: Date;
  closedAt: Date | null;
  orderItems: OrderItemWithMenu[];
}

interface OrderItemWithMenu {
  id: string;
  sessionId: string;
  menuItemId: string;
  qty: number;
  unitPrice: any; // Decimal
  note: string | null;
  status: string;
  itemDiscountType: string | null;
  itemDiscountValue: any; // Decimal
  createdAt: Date;
  updatedAt: Date;
  menuItem: {
    id: string;
    name: string;
    price: any; // Decimal
    imageUrl: string | null;
    isSoldOut: boolean;
  };
}

// ─── Include helper ──────────────────────────────────────────────────────────

const orderItemsInclude = {
  orderItems: {
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          price: true,
          imageUrl: true,
          isSoldOut: true,
        },
      },
    },
  },
} as const;

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Sinh mã đơn hàng: lấy chữ cái đầu của tên chi nhánh ("Chi Nhánh 1" -> "CN1")
 * + giờ:phút:giây + số ngẫu nhiên. Ví dụ: "CN1-09301234".
 */
function generateOrderNo(branchName?: string | null): string {
  let prefix = 'ORD';
  if (branchName) {
    const normalized = branchName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const words = normalized.split(/\s+/).filter((w: string) => w.length > 0);
    prefix = words.map((w: string) => w[0].toUpperCase()).join('').substring(0, 4);
  }

  const now = new Date();
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const rand = Math.floor(10 + Math.random() * 90);
  return `${prefix}-${mm}${ss}${rand}`;
}

/**
 * TẠO MỚI session mang về (không cần bàn).
 */
export async function createTakeawaySession(tenantId: string, branchId: string): Promise<{
  session: SessionWithItems;
  table: any;
}> {
  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { name: true } });
  const orderNo = generateOrderNo(branch?.name);
  const now = new Date();

  const newSession = await prisma.tableSession.create({
    data: {
      tableId: null,
      tenantId,
      branchId,
      status: 'OPEN',
      version: 0,
      createdViaPos: true,
      orderNo,
    },
    include: orderItemsInclude,
  });

  dispatchEvent(tenantId, 'order:created', {
    sessionId: newSession.id,
    orderNo: newSession.orderNo,
    tenantId,
    branchId,
    tableId: null,
    tableNumber: 0,
    tableLabel: orderNo,
    createdViaPos: true,
    createdAt: now.toISOString(),
  }).catch((err) => console.error('[Webhook] dispatch order:created error:', err));

  return {
    session: newSession as unknown as SessionWithItems,
    table: {
      id: newSession.id,
      tableNumber: 0,
      label: orderNo,
      tenantId,
      branchId,
    },
  };
}

/**
 * JOIN hoặc TẠO MỚI session cho một bàn.
 * - Nếu đã có session OPEN → trả về session hiện tại (isNew: false)
 * - Nếu chưa có → tạo mới trong transaction, emit socket event (isNew: true)
 */
export async function joinOrCreateSession(tableId: string, createdViaPos?: boolean, expectedTenantId?: string): Promise<{
  session: SessionWithItems;
  isNew: boolean;
  table: any;
}> {
  // 1. Validate table tồn tại (hỗ trợ cả khóa UUID và số hiệu bàn tableNumber)
  let table = await prisma.table.findUnique({
    where: { id: tableId },
    include: { branch: true },
  });
  if (!table) {
    const parsedNum = parseInt(tableId, 10);
    if (!isNaN(parsedNum)) {
      const tableWhere: any = { tableNumber: parsedNum };
      if (expectedTenantId) tableWhere.tenantId = expectedTenantId;
      table = await prisma.table.findFirst({
        where: tableWhere,
        include: { branch: true },
      });
    }
  }

  if (!table) {
    const err = new Error('Bàn không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  const actualTableId = table.id;

  // 2. Tìm session OPEN hiện tại (lấy session mới nhất)
  const existingSession = await prisma.tableSession.findFirst({
    where: { tableId: actualTableId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
    include: orderItemsInclude,
  });

  if (existingSession) {
    // Nếu phiên này được tạo từ POS (createdViaPos là true), nhưng request này không từ POS (không gửi createdViaPos)
    // thì chặn khách lại và hiển thị thông báo
    if (existingSession.createdViaPos && !createdViaPos) {
      const err = new Error('Bàn này hiện tại đã có người đặt. Vui lòng liên hệ tại quầy.') as any;
      err.statusCode = 409;
      throw err;
    }

    // Nếu request từ POS và phiên hiện tại chưa đánh dấu createdViaPos, cập nhật lại nó
    if (createdViaPos && !existingSession.createdViaPos) {
      const updated = await prisma.tableSession.update({
        where: { id: existingSession.id },
        data: { createdViaPos: true },
        include: orderItemsInclude,
      });
      return { session: updated as unknown as SessionWithItems, isNew: false, table };
    }

    // 3a. Session đã tồn tại — đảm bảo trạng thái bàn là OCCUPIED
    if (table.status !== 'OCCUPIED') {
      await prisma.table.update({
        where: { id: actualTableId },
        data: { status: 'OCCUPIED' },
      });
    }
    return { session: existingSession as unknown as SessionWithItems, isNew: false, table };
  }

  // 3b. Chưa có session — tạo mới trong transaction
  const now = new Date();
  const orderNo = generateOrderNo((table as any).branch?.name);

  const [newSession] = await prisma.$transaction([
    prisma.tableSession.create({
      data: {
        tableId: actualTableId,
        tenantId: table.tenantId,
        branchId: table.branchId,
        status: 'OPEN',
        version: 0,
        createdViaPos: !!createdViaPos,
        orderNo,
      },
      include: orderItemsInclude,
    }),
    prisma.table.update({
      where: { id: actualTableId },
      data: { status: 'OCCUPIED' },
    }),
  ]);

  // 4. Emit socket event tới floor-plan (F4) bằng emit helpers mới
  emitTableStatusChanged(table.tenantId, table.branchId, {
    tableId: actualTableId,
    status: 'OCCUPIED',
  });

  dispatchEvent(table.tenantId, 'order:created', {
    sessionId: newSession.id,
    orderNo: newSession.orderNo,
    tenantId: table.tenantId,
    branchId: table.branchId,
    tableId: actualTableId,
    tableNumber: table.tableNumber,
    tableLabel: table.label || `Bàn ${table.tableNumber}`,
    createdViaPos: !!createdViaPos,
    createdAt: now.toISOString(),
  }).catch((err) => console.error('[Webhook] dispatch order:created error:', err));

  return { session: newSession as unknown as SessionWithItems, isNew: true, table };
}

/**
 * Lấy session theo ID, include orderItems với menuItem.
 */
export async function getSessionById(sessionId: string): Promise<SessionWithItems> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: orderItemsInclude,
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  return session as unknown as SessionWithItems;
}

/**
 * Lấy dữ liệu hoá đơn (receipt) cho session — PUBLIC, không cần tenantId.
 * Dùng cho trang /receipt/[sessionId] để khách xem/print hoá đơn.
 */
export async function getReceiptData(sessionId: string): Promise<{
  sessionId: string;
  openedAt: Date;
  tableId: string;
  tableNumber: number;
  tableLabel: string;
  items: Array<{
    id: string;
    sessionId: string;
    menuItemId: string;
    qty: number;
    note: string | null;
    status: string;
    unitPrice: any;
    itemDiscountType: string | null;
    itemDiscountValue: any;
    createdAt: Date;
    menuItem: {
      name: string;
      price: any;
      imageUrl: string | null;
    };
  }>;
  total: number;
  paymentMethod: string;
}> {
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      openedAt: true,
      tableId: true,
      status: true,
      orderNo: true,
      table: {
        select: {
          tableNumber: true,
          label: true,
        },
      },
      orderItems: {
        where: { status: { not: 'CART' } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          sessionId: true,
          menuItemId: true,
          qty: true,
          note: true,
          status: true,
          unitPrice: true,
          itemDiscountType: true,
          itemDiscountValue: true,
          createdAt: true,
          menuItem: {
            select: {
              name: true,
              price: true,
              imageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  const items = session.orderItems as any;
  const subtotal = items.reduce((sum: number, item: any) => {
    const unitPrice = Number(item.unitPrice);
    let itemDiscount = 0;
    if (item.itemDiscountType === 'PERCENT' && item.itemDiscountValue) {
      itemDiscount = Math.round(unitPrice * Math.min(Number(item.itemDiscountValue), 100) / 100);
    } else if (item.itemDiscountType === 'FIXED' && item.itemDiscountValue) {
      itemDiscount = Math.min(Number(item.itemDiscountValue), unitPrice);
    }
    return sum + (unitPrice - itemDiscount) * item.qty;
  }, 0);
  const tax = Math.round(subtotal * 0.1);
  const total = subtotal + tax;

  // Try to find payment method from payment record
  const payment = await prisma.payment.findFirst({
    where: { sessionId, status: 'SUCCESS' },
    select: { method: true, provider: true },
    orderBy: { paidAt: 'desc' },
  });

  let paymentMethod = 'Đã thanh toán';
  if (payment) {
    if (payment.method === 'TRANSFER' && payment.provider === 'VIETQR') {
      paymentMethod = 'VietQR';
    } else if (payment.method === 'CASH') {
      paymentMethod = 'Tiền mặt';
    }
  }

  return {
    sessionId: session.id,
    openedAt: session.openedAt,
    tableId: session.tableId || session.id,
    tableNumber: session.table?.tableNumber ?? 0,
    tableLabel: session.table?.label ?? 'Mang về',
    items,
    total,
    paymentMethod,
  };
}

/**
 * Lấy session OPEN đang hoạt động của một bàn — dùng cho màn hình cashier.
 */
export async function getActiveSessionByTableId(tableId: string): Promise<SessionWithItems> {
  const session = await prisma.tableSession.findFirst({
    where: { tableId, status: 'OPEN' },
    include: orderItemsInclude,
  });

  if (!session) {
    const err = new Error('Bàn không có order đang mở') as any;
    err.statusCode = 404;
    throw err;
  }

  return session as unknown as SessionWithItems;
}

/**
 * Cập nhật trạng thái session (PAID | CANCELLED).
 * Chỉ cho phép đóng session đang OPEN.
 * Emit socket events cho floor-plan và table room bằng emit helpers mới.
 */
export async function updateSessionStatus(
  sessionId: string,
  newStatus: 'PAID' | 'CANCELLED',
  keepOccupied?: boolean,
  userTenantId?: string
): Promise<SessionWithItems> {
  // 1. Tìm session
  const session = await prisma.tableSession.findUnique({
    where: { id: sessionId },
    include: {
      table: true,
      orderItems: {
        include: {
          menuItem: true
        }
      }
    },
  });

  if (!session) {
    const err = new Error('Session không tồn tại') as any;
    err.statusCode = 404;
    throw err;
  }

  // 2. Kiểm tra tenantId của user khớp với tenant của session
  if (userTenantId && session.tenantId !== userTenantId) {
    const err = new Error('Bạn không có quyền thao tác trên phiên này') as any;
    err.statusCode = 403;
    throw err;
  }

  // 3. Chỉ được đóng session đang OPEN
  if (session.status !== 'OPEN') {
    const err = new Error(`Session đã được đóng với trạng thái: ${session.status}`) as any;
    err.statusCode = 409;
    throw err;
  }

  const now = new Date();
  let updatedSession: any;

  if (newStatus === 'PAID') {
    // Lấy các món CART và PENDING chưa gửi bếp
    const cartItems = session.orderItems.filter(item => item.status === 'CART');
    const pendingItems = session.orderItems.filter(item => item.status === 'PENDING');

    // Các món cần gửi bếp (nếu session chưa locked thì gửi cả pending, nếu locked rồi thì chỉ gửi cart)
    const itemsToSendToKitchen = [
      ...cartItems,
      ...(!session.lockedAt ? pendingItems : [])
    ];

    // Trạng thái bàn đích: Nếu keepOccupied là true (POS order) thì giữ OCCUPIED, ngược lại AVAILABLE
    const targetTableStatus = keepOccupied ? 'OCCUPIED' : 'AVAILABLE';

    await prisma.$transaction(async (tx) => {
      // 1. Chuyển tất cả CART thành PENDING
      if (cartItems.length > 0) {
        await tx.orderItem.updateMany({
          where: { sessionId, status: 'CART' },
          data:  { status: 'PENDING' },
        });
      }

      // 2. AUTO-DEDUCTION: Trừ tồn kho nguyên liệu theo BOM
      //    Gộp các items CART + PENDING (chưa bị deduct) để tính nguyên liệu.
      //    Chỉ deduct các món có trạng thái CART hoặc PENDING (không deduct DONE/VOID lần 2).
      const itemsToDeduct = session.orderItems
        .filter(i => i.status === 'CART' || i.status === 'PENDING')
        .map(i => ({ menuItemId: i.menuItemId, qty: i.qty }));

      if (itemsToDeduct.length > 0) {
        // Truyền tx vào deductInventory để chạy trong cùng 1 transaction
        // → nếu deduct fail (thiếu stock) toàn bộ PAID operation sẽ rollback
        await deductInventory(itemsToDeduct, sessionId, 'SYSTEM_CASHIER', tx as any, session.tenantId, session.branchId);
      }

      // 3. Cập nhật TableSession thành PAID, closedAt, và lockedAt (nếu chưa locked)
      updatedSession = await tx.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'PAID',
          closedAt: now,
          lockedAt: session.lockedAt || now,
        },
        include: orderItemsInclude,
      });

      // 4. Cập nhật trạng thái bàn (nếu có)
      if (session.tableId) {
        await tx.table.update({
          where: { id: session.tableId },
          data: { status: targetTableStatus },
        });
      }
    }, {
      timeout:  15_000, // 15s — đủ cho batch deduction lớn
      maxWait:   5_000,
    });

    // Emit socket events cho floor-plan
    if (session.tableId) {
      emitTableStatusChanged(session.tenantId, session.branchId, {
        tableId: session.tableId,
        status: targetTableStatus as any,
      });
    }

    // Emit socket session closed
    emitSessionClosed(session.tenantId, session.branchId, session.tableId || session.id, {
      sessionId,
      tableId: session.tableId || session.id,
      status: 'PAID',
      closedAt: now.toISOString(),
    });

    if (itemsToSendToKitchen.length > 0) {
      emitKitchenNewTicket(session.tenantId, session.branchId, {
        sessionId,
        orderNo: session.orderNo || undefined,
        tableId: session.tableId || session.id,
        tableNumber: session.table?.tableNumber ?? 0,
        tableLabel: session.table?.label ?? 'Mang về',
        items: itemsToSendToKitchen.map(item => ({
          orderItemId: item.id,
          menuItemId: item.menuItemId,
          menuItemName: (item as any).menuItem.name,
          qty: item.qty,
          note: item.note || undefined,
          status: 'PENDING',
        })),
        createdAt: now.toISOString(),
      });
    }

    const itemsPayload = session.orderItems.map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      name: item.menuItem?.name || '',
      qty: item.qty,
      unitPrice: Number(item.unitPrice),
      itemDiscountType: item.itemDiscountType || null,
      itemDiscountValue: item.itemDiscountValue ? Number(item.itemDiscountValue) : 0,
      note: item.note || null,
      selectedModifiers: item.selectedModifiers || null,
      status: item.status,
    }));

    dispatchEvent(session.tenantId, 'order:completed', {
      sessionId: session.id,
      orderNo: session.orderNo,
      tenantId: session.tenantId,
      branchId: session.branchId,
      tableId: session.tableId,
      tableNumber: session.table?.tableNumber ?? 0,
      tableLabel: session.table?.label ?? 'Mang về',
      status: 'PAID',
      closedAt: now.toISOString(),
      totalItems: itemsPayload.reduce((acc, i) => acc + i.qty, 0),
      items: itemsPayload,
    }).catch((err) => console.error('[Webhook] dispatch order:completed error:', err));

    dispatchEvent(session.tenantId, 'session:closed', {
      sessionId: session.id,
      orderNo: session.orderNo,
      tenantId: session.tenantId,
      branchId: session.branchId,
      tableId: session.tableId,
      status: 'PAID',
      closedAt: now.toISOString(),
    }).catch((err) => console.error('[Webhook] dispatch session:closed error:', err));
  } else {
    // newStatus === 'CANCELLED'
    const [cancelledSession] = await prisma.$transaction([
      prisma.tableSession.update({
        where: { id: sessionId },
        data: {
          status: 'CANCELLED',
          closedAt: now,
        },
        include: orderItemsInclude,
      }),
      ...(session.tableId ? [
        prisma.table.update({
          where: { id: session.tableId },
          data: { status: 'AVAILABLE' },
        })
      ] : []),
    ]);

    updatedSession = cancelledSession;

    if (session.tableId) {
      emitTableStatusChanged(session.tenantId, session.branchId, {
        tableId: session.tableId,
        status: 'AVAILABLE',
      });
    }

    emitSessionClosed(session.tenantId, session.branchId, session.tableId || session.id, {
      sessionId,
      tableId: session.tableId || session.id,
      status: 'CANCELLED',
      closedAt: now.toISOString(),
    });

    dispatchEvent(session.tenantId, 'session:closed', {
      sessionId: session.id,
      orderNo: session.orderNo,
      tenantId: session.tenantId,
      branchId: session.branchId,
      tableId: session.tableId,
      status: 'CANCELLED',
      closedAt: now.toISOString(),
    }).catch((err) => console.error('[Webhook] dispatch session:closed error:', err));
  }

  return updatedSession as unknown as SessionWithItems;
}

/**
 * Thêm hoặc cập nhật một item trong giỏ hàng.
 * Sử dụng Last-Write-Wins (LWW) với client timestamp guard.
 */
export async function addToCart(
  sessionId: string,
  menuItemId: string,
  qty: number,
  note: string | undefined,
  clientTimestamp: number,
  itemDiscountType?: string | null,
  itemDiscountValue?: number | null
) {
  return await prisma.$transaction(async (tx) => {
    // STEP 1-3: Thực hiện query song song để giảm latency (đặc biệt khi DB remote)
    const [session, menuItem, existing] = await Promise.all([
      tx.tableSession.findUnique({
        where: { id: sessionId },
        include: { table: true }
      }),
      tx.menuItem.findUnique({
        where: { id: menuItemId },
      }),
      tx.orderItem.findUnique({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
      }),
    ]);
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    if (!menuItem || !menuItem.isActive) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Món không còn phục vụ');
    }

    // Check BranchMenuItem override
    const branchOverride = session.branchId ? await tx.branchMenuItem.findUnique({
      where: { branchId_menuItemId: { branchId: session.branchId, menuItemId } }
    }) : null;

    const effectiveIsActive = branchOverride?.isActive ?? menuItem.isActive;
    const effectiveIsSoldOut = branchOverride?.isSoldOut ?? menuItem.isSoldOut;

    if (!effectiveIsActive) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Món không còn phục vụ');
    }
    if (effectiveIsSoldOut) {
      throw new AppError(409, 'ITEM_SOLD_OUT', `Món "${menuItem.name}" đã hết`);
    }

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      // Nếu client gửi data CŨ HƠN record trong DB → conflict
      if (dbTimestamp > clientTimestamp) {
        // Lấy toàn bộ cart hiện tại để sync về client
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId, status: 'CART' },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        });
        throw new AppError(409, 'CONFLICT', 'Giỏ hàng đã được cập nhật từ thiết bị khác', { currentCart });
      }
    }

    // STEP 4: Upsert OrderItem
    if (qty <= 0) {
      // qty <= 0 nghĩa là xóa item
      await tx.orderItem.deleteMany({
        where: { sessionId, menuItemId, status: 'CART' },
      });
    } else {
      let finalDiscountType: string | null = itemDiscountType || null;
      let finalDiscountValue: number | null = itemDiscountValue || null;

      if (finalDiscountType && !['PERCENT', 'FIXED'].includes(finalDiscountType)) {
        finalDiscountType = null;
        finalDiscountValue = null;
      }
      if (finalDiscountType === 'PERCENT' && (finalDiscountValue === null || finalDiscountValue <= 0 || finalDiscountValue > 100)) {
        finalDiscountValue = null;
      }
      if (finalDiscountType === 'FIXED' && (finalDiscountValue === null || finalDiscountValue <= 0)) {
        finalDiscountValue = null;
      }
      if (!finalDiscountType) finalDiscountValue = null;

      await tx.orderItem.upsert({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
        update: {
          qty,
          note: note ?? '',
          itemDiscountType: finalDiscountType as any,
          itemDiscountValue: finalDiscountValue as any,
        },
        create: {
          tenantId: session.tenantId,
          sessionId,
          menuItemId,
          qty,
          note: note ?? '',
          unitPrice: menuItem.price,
          itemDiscountType: finalDiscountType as any,
          itemDiscountValue: finalDiscountValue as any,
          status: 'CART',
        },
      });
    }

    // STEP 5: Lấy cart mới nhất sau khi upsert
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId, status: 'CART' },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });

    return { session, updatedCart };
  });
}

/**
 * Xóa một item khỏi giỏ hàng.
 * Sử dụng Last-Write-Wins (LWW) với client timestamp guard.
 */
export async function deleteCartItem(
  sessionId: string,
  menuItemId: string,
  clientTimestamp: number
) {
  return await prisma.$transaction(async (tx) => {
    // STEP 1-2: Query song song để giảm latency
    const [session, existing] = await Promise.all([
      tx.tableSession.findUnique({
        where: { id: sessionId },
        include: { table: true }
      }),
      tx.orderItem.findUnique({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
      }),
    ]);
    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    if (existing) {
      const dbTimestamp = existing.updatedAt.getTime();
      if (dbTimestamp > clientTimestamp) {
        const currentCart = await tx.orderItem.findMany({
          where: { sessionId, status: 'CART' },
          include: {
            menuItem: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        });
        throw new AppError(409, 'CONFLICT', 'Giỏ hàng đã được cập nhật từ thiết bị khác', { currentCart });
      }

      // Xóa item
      await tx.orderItem.delete({
        where: {
          sessionId_menuItemId_status: {
            sessionId,
            menuItemId,
            status: 'CART',
          },
        },
      });
    }

    // Lấy cart mới nhất sau khi xóa
    const updatedCart = await tx.orderItem.findMany({
      where: { sessionId, status: 'CART' },
      include: {
        menuItem: {
          select: {
            id: true,
            name: true,
            price: true,
            imageUrl: true,
          },
        },
      },
    });

    return { session, updatedCart };
  });
}

/**
 * Xoá tất cả items khỏi giỏ hàng (status CART) của một session.
 */
export async function clearCartItems(sessionId: string) {
  return await prisma.$transaction(async (tx) => {
    const session = await tx.tableSession.findUnique({
      where: { id: sessionId },
      include: { table: true }
    });

    if (!session || session.status !== 'OPEN') {
      throw new AppError(400, 'SESSION_CLOSED', 'Phiên đặt món đã kết thúc');
    }

    await tx.orderItem.deleteMany({
      where: { sessionId, status: 'CART' },
    });

    return { session };
  });
}
