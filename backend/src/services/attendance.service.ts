import prisma from '../config/prisma';

export const getTodayAttendance = async (userId: string) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.attendance.findFirst({
    where: {
      userId,
      checkInAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    orderBy: { checkInAt: 'desc' }
  });
};

export const getAllTodayAttendance = async () => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  return await prisma.attendance.findMany({
    where: {
      checkInAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    },
    include: {
      user: { select: { name: true, email: true, role: true } },
      device: { select: { label: true } }
    },
    orderBy: { checkInAt: 'desc' }
  });
};

export const checkIn = async (userId: string, deviceId: string) => {
  return await prisma.attendance.create({
    data: {
      userId,
      deviceId,
      checkInAt: new Date()
    },
    include: {
      device: { select: { label: true } }
    }
  });
};

export const checkOut = async (attendanceId: string) => {
  return await prisma.attendance.update({
    where: { id: attendanceId },
    data: { checkOutAt: new Date() }
  });
};

export const getHistory = async (userId?: string, from?: string, to?: string) => {
  const whereClause: any = {};
  if (userId) whereClause.userId = userId;
  if (from || to) {
    whereClause.checkInAt = {};
    if (from) whereClause.checkInAt.gte = new Date(from);
    if (to) whereClause.checkInAt.lte = new Date(to);
  }

  return await prisma.attendance.findMany({
    where: whereClause,
    include: {
      user: { select: { name: true, email: true, role: true } },
      device: { select: { label: true } }
    },
    orderBy: { checkInAt: 'desc' }
  });
};

export const approveAttendance = async (id: string, isApproved: boolean, approvedBy: string, note?: string) => {
  return await prisma.attendance.update({
    where: { id },
    data: {
      isApproved,
      approvedBy,
      ...(note !== undefined && { note })
    }
  });
};

export const manualCheckIn = async (userId: string, checkInAt: Date, approvedBy: string, checkOutAt?: Date, note?: string) => {
  return await prisma.attendance.create({
    data: {
      userId,
      deviceId: 'MANUAL_ENTRY',
      checkInAt,
      checkOutAt,
      note,
      isApproved: true,
      approvedBy
    }
  });
};

export const getReport = async (from: string, to: string, userId?: string) => {
  const whereClause: any = {
    checkInAt: {
      gte: new Date(from),
      lte: new Date(to)
    }
  };
  if (userId) whereClause.userId = userId;

  return await prisma.attendance.findMany({
    where: whereClause,
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      device: { select: { label: true } }
    },
    orderBy: { checkInAt: 'asc' }
  });
};
