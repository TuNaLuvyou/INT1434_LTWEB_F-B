import { Response } from 'express';
import * as branchService from '../services/branch.service';

interface AuthRequest {
  user?: { userId: string; tenantId?: string; role: string };
  body: any;
  params: any;
}

export const listBranches = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Missing tenant context' }); return; }
    const branches = await branchService.listBranches(tenantId);
    res.json({ success: true, data: branches });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBranch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Missing tenant context' }); return; }
    const { name, address } = req.body;
    if (!name) { res.status(400).json({ success: false, message: 'Vui lòng nhập tên chi nhánh' }); return; }
    const branch = await branchService.createBranch(tenantId, name, address);
    res.status(201).json({ success: true, data: branch });
  } catch (error: any) {
    if (error.message === 'USAGE_LIMIT_EXCEEDED') {
      res.status(403).json({ success: false, message: 'Gói cước hiện tại không cho phép thêm chi nhánh mới. Vui lòng nâng cấp gói cước.' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

export const updateBranch = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) { res.status(400).json({ success: false, message: 'Missing tenant context' }); return; }
    const { id } = req.params;
    const { name, address, isActive } = req.body;
    const branch = await branchService.updateBranch(id, tenantId, { name, address, isActive });
    res.json({ success: true, data: branch });
  } catch (error: any) {
    if (error.message === 'BRANCH_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Không tìm thấy chi nhánh' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};
