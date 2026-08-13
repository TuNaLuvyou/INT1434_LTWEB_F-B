import { Request, Response, NextFunction } from 'express';
import { verifyApiKey } from '../services/apiKey.service';
import { ApiResponse } from '../utils/response';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Middleware xác thực dành riêng cho Open API (v1).
 * Đọc header `x-api-key`, xác thực key qua db, và inject `req.user` với tenantId lấy từ key.
 */
export async function apiKeyAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKeyHeader = req.headers['x-api-key'] as string;
  if (!apiKeyHeader) {
    ApiResponse.error(res, 'MISSING_API_KEY', 'Missing X-API-Key header', 401);
    return;
  }

  try {
    const verified = await verifyApiKey(apiKeyHeader);
    (req as AuthenticatedRequest).user = {
      userId: `apikey:${verified.keyId}`,
      email: 'external@api.key',
      role: 'ADMIN',
      tenantId: verified.tenantId,
    };
    next();
  } catch (err: any) {
    ApiResponse.error(res, err.code || 'UNAUTHORIZED', err.message || 'Invalid API Key', err.statusCode || 401);
  }
}
