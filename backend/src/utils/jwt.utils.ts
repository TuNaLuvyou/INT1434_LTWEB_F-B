import jwt from 'jsonwebtoken';
import { AccessTokenPayload, RefreshTokenPayload } from '../types/auth.types';

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'fallback_access_secret';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_secret';
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || '15m';
const REFRESH_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || '7d';

export const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES as any });
};

export const generateRefreshToken = (payload: RefreshTokenPayload): string => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES as any });
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, ACCESS_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, REFRESH_SECRET) as RefreshTokenPayload;
};

const QR_SECRET = process.env.JWT_QR_SECRET || 'qr_fallback_secret_must_change';

export interface QrTokenPayload {
  tenantId: string;
  branchId: string;
  tableId: string;
}

export const generateQrToken = (payload: QrTokenPayload): string => {
  // Không có expiresIn để QR không bị hết hạn
  return jwt.sign(payload, QR_SECRET);
};

export const verifyQrToken = (token: string): QrTokenPayload => {
  return jwt.verify(token, QR_SECRET) as QrTokenPayload;
};
