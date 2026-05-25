import prisma from '../config/prisma';
import crypto from 'crypto';

export const getAllDevices = async () => {
  return await prisma.trustedDevice.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
};

export const registerDevice = async (userId: string, label: string) => {
  const token = crypto.randomUUID();
  const device = await prisma.trustedDevice.create({
    data: {
      userId,
      label,
      token,
    }
  });
  return device; // includes token (only returned once)
};

export const revokeDevice = async (id: string) => {
  return await prisma.$transaction(async (tx) => {
    // Delete all attendance logs associated with this device first to satisfy foreign key constraints
    await tx.attendance.deleteMany({
      where: { deviceId: id }
    });
    // Now delete the device
    return await tx.trustedDevice.delete({
      where: { id }
    });
  });
};
