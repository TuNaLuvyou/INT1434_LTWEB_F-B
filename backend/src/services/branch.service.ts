import prisma from '../config/prisma';
import { checkUsageLimit } from './usage-limit.service';

export const listBranches = async (tenantId: string) => {
  return prisma.branch.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
};

export const createBranch = async (tenantId: string, name: string, address?: string) => {
  await checkUsageLimit(tenantId, 'BRANCH');

  return prisma.branch.create({
    data: { tenantId, name, address },
  });
};

export const updateBranch = async (id: string, tenantId: string, data: { name?: string; address?: string; isActive?: boolean }) => {
  const branch = await prisma.branch.findFirst({ where: { id, tenantId } });
  if (!branch) throw new Error('BRANCH_NOT_FOUND');

  return prisma.branch.update({
    where: { id },
    data,
  });
};
