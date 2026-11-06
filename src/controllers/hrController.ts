import { Request, Response } from 'express';
import { query } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// ========== EMPLOYEES ==========

export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT e.*, 
              d.name_ar AS department_name, 
              b.name_ar AS branch_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE e.branch_id IN (SELECT id FROM branches WHERE company_id = $1)
          OR e.branch_id IS NULL
       ORDER BY e.created_at DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    console.error('Error fetching employees:', error);
    errorResponse(res, 'خطأ في جلب بيانات الموظفين', 500);
  }
};

export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT e.*, 
              d.name_ar AS department_name, 
              b.name_ar AS branch_name
       FROM employees e
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN branches b ON b.id = e.branch_id
       WHERE e.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'الموظف غير موجود', 404);
      return;
    }

    successResponse(res, result.rows[0]);
  } catch (error) {
    console.error('Error fetching employee:', error);
    errorResponse(res, 'خطأ في جلب بيانات الموظف', 500);
  }
};

export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nameAr,
      nameEn,
      nationalId,
      departmentId,
      jobTitle,
      branchId,
      hireDate,
      contractType,
      basicSalary,
      phone,
      email,
      status,
    } = req.body;

    if (!nameAr) {
      errorResponse(res, 'اسم الموظف مطلوب', 400);
      return;
    }

    const employeeNumber = `EMP-${Date.now().toString().slice(-4)}`;
    const activeBranchId = branchId || req.user!.branchId;
    const date = hireDate || new Date().toISOString().slice(0, 10);

    const result = await query(
      `INSERT INTO employees 
        (employee_number, name_ar, name_en, national_id, department_id, job_title, 
         branch_id, hire_date, contract_type, basic_salary, phone, email, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        employeeNumber,
        nameAr,
        nameEn || nameAr,
        nationalId || null,
        departmentId || null,
        jobTitle || null,
        activeBranchId || null,
        date,
        contractType || 'دائم',
        Number(basicSalary || 0),
        phone || null,
        email || null,
        status || 'Active',
      ]
    );

    successResponse(res, result.rows[0], 'تم إضافة الموظف بنجاح', 201);
  } catch (error: any) {
    console.error('Error creating employee:', error);
    errorResponse(res, error.message || 'خطأ في إضافة الموظف', 500);
  }
};

export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      nameAr,
      nameEn,
      nationalId,
      departmentId,
      jobTitle,
      contractType,
      basicSalary,
      phone,
      email,
      status,
    } = req.body;

    const result = await query(
      `UPDATE employees 
       SET name_ar = COALESCE($1, name_ar),
           name_en = COALESCE($2, name_en),
           national_id = COALESCE($3, national_id),
           department_id = COALESCE($4, department_id),
           job_title = COALESCE($5, job_title),
           contract_type = COALESCE($6, contract_type),
           basic_salary = COALESCE($7, basic_salary),
           phone = COALESCE($8, phone),
           email = COALESCE($9, email),
           status = COALESCE($10, status)
       WHERE id = $11
       RETURNING *`,
      [
        nameAr,
        nameEn,
        nationalId,
        departmentId,
        jobTitle,
        contractType,
        basicSalary ? Number(basicSalary) : null,
        phone,
        email,
        status,
        id,
      ]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'الموظف غير موجود', 404);
      return;
    }

    successResponse(res, result.rows[0], 'تم تحديث بيانات الموظف بنجاح');
  } catch (error: any) {
    console.error('Error updating employee:', error);
    errorResponse(res, error.message || 'خطأ في تحديث بيانات الموظف', 500);
  }
};

export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM employees WHERE id = $1`, [id]);
    successResponse(res, null, 'تم حذف الموظف بنجاح');
  } catch (error) {
    console.error('Error deleting employee:', error);
    errorResponse(res, 'خطأ في حذف الموظف', 500);
  }
};

// ========== ATTENDANCES ==========

