import prisma from '../config/prisma';

export const createSchedule = async (data: any) => {
  return await prisma.workSchedule.create({
    data
  });
};

export const getSchedules = async (date?: string, userId?: string) => {
  const where: any = {};
  if (date) {
    const targetDate = new Date(date);
    targetDate.setUTCHours(0,0,0,0);
    where.date = targetDate;
  }
  if (userId) where.userId = userId;

  return await prisma.workSchedule.findMany({
    where,
    include: {
      user: { select: { name: true, role: true } }
    },
    orderBy: { date: 'asc' }
  });
};

export const deleteSchedule = async (id: string) => {
  return await prisma.workSchedule.delete({ where: { id } });
};
