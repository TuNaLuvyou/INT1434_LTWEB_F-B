import { Request, Response, NextFunction } from 'express';

export function globalErrorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err.name === 'UnauthorizedError' || err.statusCode === 401) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Vui lòng đăng nhập để tiếp tục'
    });
  }
  if (err.statusCode === 403) {
    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền thực hiện thao tác này'
    });
  }

  console.error('[Error Handler]', err);
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
}
