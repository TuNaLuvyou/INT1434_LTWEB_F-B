import type { JWTPayload } from 'jose';

export interface AccessTokenPayload extends JWTPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'KITCHEN';
}
