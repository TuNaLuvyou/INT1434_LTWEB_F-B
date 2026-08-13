import { Request, Response, NextFunction } from 'express';
import { verifyApiKey } from '../services/apiKey.service';
import { ApiResponse } from '../utils/response';

export interface ApiKeyRequest extends Request {
  apiKey?: {
    tenantId: string;
    keyId: string;
  };
}

/**
 * Middleware xác thực API Key qua header `x-api-key`.
 * - required=true  → thiếu header sẽ trả lỗi 401 (dùng cho endpoint bắt buộc key).
 * - required=false → thiếu header thì bỏ qua (cho phép khách vãng lai),
 *   nhưng nếu CÓ header mà key sai vẫn trả lỗi.
 */
async function verifyApiKeyHeader(req: ApiKeyRequest, res: Response, next: NextFunction, required: boolean): Promise<void> {
  const header = req.headers['x-api-key'] as string;
  if (!header) {
    if (required) {
      ApiResponse.error(res, 'MISSING_API_KEY', 'Missing X-API-Key header', 401);
    } else {
      next();
    }
    return;
  }

  try {
    const result = await verifyApiKey(header);
    req.apiKey = result;
    if (!req.query.tenantId) {
      (req.query as any).tenantId = result.tenantId;
    }
    next();
  } catch (err: any) {
    ApiResponse.error(res, err.code || 'UNAUTHORIZED', err.message, err.statusCode || 401);
  }
}

export const apiKeyGuard = (req: ApiKeyRequest, res: Response, next: NextFunction) =>
  verifyApiKeyHeader(req, res, next, true);

export const optionalApiKeyGuard = (req: ApiKeyRequest, res: Response, next: NextFunction) =>
  verifyApiKeyHeader(req, res, next, false);
