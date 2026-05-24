import { Request, Response } from 'express';
import * as deviceService from '../services/device.service';
import { z } from 'zod';

const registerDeviceSchema = z.object({
  userId: z.string().min(1, 'Vui lòng chọn người dùng'),
  label: z.string().min(1, 'Vui lòng nhập tên thiết bị'),
});

export const getDevices = async (req: Request, res: Response): Promise<void> => {
  try {
    const devices = await deviceService.getAllDevices();
    // Ẩn token khi trả về danh sách, chỉ trả về các trường khác
    const safeDevices = devices.map(({ token, ...rest }) => rest);
    res.status(200).json({ success: true, data: safeDevices });
  } catch (error) {
    console.error('getDevices error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const registerDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = registerDeviceSchema.parse(req.body);
    const device = await deviceService.registerDevice(validatedData.userId, validatedData.label);
    res.status(201).json({ success: true, data: { device } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: error.issues });
    } else {
      console.error('registerDevice error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};

export const revokeDevice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await deviceService.revokeDevice(id);
    res.status(200).json({ success: true, message: 'Đã thu hồi thiết bị' });
  } catch (error) {
    console.error('revokeDevice error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};
