import { Request, Response } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import * as authService from '../services/auth.service';

const passwordSchema = z.string()
  .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
  .regex(/[A-Z]/, 'Mật khẩu phải chứa ít nhất 1 chữ hoa')
  .regex(/[0-9]/, 'Mật khẩu phải chứa ít nhất 1 số');

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: passwordSchema,
  name: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  role: z.nativeEnum(Role).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
});

const setRefreshTokenCookie = (res: Response, token: string) => {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/api/auth',
  });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerSchema.parse(req.body);
    
    const result = await authService.registerUser(validatedData);
    
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Lỗi xác thực dữ liệu', errors: error.issues });
    } else if (error.message === 'EMAIL_EXISTS') {
      res.status(409).json({ success: false, message: 'Email đã tồn tại trong hệ thống' });
    } else {
      console.error('Register error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = loginSchema.parse(req.body);
    
    const result = await authService.loginUser(validatedData.email, validatedData.password);
    
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Lỗi xác thực dữ liệu', errors: error.issues });
    } else if (error.message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ success: false, message: 'Email hoặc mật khẩu không chính xác' });
    } else if (error.message === 'ACCOUNT_INACTIVE') {
      res.status(401).json({ success: false, message: 'Tài khoản đã bị vô hiệu hóa' });
    } else {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.cookies['refresh_token'];
    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token' });
      return;
    }

    const result = await authService.refreshTokens(token);
    
    setRefreshTokenCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        accessToken: result.accessToken,
      },
    });
  } catch (error: any) {
    if (error.message === 'TOKEN_EXPIRED') {
      res.status(401).json({ success: false, message: 'Refresh token expired, please login again' });
    } else if (error.message === 'INVALID_USER' || error.name === 'JsonWebTokenError') {
      res.status(401).json({ success: false, message: 'Invalid refresh token' });
    } else if (error.message === 'ACCOUNT_INACTIVE') {
      res.status(401).json({ success: false, message: 'Account disabled' });
    } else {
      console.error('Refresh error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  res.clearCookie('refresh_token', { path: '/api/auth' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await authService.getMe(userId);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    } else {
      console.error('Me error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};