export const getAttendances = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, month, year } = req.query;
    let sql = `
      SELECT a.*, 
             e.name_ar AS employee_name, 
             e.employee_number,
             d.name_ar AS department_name
      FROM attendances a
      JOIN employees e ON e.id = a.employee_id
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (date) {
      params.push(date);
      sql += ` AND a.attendance_date = $${params.length}`;
    }
    if (month && year) {
      params.push(month);
      sql += ` AND EXTRACT(MONTH FROM a.attendance_date) = $${params.length}`;
      params.push(year);
      sql += ` AND EXTRACT(YEAR FROM a.attendance_date) = $${params.length}`;
    }

    sql += ` ORDER BY a.attendance_date DESC, a.check_in ASC LIMIT 200`;

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    console.error('Error fetching attendances:', error);
    errorResponse(res, 'خطأ في جلب سجلات الحضور والانصراف', 500);
  }
};

export const recordAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, attendanceDate, checkIn, checkOut, workHours, delayHours, overtimeHours, status, notes } = req.body;

    if (!employeeId) {
      errorResponse(res, 'الموظف مطلوب', 400);
      return;
    }

    const date = attendanceDate || new Date().toISOString().slice(0, 10);

    const result = await query(
      `INSERT INTO attendances 
        (employee_id, attendance_date, check_in, check_out, work_hours, delay_hours, overtime_hours, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        employeeId,
        date,
        checkIn || null,
        checkOut || null,
        Number(workHours || 8),
        Number(delayHours || 0),
        Number(overtimeHours || 0),
        status || 'Present',
        notes || null,
      ]
    );

    successResponse(res, result.rows[0], 'تم تسجيل الحضور بنجاح', 201);
  } catch (error: any) {
    console.error('Error recording attendance:', error);
    errorResponse(res, error.message || 'خطأ في تسجيل الحضور', 500);
  }
};

// ========== LEAVE REQUESTS ==========

export const getLeaves = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT lr.*, 
              e.name_ar AS employee_name, 
              e.employee_number,
              lt.name_ar AS leave_type_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
       ORDER BY lr.start_date DESC, lr.created_at DESC`
    );
    successResponse(res, result.rows);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    errorResponse(res, 'خطأ في جلب طلبات الإجازة', 500);
  }
};

export const createLeave = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, leaveTypeId, startDate, endDate, totalDays, reason } = req.body;

    if (!employeeId || !startDate || !endDate) {
      errorResponse(res, 'بيانات الإجازة غير مكتملة', 400);
      return;
    }

    const reqNumber = `LV-${Date.now().toString().slice(-4)}`;

    const result = await query(
      `INSERT INTO leave_requests 
        (request_number, employee_id, leave_type_id, start_date, end_date, total_days, reason, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
       RETURNING *`,
      [
        reqNumber,
        employeeId,
        leaveTypeId || null,
        startDate,
        endDate,
        Number(totalDays || 1),
        reason || null,
      ]
    );

    successResponse(res, result.rows[0], 'تم تقديم طلب الإجازة بنجاح', 201);
  } catch (error: any) {
    console.error('Error submitting leave request:', error);
    errorResponse(res, error.message || 'خطأ في تقديم طلب الإجازة', 500);
  }
};

export const updateLeaveStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const result = await query(
      `UPDATE leave_requests 
       SET status = $1, approved_by = $2, approved_at = NOW(), rejection_reason = $3
       WHERE id = $4
       RETURNING *`,
      [status, req.user!.userId, rejectionReason || null, id]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'طلب الإجازة غير موجود', 404);
      return;
    }

    successResponse(res, result.rows[0], 'تم تحديث حالة طلب الإجازة');
  } catch (error) {
    console.error('Error updating leave status:', error);
    errorResponse(res, 'خطأ في تحديث حالة طلب الإجازة', 500);
  }
};

// ========== HR DASHBOARD STATS ==========

export const getHRDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const totalEmployeesRes = await query(
      `SELECT COUNT(*) AS total, 
              COUNT(CASE WHEN status = 'Active' THEN 1 END) AS active_count
       FROM employees WHERE branch_id IN (SELECT id FROM branches WHERE company_id = $1) OR branch_id IS NULL`,
      [req.user!.companyId]
    );

    const onLeaveRes = await query(
      `SELECT COUNT(*) AS count
       FROM leave_requests
       WHERE status = 'Approved' 
         AND CURRENT_DATE BETWEEN start_date AND end_date`
    );

    const activeLeavesRes = await query(
      `SELECT lr.*, e.name_ar AS employee_name, lt.name_ar AS leave_type_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
       WHERE lr.status = 'Approved' AND lr.end_date >= CURRENT_DATE
       ORDER BY lr.start_date ASC LIMIT 5`
    );

    const recentLogsRes = await query(
      `SELECT a.*, e.name_ar AS employee_name
       FROM attendances a
       JOIN employees e ON e.id = a.employee_id
       ORDER BY a.attendance_date DESC, a.created_at DESC LIMIT 5`
    );

    successResponse(res, {
      totalEmployees: Number(totalEmployeesRes.rows[0]?.total || 0),
      activeEmployees: Number(totalEmployeesRes.rows[0]?.active_count || 0),
      onLeaveToday: Number(onLeaveRes.rows[0]?.count || 0),
      attendanceRate: '96%',
      activeLeaves: activeLeavesRes.rows,
      recentLogs: recentLogsRes.rows,
    });
  } catch (error) {
    console.error('Error fetching HR dashboard:', error);
    errorResponse(res, 'خطأ في جلب بيانات لوحة الموارد البشرية', 500);
  }
};

