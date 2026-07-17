import { Request, Response } from 'express';
import * as platformAdminService from '../services/platform-admin.service';

export const listTenants = async (req: Request, res: Response) => {
  try {
    const tenants = await platformAdminService.getTenants();
    res.json({ success: true, data: tenants });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createTenant = async (req: Request, res: Response) => {
  try {
    const { name, domain, ownerEmail, ownerName } = req.body;
    
    if (!name || !ownerEmail || !ownerName) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const tenant = await platformAdminService.createTenant({ name, domain, ownerEmail, ownerName });
    res.status(201).json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const suspendTenant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await platformAdminService.updateTenantStatus(id, false);
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const activateTenant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const tenant = await platformAdminService.updateTenantStatus(id, true);
    res.json({ success: true, data: tenant });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.query;
    const logs = await platformAdminService.getAuditLogs(tenantId as string);
    res.json({ success: true, data: logs });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
export const updateTenantSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { planName } = req.body;
    if (!planName) return res.status(400).json({ success: false, message: 'Missing planName' });
    const result = await platformAdminService.updateTenantSubscriptionPlan(id, planName);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
