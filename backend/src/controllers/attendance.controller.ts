import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';

export const checkIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    const device = req.device;

    if (!userId || !device) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (device.userId !== userId) {
      res.status(403).json({ success: false, message: 'Bạn không thể check-in trên thiết bị của người khác' });
      return;
    }

    const todayAttendance = await attendanceService.getTodayAttendance(userId);
    if (todayAttendance && !todayAttendance.checkOutAt) {
      res.status(409).json({ success: false, code: 'ALREADY_CHECKED_IN', message: 'Bạn đã check-in hôm nay' });
      return;
    }

    const attendance = await attendanceService.checkIn(userId, device.id);
    res.status(201).json({ success: true, data: { attendance } });
  } catch (error) {
    console.error('checkIn error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const checkOut = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const todayAttendance = await attendanceService.getTodayAttendance(userId);
    if (!todayAttendance || todayAttendance.checkOutAt) {
      res.status(404).json({ success: false, message: 'Bạn chưa check-in hoặc đã check-out' });
      return;
    }

    const attendance = await attendanceService.checkOut(todayAttendance.id);
    
    // Calculate duration
    const diffMs = attendance.checkOutAt!.getTime() - attendance.checkInAt.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = `${hours} giờ ${minutes} phút`;

    res.status(200).json({ success: true, data: { attendance: { ...attendance, duration } } });
  } catch (error) {
    console.error('checkOut error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const getToday = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const attendance = await attendanceService.getTodayAttendance(userId);
    res.status(200).json({ success: true, data: { attendance } });
  } catch (error) {
    console.error('getToday error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, from, to } = req.query;
    const history = await attendanceService.getHistory(
      userId as string,
      from as string,
      to as string
    );
    res.status(200).json({ success: true, data: { history } });
  } catch (error) {
    console.error('getHistory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};
