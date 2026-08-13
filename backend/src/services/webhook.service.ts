import crypto from 'crypto';
import prisma from '../config/prisma';
import { AppError } from '../utils/app-error';
import { webhookQueue } from '../queues/webhook.queue';

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generatePrivateSecret(): string {
  return crypto.randomBytes(16).toString('hex');
}

export async function createWebhook(
  tenantId: string,
  data: { name: string; url: string; events: string[]; secret?: string }
) {
  const secret = data.secret || generateSecret();

  const webhook = await prisma.webhook.create({
    data: {
      tenantId,
      name: data.name,
      url: data.url,
      secret,
      events: data.events,
    },
  });

  return webhook;
}

export async function listWebhooks(tenantId: string) {
  return prisma.webhook.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      tenantId: true,
      name: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updateWebhook(id: string, tenantId: string, data: { name?: string; url?: string; events?: string[]; isActive?: boolean }) {
  const existing = await prisma.webhook.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
  }

  return prisma.webhook.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.url !== undefined && { url: data.url }),
      ...(data.events !== undefined && { events: data.events }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });
}

export async function deleteWebhook(id: string, tenantId: string) {
  const existing = await prisma.webhook.findFirst({ where: { id, tenantId } });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
  }

  await prisma.webhook.delete({ where: { id } });
}

async function deliverDirectly(
  deliveryId: string,
  event: string,
  payload: Record<string, unknown>,
  url: string,
  secret: string
) {
  const body = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HiAI-Signature': `sha256=${hmac}`,
        'X-HiAI-Event': event,
        'X-HiAI-Delivery': deliveryId,
        'User-Agent': 'HiAI-MenuGo-Webhook/1.0',
      },
      body,
      signal: AbortSignal.timeout(15000),
    });

    const responseBody = await response.text();
    const isSuccess = response.status >= 200 && response.status < 300;

    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        attempts: 1,
        responseStatus: response.status,
        responseBody: responseBody.substring(0, 5000),
        errorMessage: isSuccess ? null : `HTTP ${response.status}`,
        nextRetryAt: null,
      },
    });

    return { isSuccess, status: response.status, body: responseBody };
  } catch (error: any) {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'FAILED',
        attempts: 1,
        errorMessage: error.message || 'Fetch error',
        nextRetryAt: null,
      },
    });

    return { isSuccess: false, status: 0, body: error.message };
  }
}

export async function dispatchEvent(
  tenantId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const dotEvent = event.replace(':', '.');
  const colonEvent = event.replace('.', ':');

  const aliases = new Set<string>([event, dotEvent, colonEvent]);
  if (event === 'payment:completed' || event === 'payment.completed' || event === 'payment.success') {
    aliases.add('payment.success');
    aliases.add('payment:completed');
  }
  if (event === 'order:completed' || event === 'order.completed') {
    aliases.add('order.completed');
    aliases.add('order:completed');
  }
  if (event === 'order:created' || event === 'order.created') {
    aliases.add('order.created');
    aliases.add('order:created');
  }
  if (event === 'session:closed' || event === 'session.closed') {
    aliases.add('session.closed');
    aliases.add('session:closed');
  }

  const aliasArray = Array.from(aliases);

  const webhooks = await prisma.webhook.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: aliasArray.map((e) => ({ events: { has: e } })),
    },
  });

  if (webhooks.length === 0) return;

  const deliveries = await Promise.all(
    webhooks.map((wh) =>
      prisma.webhookDelivery.create({
        data: {
          webhookId: wh.id,
          event,
          payload: payload as any,
          status: 'PENDING',
        },
      })
    )
  );

  const hasRedis = !!process.env.REDIS_URL;

  await Promise.all(
    deliveries.map((delivery, index) => {
      if (hasRedis) {
        return webhookQueue.add(
          `delivery-${delivery.id}`,
          {
            deliveryId: delivery.id,
            webhookId: webhooks[index].id,
            event,
            payload: payload as Record<string, unknown>,
            url: webhooks[index].url,
            secret: webhooks[index].secret,
            attempt: 0,
          },
          {
            attempts: 5,
            backoff: { type: 'exponential', delay: 5000 },
          }
        );
      } else {
        return deliverDirectly(
          delivery.id,
          event,
          payload as Record<string, unknown>,
          webhooks[index].url,
          webhooks[index].secret
        );
      }
    })
  );
}

export async function listDeliveries(webhookId: string, tenantId: string) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
  if (!webhook) {
    throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
  }

  return prisma.webhookDelivery.findMany({
    where: { webhookId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function testWebhook(webhookId: string, tenantId: string) {
  const webhook = await prisma.webhook.findFirst({ where: { id: webhookId, tenantId } });
  if (!webhook) {
    throw new AppError(404, 'NOT_FOUND', 'Webhook not found');
  }

  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhook.id,
      event: 'test.ping',
      payload: {
        event: 'test.ping',
        message: 'This is a test webhook delivery from HiAI-MenuGo',
        timestamp: new Date().toISOString(),
      },
      status: 'PENDING',
    },
  });

  return deliverDirectly(
    delivery.id,
    'test.ping',
    delivery.payload as Record<string, unknown>,
    webhook.url,
    webhook.secret
  );
}

export async function retryDelivery(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { webhook: true },
  });

  if (!delivery) {
    throw new AppError(404, 'NOT_FOUND', 'Delivery not found');
  }

  if (!delivery.webhook.isActive) {
    throw new AppError(400, 'WEBHOOK_INACTIVE', 'Webhook is inactive');
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'PENDING',
      attempts: 0,
      nextRetryAt: null,
      responseStatus: null,
      responseBody: null,
      errorMessage: null,
    },
  });

  if (process.env.REDIS_URL) {
    await webhookQueue.add(
      `delivery-${delivery.id}`,
      {
        deliveryId: delivery.id,
        webhookId: delivery.webhookId,
        event: delivery.event,
        payload: delivery.payload as Record<string, unknown>,
        url: delivery.webhook.url,
        secret: delivery.webhook.secret,
        attempt: 0,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
      }
    );
  } else {
    await deliverDirectly(
      delivery.id,
      delivery.event,
      delivery.payload as Record<string, unknown>,
      delivery.webhook.url,
      delivery.webhook.secret
    );
  }
}

