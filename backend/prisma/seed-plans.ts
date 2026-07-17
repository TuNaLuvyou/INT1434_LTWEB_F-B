import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seed Subscription Plans...');
  
  const plans = [
    { name: 'Starter', price: 500000 },
    { name: 'Professional', price: 1000000 },
    { name: 'Enterprise', price: 2000000 }
  ];

  for (const p of plans) {
    const plan = await prisma.subscriptionPlan.upsert({
      where: { name: p.name },
      update: {},
      create: {
        name: p.name,
        price: p.price,
        description: `Gói ${p.name}`
      }
    });

    // Setup limits
    let limits: Record<string, number> = {};
    if (p.name === 'Starter') {
      limits = { BRANCH: 1, USER: 5, TABLE: 15 };
    } else if (p.name === 'Professional') {
      limits = { BRANCH: 3, USER: 15, TABLE: 50 };
    } else {
      limits = { BRANCH: 9999, USER: 9999, TABLE: 9999 }; // Unlimited
    }

    for (const [res, max] of Object.entries(limits)) {
      await prisma.usageLimit.upsert({
        where: { planId_resourceCode: { planId: plan.id, resourceCode: res } },
        update: { maxLimit: max },
        create: {
          planId: plan.id,
          resourceCode: res,
          maxLimit: max
        }
      });
    }

    // Setup Features
    let features: string[] = [];
    if (p.name === 'Professional') {
      features = ['KDS_ACCESS', 'PROMOTION_ENGINE'];
    } else if (p.name === 'Enterprise') {
      features = ['KDS_ACCESS', 'PROMOTION_ENGINE', 'WHITE_LABEL', 'MEMBERSHIP', 'API_ACCESS'];
    }

    for (const code of features) {
      await prisma.planFeature.upsert({
        where: { planId_code: { planId: plan.id, code } },
        update: { isActive: true },
        create: {
          planId: plan.id,
          code: code,
          isActive: true
        }
      });
    }
  }

  console.log('Done!');
}

main().finally(() => prisma.$disconnect());
