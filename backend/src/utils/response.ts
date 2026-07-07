import { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data?: T;
  message?: string;
  meta?: any;
}

interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  errors?: any;
}

export class ApiResponse {
  static success<T>(res: Response, data?: T, message?: string, meta?: any, statusCode = 200) {
    const response: SuccessResponse<T> = { success: true };
    if (data !== undefined) response.data = data;
    if (message) response.message = message;
    if (meta) response.meta = meta;
    
    return res.status(statusCode).json(response);
  }

  static error(res: Response, code: string, message: string, statusCode = 400, errors?: any) {
    const response: ErrorResponse = { success: false, code, message };
    if (errors) response.errors = errors;

    return res.status(statusCode).json(response);
  }
}
