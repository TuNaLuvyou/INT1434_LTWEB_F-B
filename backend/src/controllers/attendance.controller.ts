import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import prisma from '../config/prisma';

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

export const approve = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { isApproved, note } = req.body;
    const approvedBy = req.user?.userId;

    if (!approvedBy) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const attendance = await attendanceService.approveAttendance(id, isApproved, approvedBy, note);
    res.status(200).json({ success: true, data: { attendance } });
  } catch (error) {
    console.error('approve error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const manualCheckIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, checkInAt, checkOutAt, note } = req.body;
    const approvedBy = req.user?.userId;

    if (!approvedBy) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const checkInDate = new Date(checkInAt);
    
    const startOfDay = new Date(checkInDate);
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date(checkInDate);
    endOfDay.setHours(23,59,59,999);

    const existing = await prisma.attendance.findFirst({
      where: { userId, checkInAt: { gte: startOfDay, lte: endOfDay } }
    });

    if (existing) {
      res.status(400).json({ success: false, message: 'Nhân viên này đã có dữ liệu chấm công trong ngày' });
      return;
    }

    const attendance = await attendanceService.manualCheckIn(
      userId, 
      checkInDate, 
      approvedBy, 
      checkOutAt ? new Date(checkOutAt) : undefined, 
      note
    );
    res.status(201).json({ success: true, data: { attendance } });
  } catch (error) {
    console.error('manualCheckIn error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const getReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, userId } = req.query;
    if (!from || !to) {
      res.status(400).json({ success: false, message: 'Thiếu from, to' });
      return;
    }

    const attendances = await attendanceService.getReport(from as string, to as string, userId as string);
    
    const schedules = await prisma.workSchedule.findMany({
      where: {
        date: { gte: new Date(from as string), lte: new Date(to as string) },
        ...(userId && { userId: userId as string })
      },
      include: { user: { select: { id: true, name: true, role: true, email: true } } }
    });

    const reportMap = new Map();
    
    schedules.forEach(sch => {
      if (!reportMap.has(sch.userId)) {
        reportMap.set(sch.userId, {
          user: sch.user,
          totalHours: 0,
          presentDays: 0,
          absentDays: 0,
          attendances: []
        });
      }
      reportMap.get(sch.userId).absentDays += 1;
    });

    attendances.forEach(att => {
      if (!reportMap.has(att.userId)) {
        reportMap.set(att.userId, {
          user: att.user,
          totalHours: 0,
          presentDays: 0,
          absentDays: 0,
          attendances: []
        });
      }
      
      const userReport = reportMap.get(att.userId);
      userReport.attendances.push(att);
      userReport.presentDays += 1;
      if (userReport.absentDays > 0) userReport.absentDays -= 1;

      if (att.checkOutAt) {
        const hours = (att.checkOutAt.getTime() - att.checkInAt.getTime()) / (1000 * 60 * 60);
        userReport.totalHours += hours;
      }
    });

    const reportArray = Array.from(reportMap.values()).map(r => ({
      ...r,
      totalHours: Number(r.totalHours.toFixed(2))
    }));

    res.status(200).json({ success: true, data: { report: reportArray } });
  } catch (error) {
    console.error('getReport error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ProfileRequest {
  id: string;
  userId: string;
  userName: string;
  currentName: string;
  currentEmail: string;
  pendingName: string;
  pendingEmail: string;
  pendingPhone: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

const reqFilePath = path.join(__dirname, '../../profile_requests.json');

const readRequests = (): ProfileRequest[] => {
  try {
    if (fs.existsSync(reqFilePath)) {
      return JSON.parse(fs.readFileSync(reqFilePath, 'utf8'));
    }
  } catch (error) {
    console.error('readRequests error:', error);
  }
  return [];
};

const writeRequests = (requests: ProfileRequest[]) => {
  try {
    fs.writeFileSync(reqFilePath, JSON.stringify(requests, null, 2), 'utf8');
  } catch (error) {
    console.error('writeRequests error:', error);
  }
};

export const submitProfileRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const { pendingName, pendingEmail, pendingPhone } = req.body;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const requests = readRequests();
    const newReq: ProfileRequest = {
      id: crypto.randomUUID(),
      userId,
      userName: user.name,
      currentName: user.name,
      currentEmail: user.email,
      pendingName,
      pendingEmail,
      pendingPhone,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
    // Reject other pending requests for this user
    const updated = requests.map(r => r.userId === userId && r.status === 'PENDING' ? { ...r, status: 'REJECTED' as const } : r);
    updated.push(newReq);
    writeRequests(updated);
    res.status(201).json({ success: true, data: newReq });
  } catch (error) {
    console.error('submitProfileRequest error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const getProfileRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const requests = readRequests();
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    console.error('getProfileRequests error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const approveProfileRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requests = readRequests();
    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
      return;
    }
    const request = requests[reqIndex];
    if (request.status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Yêu cầu đã được xử lý' });
      return;
    }

    // Update the actual user model in PostgreSQL!
    await prisma.user.update({
      where: { id: request.userId },
      data: {
        name: request.pendingName,
        email: request.pendingEmail
      }
    });

    requests[reqIndex].status = 'APPROVED';
    writeRequests(requests);
    res.status(200).json({ success: true, message: 'Đã duyệt yêu cầu thay đổi thông tin' });
  } catch (error) {
    console.error('approveProfileRequest error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const rejectProfileRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requests = readRequests();
    const reqIndex = requests.findIndex(r => r.id === id);
    if (reqIndex === -1) {
      res.status(404).json({ success: false, message: 'Yêu cầu không tồn tại' });
      return;
    }
    if (requests[reqIndex].status !== 'PENDING') {
      res.status(400).json({ success: false, message: 'Yêu cầu đã được xử lý' });
      return;
    }
    requests[reqIndex].status = 'REJECTED';
    writeRequests(requests);
    res.status(200).json({ success: true, message: 'Đã từ chối yêu cầu thay đổi thông tin' });
  } catch (error) {
    console.error('rejectProfileRequest error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};
