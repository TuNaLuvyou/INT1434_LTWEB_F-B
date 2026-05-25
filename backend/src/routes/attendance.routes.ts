import { Router } from 'express';
import { 
  checkIn, 
  checkOut, 
  getToday, 
  getHistory, 
  approve, 
  manualCheckIn, 
  getReport,
  submitProfileRequest,
  getProfileRequests,
  approveProfileRequest,
  rejectProfileRequest
} from '../controllers/attendance.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireDeviceToken } from '../middlewares/device.middleware';

const router = Router();

router.post('/checkin', authMiddleware, requireDeviceToken, checkIn);
router.post('/checkout', authMiddleware, requireDeviceToken, checkOut);
router.get('/today', authMiddleware, getToday);
router.get('/history', authMiddleware, requireRole(['ADMIN', 'MANAGER']), getHistory);

router.patch('/:id/approve', authMiddleware, requireRole(['ADMIN', 'MANAGER']), approve);
router.post('/manual-checkin', authMiddleware, requireRole(['ADMIN', 'MANAGER']), manualCheckIn);
router.get('/report', authMiddleware, requireRole(['ADMIN', 'MANAGER']), getReport);

import fs from 'fs';
import path from 'path';

// Profile Request workflow
router.post('/profile-requests', authMiddleware, submitProfileRequest);
router.get('/my-profile-requests', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const reqFilePath = path.join(__dirname, '../../profile_requests.json');
    let requests = [];
    if (fs.existsSync(reqFilePath)) {
      requests = JSON.parse(fs.readFileSync(reqFilePath, 'utf8'));
    }
    const myRequests = requests.filter((r: any) => r.userId === userId);
    res.status(200).json({ success: true, data: myRequests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});
router.get('/profile-requests', authMiddleware, requireRole(['ADMIN', 'MANAGER']), getProfileRequests);
router.post('/profile-requests/:id/approve', authMiddleware, requireRole(['ADMIN', 'MANAGER']), approveProfileRequest);
router.post('/profile-requests/:id/reject', authMiddleware, requireRole(['ADMIN', 'MANAGER']), rejectProfileRequest);

export default router;
