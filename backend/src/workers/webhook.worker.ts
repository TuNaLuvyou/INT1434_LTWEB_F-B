import { Worker, Job } from 'bullmq';
import crypto from 'crypto';
import prisma from '../config/prisma';
import redis from '../config/redis';
import { WebhookJobData } from '../queues/webhook.queue';
import { WebhookDeliveryStatus } from '@prisma/client';
import { logger } from '../utils/logger';

const worker = process.env.REDIS_URL
  ? new Worker<WebhookJobData>(
      'webhook-delivery',
      async (job: Job<WebhookJobData>) => {
        const { deliveryId, event, payload, url, secret } = job.data;

        const body = JSON.stringify(payload);
        const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');

        let response: Response;
        try {
          response = await fetch(url, {
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
        } catch (fetchError: any) {
          const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 5);
          const status: WebhookDeliveryStatus = isLastAttempt ? 'FAILED' : 'RETRYING';

          await prisma.webhookDelivery.update({
            where: { id: deliveryId },
            data: {
              status,
              attempts: job.attemptsMade,
              errorMessage: fetchError.message,
              nextRetryAt: isLastAttempt ? null : new Date(Date.now() + getBackoffDelay(job.attemptsMade)),
            },
          });

          if (isLastAttempt) {
            logger.warn('WebhookWorker', `Delivery ${deliveryId} failed after ${job.attemptsMade} attempts`);
            return;
          }

          throw fetchError;
        }

        const responseBody = await response.text();
        const isSuccess = response.status >= 200 && response.status < 300;
        const status: WebhookDeliveryStatus = isSuccess ? 'SUCCESS' : 'FAILED';

        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status,
            attempts: job.attemptsMade,
            responseStatus: response.status,
            responseBody: responseBody.substring(0, 5000),
            errorMessage: isSuccess ? null : `HTTP ${response.status}`,
            nextRetryAt: null,
          },
        });

        if (!isSuccess) {
          throw new Error(`Webhook returned HTTP ${response.status}`);
        }
      },
      {
        connection: redis,
        concurrency: 10,
        lockDuration: 30000,
      }
    )
  : null;

function getBackoffDelay(attempt: number): number {
  return Math.min(5000 * Math.pow(2, attempt - 1), 300000);
}

if (worker) {
  worker.on('completed', (job: Job) => {
    logger.info('WebhookWorker', `Delivery ${job.data.deliveryId} completed`);
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    if (job) {
      logger.error('WebhookWorker', `Delivery ${job.data.deliveryId} failed: ${err.message}`);
    }
  });
}

export function startWebhookWorker(): void {
  if (worker) {
    logger.info('WebhookWorker', 'Started');
  } else {
    logger.info('WebhookWorker', 'Not started (REDIS_URL is missing)');
  }
}

export default worker;
