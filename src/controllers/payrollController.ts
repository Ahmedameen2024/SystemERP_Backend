import { Request, Response } from 'express';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// ========== PAYROLL SHEET ==========

export const getPayrollSheets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.query;
    let sql = `
      SELECT p.*, b.name_ar AS branch_name
      FROM payrolls p
      LEFT JOIN branches b ON b.id = p.branch_id
      WHERE p.company_id = $1
    `;
    const params: unknown[] = [req.user!.companyId];

    if (month) {
      params.push(month);
      sql += ` AND p.pay_period_month = $${params.length}`;
    }
    if (year) {
      params.push(year);
      sql += ` AND p.pay_period_year = $${params.length}`;
    }

    sql += ` ORDER BY p.pay_period_year DESC, p.pay_period_month DESC, p.created_at DESC`;

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    console.error('Error fetching payroll sheets:', error);
    errorResponse(res, 'خطأ في جلب مسيرات الرواتب', 500);
  }
};

export const getPayrollLines = async (req: Request, res: Response): Promise<void> => {
  try {
    const { payrollId } = req.params;
    const result = await query(
      `SELECT pl.*, e.name_ar AS employee_name, e.employee_number, e.job_title, d.name_ar AS department_name
       FROM payroll_lines pl
       JOIN employees e ON e.id = pl.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       WHERE pl.payroll_id = $1
       ORDER BY e.employee_number ASC`,
      [payrollId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    console.error('Error fetching payroll lines:', error);
    errorResponse(res, 'خطأ في جلب تفاصيل مسير الرواتب', 500);
  }
};

export const generatePayroll = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, branchId } = req.body;
    const currentMonth = Number(month || new Date().getMonth() + 1);
    const currentYear = Number(year || new Date().getFullYear());
    const activeBranchId = branchId || req.user!.branchId;

    // Fetch active employees
    const employeesRes = await query(
      `SELECT id, basic_salary FROM employees 
       WHERE status = 'Active' 
         AND (branch_id = $1 OR $1 IS NULL OR branch_id IN (SELECT id FROM branches WHERE company_id = $2))`,
      [activeBranchId, req.user!.companyId]
    );

    const employees = employeesRes.rows;
    if (employees.length === 0) {
      errorResponse(res, 'لا يوجد موظفون نشطون لإصدار مسير الرواتب', 400);
      return;
    }

    const payrollNumber = `PAY-${currentYear}-${String(currentMonth).padStart(2, '0')}-${Date.now().toString().slice(-4)}`;

    await transaction(async (client) => {
      let totalBasic = 0;
      let totalAllowances = 0;
      let totalDeductions = 0;
      let totalNet = 0;

      // Create Payroll Header
      const headerRes = await client.query(
        `INSERT INTO payrolls 
          (payroll_number, company_id, branch_id, pay_period_month, pay_period_year, 
           total_basic_salary, total_allowances, total_deductions, total_net_salary, employee_count, status, created_by)
         VALUES ($1, $2, $3, $4, $5, 0, 0, 0, 0, $6, 'Draft', $7)
         RETURNING id`,
        [payrollNumber, req.user!.companyId, activeBranchId, currentMonth, currentYear, employees.length, req.user!.userId]
      );
      const payrollId = headerRes.rows[0].id;

      for (const emp of employees) {
        const basic = Number(emp.basic_salary || 0);
        const housing = basic * 0.25; // standard housing allowance 25%
        const transport = basic * 0.10; // transport 10%
        const gosi = basic * 0.0975; // Saudi GOSI deduction ~9.75%
        const allowances = housing + transport;
        const deductions = gosi;
        const gross = basic + allowances;
        const net = gross - deductions;

        totalBasic += basic;
        totalAllowances += allowances;
        totalDeductions += deductions;
        totalNet += net;

        await client.query(
          `INSERT INTO payroll_lines 
            (payroll_id, employee_id, basic_salary, housing_allowance, transport_allowance, 
             total_allowances, gosi_employee, total_deductions, gross_salary, net_salary, work_days)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 30)`,
          [payrollId, emp.id, basic, housing, transport, allowances, gosi, deductions, gross, net]
        );
      }

      // Update header totals
      await client.query(
        `UPDATE payrolls 
         SET total_basic_salary = $1, total_allowances = $2, total_deductions = $3, total_net_salary = $4
         WHERE id = $5`,
        [totalBasic, totalAllowances, totalDeductions, totalNet, payrollId]
      );

      successResponse(res, { id: payrollId, payrollNumber, employeeCount: employees.length, totalNet }, 'تم توليد مسير الرواتب بنجاح', 201);
    });
  } catch (error: any) {
    console.error('Error generating payroll:', error);
    errorResponse(res, error.message || 'خطأ في توليد مسير الرواتب', 500);
  }
};

// ========== ALLOWANCES & DEDUCTIONS ==========

export const getAllowancesAndDeductions = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowancesRes = await query(
      `SELECT * FROM allowance_types WHERE company_id = $1 OR company_id IS NULL ORDER BY created_at DESC`,
      [req.user!.companyId]
    );

    const deductionsRes = await query(
      `SELECT * FROM deduction_types WHERE company_id = $1 OR company_id IS NULL ORDER BY created_at DESC`,
      [req.user!.companyId]
    );

    successResponse(res, {
      allowances: allowancesRes.rows,
      deductions: deductionsRes.rows,
    });
  } catch (error) {
    console.error('Error fetching allowances and deductions:', error);
    errorResponse(res, 'خطأ في جلب البدلات والاستقطاعات', 500);
  }
};

export const createAllowanceType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, calculationMethod, isTaxable, glAccountId } = req.body;
    if (!nameAr) {
      errorResponse(res, 'اسم البدل مطلوب', 400);
      return;
    }

    const allowanceCode = code || `ALW-${Date.now().toString().slice(-4)}`;

    const result = await query(
      `INSERT INTO allowance_types (company_id, code, name_ar, name_en, calculation_method, is_taxable, gl_account_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Active')
       RETURNING *`,
      [req.user!.companyId, allowanceCode, nameAr, nameEn || nameAr, calculationMethod || 'Fixed', isTaxable || false, glAccountId || null]
    );

    successResponse(res, result.rows[0], 'تم إضافة نوع البدل بنجاح', 201);
  } catch (error: any) {
    console.error('Error creating allowance type:', error);
    errorResponse(res, error.message || 'خطأ في إضافة نوع البدل', 500);
  }
};

export const createDeductionType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, calculationMethod, glAccountId } = req.body;
    if (!nameAr) {
      errorResponse(res, 'اسم الاستقطاع مطلوب', 400);
      return;
    }

    const deductionCode = code || `DED-${Date.now().toString().slice(-4)}`;

    const result = await query(
      `INSERT INTO deduction_types (company_id, code, name_ar, name_en, calculation_method, gl_account_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Active')
       RETURNING *`,
      [req.user!.companyId, deductionCode, nameAr, nameEn || nameAr, calculationMethod || 'Fixed', glAccountId || null]
    );

    successResponse(res, result.rows[0], 'تم إضافة نوع الاستقطاع بنجاح', 201);
  } catch (error: any) {
    console.error('Error creating deduction type:', error);
    errorResponse(res, error.message || 'خطأ في إضافة نوع الاستقطاع', 500);
  }
};
