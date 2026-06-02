import { requireRole } from '../auth.middleware';
import { Request, Response, NextFunction } from 'express';

describe('requireRole middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { user: undefined } as any;
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should return 401 when no token provided', () => {
    const middleware = requireRole(['ADMIN']);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Vui lòng đăng nhập để tiếp tục'
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 when role is STAFF and required is ADMIN', () => {
    req.user = { userId: '1', email: 'test@test.com', role: 'STAFF' } as any;
    
    const middleware = requireRole(['ADMIN']);
    middleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      code: 'FORBIDDEN',
      message: 'Bạn không có quyền thực hiện thao tác này'
    });
    expect(console.warn).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test('should call next() when role matches', () => {
    req.user = { userId: '1', email: 'test@test.com', role: 'ADMIN' } as any;
    
    const middleware = requireRole(['ADMIN', 'MANAGER']);
    middleware(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
