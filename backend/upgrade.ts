import prisma from './src/config/prisma';
async function fix() {
  const p = await prisma.subscriptionPlan.findFirst({ where: { name: 'Professional' } });
  if (!p) return console.log('No plan');
  
  const tenants = await prisma.tenant.findMany({ include: { subscription: true } });
  for (const tenant of tenants) {
    if (!tenant.subscription) {
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planId: p.id,
          status: 'ACTIVE',
          startDate: new Date(),
          endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 10))
        }
      });
      console.log(`Created subscription for ${tenant.name}`);
    } else {
      await prisma.tenantSubscription.update({
        where: { id: tenant.subscription.id },
        data: { planId: p.id }
      });
      console.log(`Updated subscription for ${tenant.name}`);
    }
  }
}
fix();
