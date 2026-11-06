import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as hr from '../controllers/hrController';

const router = Router();
router.use(authenticate);

// Employees
router.get('/employees', authorize('hr', 'employees', 'view'), hr.getEmployees);
router.get('/employees/:id', authorize('hr', 'employees', 'view'), hr.getEmployeeById);
router.post('/employees', authorize('hr', 'employees', 'create'), hr.createEmployee);
router.put('/employees/:id', authorize('hr', 'employees', 'edit'), hr.updateEmployee);
router.delete('/employees/:id', authorize('hr', 'employees', 'delete'), hr.deleteEmployee);

// Attendance
router.get('/attendances', authorize('hr', 'attendance', 'view'), hr.getAttendances);
router.post('/attendances', authorize('hr', 'attendance', 'create'), hr.recordAttendance);

// Leaves
router.get('/leaves', authorize('hr', 'leave_management', 'view'), hr.getLeaves);
router.post('/leaves', authorize('hr', 'leave_management', 'create'), hr.createLeave);
router.put('/leaves/:id/status', authorize('hr', 'leave_management', 'approve'), hr.updateLeaveStatus);

// Dashboard
router.get('/dashboard', authorize('hr', 'hr_dashboard', 'view'), hr.getHRDashboard);

export default router;
