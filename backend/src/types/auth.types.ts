import { Role } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: Role;
  tenantId?: string;
  branchId?: string;
  customRole?: string;
  permissions?: string[];
}

export interface RefreshTokenPayload {
  userId: string;
  tenantId?: string;
  branchId?: string;
}
