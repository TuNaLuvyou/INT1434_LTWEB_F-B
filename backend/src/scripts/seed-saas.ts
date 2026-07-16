import prisma from '../config/prisma';

async function main() {
  console.log('Seeding SaaS Plans...');

  const starter = await prisma.subscriptionPlan.upsert({
    where: { name: 'Starter' },
    update: {},
    create: {
      name: 'Starter',
      description: 'Dành cho nhà hàng nhỏ, quán cafe 1 chi nhánh.',
      price: 0, // Miễn phí
      features: {
        create: [
          { code: 'CORE_POS' },
          { code: 'CORE_ORDER' },
        ]
      },
      limits: {
        create: [
          { resourceCode: 'BRANCH', maxLimit: 1 },
          { resourceCode: 'TABLE', maxLimit: 10 },
          { resourceCode: 'USER', maxLimit: 3 },
          { resourceCode: 'MENU_ITEM', maxLimit: 50 },
        ]
      }
    }
  });

  const professional = await prisma.subscriptionPlan.upsert({
    where: { name: 'Professional' },
    update: {},
    create: {
      name: 'Professional',
      description: 'Dành cho nhà hàng cỡ trung bình, cần quản lý nhà bếp và khuyến mãi.',
      price: 499000,
      features: {
        create: [
          { code: 'CORE_POS' },
          { code: 'CORE_ORDER' },
          { code: 'KDS_ACCESS' },
          { code: 'PROMOTION_ENGINE' },
        ]
      },
      limits: {
        create: [
          { resourceCode: 'BRANCH', maxLimit: 3 },
          { resourceCode: 'TABLE', maxLimit: 50 },
          { resourceCode: 'USER', maxLimit: 15 },
          { resourceCode: 'MENU_ITEM', maxLimit: 300 },
        ]
      }
    }
  });

  const enterprise = await prisma.subscriptionPlan.upsert({
    where: { name: 'Enterprise' },
    update: {},
    create: {
      name: 'Enterprise',
      description: 'Giải pháp toàn diện cho chuỗi nhà hàng lớn.',
      price: 1499000,
      features: {
        create: [
          { code: 'CORE_POS' },
          { code: 'CORE_ORDER' },
          { code: 'KDS_ACCESS' },
          { code: 'PROMOTION_ENGINE' },
          { code: 'MEMBERSHIP' },
          { code: 'WHITE_LABEL' },
          { code: 'API_ACCESS' },
        ]
      },
      limits: {
        create: [
          { resourceCode: 'BRANCH', maxLimit: 9999 },
          { resourceCode: 'TABLE', maxLimit: 9999 },
          { resourceCode: 'USER', maxLimit: 9999 },
          { resourceCode: 'MENU_ITEM', maxLimit: 9999 },
        ]
      }
    }
  });

  console.log('Seed completed:', { starter: starter.name, professional: professional.name, enterprise: enterprise.name });
}

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
