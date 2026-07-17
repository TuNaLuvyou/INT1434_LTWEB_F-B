import prisma from './src/config/prisma';
async function test() {
  const tenants = await prisma.tenant.findMany({
    include: {
      subscription: {
        include: {
          plan: {
            include: { features: true }
          }
        }
      }
    }
  });
  console.log(JSON.stringify(tenants, null, 2));
}
test();
