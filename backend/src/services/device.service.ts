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
  return await prisma.trustedDevice.delete({
    where: { id }
  });
};
