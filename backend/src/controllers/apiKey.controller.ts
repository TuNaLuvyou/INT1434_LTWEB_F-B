import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as apiKeyService from '../services/apiKey.service';

export async function createApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const { name, expiresAt } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, message: 'Name is required' });
      return;
    }

    const result = await apiKeyService.generateApiKey(
      tenantId,
      name,
      expiresAt ? new Date(expiresAt) : null
    );

    res.status(201).json({
      success: true,
      data: result,
      message: 'API key created. Save this key now — it will not be shown again.',
    });
  } catch (error: any) {
    console.error('createApiKey error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function listApiKeys(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const keys = await apiKeyService.listApiKeys(tenantId);
    res.json({ success: true, data: keys });
  } catch (error: any) {
    console.error('listApiKeys error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function revokeApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    await apiKeyService.revokeApiKey(id, tenantId);
    res.json({ success: true, message: 'API key revoked' });
  } catch (error: any) {
    console.error('revokeApiKey error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function updateApiKey(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    const { name, expiresAt, isActive } = req.body;

    const updated = await apiKeyService.updateApiKey(id, tenantId, {
      name,
      expiresAt: expiresAt ? new Date(expiresAt) : expiresAt === null ? null : undefined,
      isActive,
    });

    res.json({ success: true, data: updated, message: 'API key updated' });
  } catch (error: any) {
    console.error('updateApiKey error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}
