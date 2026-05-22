import { Role } from '@prisma/client';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload {
  userId: string;
}
