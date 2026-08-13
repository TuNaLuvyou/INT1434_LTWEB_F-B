import { Queue } from 'bullmq';
import redis from '../config/redis';

export interface WebhookJobData {
  deliveryId: string;
  webhookId: string;
  event: string;
  payload: Record<string, unknown>;
  url: string;
  secret: string;
  attempt: number;
}

export const webhookQueue = process.env.REDIS_URL
  ? new Queue<WebhookJobData>('webhook-delivery', {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    })
  : ({
      add: async () => {
        console.warn('[WebhookQueue] Webhook task skipped because REDIS_URL is not configured.');
      },
    } as unknown as Queue<WebhookJobData>);
