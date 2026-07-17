import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' });
      return;
    }

    const accounts = await prisma.tenantBankAccount.findMany({
      where: { tenantId },
      orderBy: { isDefault: 'desc' },
    });

    res.json({ success: true, data: accounts });
  } catch (error) {
    console.error('getBankAccounts error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' });
      return;
    }

    const { bankId, bankName, accountNumber, accountName, isDefault } = req.body;
    if (!bankId || !accountNumber || !accountName) {
      res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin ngân hàng, số TK, tên TK' });
      return;
    }

    // Nếu isDefault = true, tắt isDefault của các tk khác
    if (isDefault) {
      await prisma.tenantBankAccount.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      });
    }

    const account = await prisma.tenantBankAccount.create({
      data: {
        tenantId,
        bankId,
        bankName: bankName || bankId,
        accountNumber,
        accountName: accountName.toUpperCase(),
        isDefault: isDefault || false,
      },
    });

    res.json({ success: true, data: account });
  } catch (error) {
    console.error('createBankAccount error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    const accountId = req.params.id;

    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' });
      return;
    }

    const { bankId, bankName, accountNumber, accountName, isDefault, isActive } = req.body;

    // Check account exists and belongs to tenant
    const existing = await prisma.tenantBankAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ngân hàng' });
      return;
    }

    if (isDefault) {
      await prisma.tenantBankAccount.updateMany({
        where: { tenantId, id: { not: accountId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.tenantBankAccount.update({
      where: { id: accountId },
      data: {
        bankId: bankId ?? existing.bankId,
        bankName: bankName ?? existing.bankName,
        accountNumber: accountNumber ?? existing.accountNumber,
        accountName: accountName ? accountName.toUpperCase() : existing.accountName,
        isDefault: isDefault ?? existing.isDefault,
        isActive: isActive ?? existing.isActive,
      },
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('updateBankAccount error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    const accountId = req.params.id;

    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Yêu cầu có tenantId' });
      return;
    }

    const existing = await prisma.tenantBankAccount.findFirst({
      where: { id: accountId, tenantId },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản ngân hàng' });
      return;
    }

    await prisma.tenantBankAccount.delete({
      where: { id: accountId },
    });

    res.json({ success: true, message: 'Đã xóa tài khoản ngân hàng' });
  } catch (error) {
    console.error('deleteBankAccount error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
