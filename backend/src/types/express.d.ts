import { Role } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: Role;
        tenantId?: string;
        branchId?: string;
        customRole?: string;
        permissions?: string[];
      };
      apiKey?: {
        tenantId: string;
        keyId: string;
      };
      device?: {
        id: string;
        label: string;
        userId: string;
      };
    }
  }
}

export {};
