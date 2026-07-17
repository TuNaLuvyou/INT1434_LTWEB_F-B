import prisma from './src/config/prisma';
async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return console.log("No user");
    
    const updateData: any = {
      phone: "0123",
      passwordHash: "test"
    };
    
    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });
    console.log("Update success!");
  } catch (e: any) {
    console.error("UPDATE ERROR:", e.message);
  }
}
test();
