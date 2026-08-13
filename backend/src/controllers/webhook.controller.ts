import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import * as webhookService from '../services/webhook.service';

export async function createWebhook(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const { name, url, events, secret } = req.body;
    if (!name || !url || !events || !Array.isArray(events) || events.length === 0) {
      res.status(400).json({ success: false, message: 'name, url, and events (non-empty array) are required' });
      return;
    }

    const webhook = await webhookService.createWebhook(tenantId, { name, url, events, secret });
    res.status(201).json({ success: true, data: webhook });
  } catch (error: any) {
    console.error('createWebhook error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function listWebhooks(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const webhooks = await webhookService.listWebhooks(tenantId);
    res.json({ success: true, data: webhooks });
  } catch (error: any) {
    console.error('listWebhooks error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function updateWebhook(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    const { name, url, events, isActive } = req.body;

    const webhook = await webhookService.updateWebhook(id, tenantId, { name, url, events, isActive });
    res.json({ success: true, data: webhook });
  } catch (error: any) {
    console.error('updateWebhook error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function deleteWebhook(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    await webhookService.deleteWebhook(id, tenantId);
    res.json({ success: true, message: 'Webhook deleted' });
  } catch (error: any) {
    console.error('deleteWebhook error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function listDeliveries(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    const deliveries = await webhookService.listDeliveries(id, tenantId);
    res.json({ success: true, data: deliveries });
  } catch (error: any) {
    console.error('listDeliveries error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function retryDelivery(req: Request, res: Response): Promise<void> {
  try {
    const id = req.params.id as string;
    await webhookService.retryDelivery(id);
    res.json({ success: true, message: 'Delivery queued for retry' });
  } catch (error: any) {
    console.error('retryDelivery error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

export async function testWebhook(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenantId' });
      return;
    }

    const id = req.params.id as string;
    const result = await webhookService.testWebhook(id, tenantId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error('testWebhook error:', error);
    const status = error.statusCode || 500;
    res.status(status).json({ success: false, message: error.message || 'Server error' });
  }
}

