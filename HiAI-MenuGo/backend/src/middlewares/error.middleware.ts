import { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../utils/response';
import { AppError } from '../utils/app-error';

export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.name === 'UnauthorizedError' || err.statusCode === 401) {
    return ApiResponse.error(res, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục', 401);
  }
  
  if (err.statusCode === 403) {
    return ApiResponse.error(res, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này', 403);
  }

  // Handling Zod Validation Errors
  if (err.name === 'ZodError') {
    return ApiResponse.error(res, 'VALIDATION_ERROR', 'Dữ liệu đầu vào không hợp lệ', 400, err.errors);
  }

  if (err instanceof AppError) {
    return ApiResponse.error(res, err.code, err.message, err.statusCode, err.data);
  }

  console.error('[Error Handler]', err);
  const status = err.statusCode || 500;
  return ApiResponse.error(res, 'INTERNAL_SERVER_ERROR', err.message || 'Internal Server Error', status);
}
