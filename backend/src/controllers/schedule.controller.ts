import { Request, Response } from 'express';
import * as scheduleService from '../services/schedule.service';
import { z } from 'zod';

const createScheduleSchema = z.object({
  userId: z.string(),
  date: z.string(),
  shiftStart: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  shiftEnd: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format'),
  position: z.string(),
  note: z.string().optional()
});

export const createSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = createScheduleSchema.parse(req.body);
    const assignedBy = req.user?.userId;

    if (!assignedBy) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    if (data.shiftStart >= data.shiftEnd) {
      res.status(400).json({ success: false, message: 'Thời gian kết thúc phải lớn hơn thời gian bắt đầu' });
      return;
    }

    const scheduleDate = new Date(data.date);
    scheduleDate.setUTCHours(0,0,0,0);
    
    const today = new Date();
    today.setUTCHours(0,0,0,0);

    if (scheduleDate < today) {
      res.status(400).json({ success: false, message: 'Không thể xếp ca cho ngày trong quá khứ' });
      return;
    }

    const schedule = await scheduleService.createSchedule({
      userId: data.userId,
      date: scheduleDate,
      shiftStart: data.shiftStart,
      shiftEnd: data.shiftEnd,
      position: data.position,
      note: data.note,
      assignedBy
    });

    console.log(`[Notification] Manager ${assignedBy} xếp ca cho User ${data.userId} ngày ${data.date}`);
    // Hướng phát triển: push notification qua Socket.io

    res.status(201).json({ success: true, data: { schedule } });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ', errors: error.issues });
    } else if (error.code === 'P2002') {
      res.status(400).json({ success: false, message: 'Nhân viên này đã được xếp ca trong ngày hôm đó' });
    } else {
      console.error('createSchedule error:', error);
      res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
    }
  }
};

export const getSchedules = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    const { date, userId } = req.query;

    let targetUserId = userId as string;
    // Staff/Kitchen chỉ xem của mình
    if (user?.role === 'STAFF' || user?.role === 'KITCHEN') {
      targetUserId = user.userId;
    }

    const schedules = await scheduleService.getSchedules(date as string, targetUserId);
    res.status(200).json({ success: true, data: { schedules } });
  } catch (error) {
    console.error('getSchedules error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};

export const deleteSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const schedule = await scheduleService.getSchedules().then(s => s.find(x => x.id === id));
    
    if (!schedule) {
      res.status(404).json({ success: false, message: 'Không tìm thấy ca làm việc' });
      return;
    }

    const today = new Date();
    today.setUTCHours(0,0,0,0);

    if (new Date(schedule.date) <= today) {
      res.status(400).json({ success: false, message: 'Không thể xóa ca của ngày hôm nay hoặc quá khứ' });
      return;
    }

    await scheduleService.deleteSchedule(id);
    res.status(200).json({ success: true, message: 'Đã xóa ca làm việc' });
  } catch (error) {
    console.error('deleteSchedule error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
};
