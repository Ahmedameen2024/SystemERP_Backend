import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import * as payroll from '../controllers/payrollController';

const router = Router();
router.use(authenticate);

// Payroll Sheets
router.get('/sheet', authorize('payroll', 'payroll_sheet', 'view'), payroll.getPayrollSheets);
router.get('/sheet/:payrollId/lines', authorize('payroll', 'payroll_sheet', 'view'), payroll.getPayrollLines);
router.post('/generate', authorize('payroll', 'payroll_sheet', 'create'), payroll.generatePayroll);

// Allowances & Deductions
router.get('/allowances-deductions', authorize('payroll', 'allowances_deductions', 'view'), payroll.getAllowancesAndDeductions);
router.post('/allowance-types', authorize('payroll', 'allowances_deductions', 'create'), payroll.createAllowanceType);
router.post('/deduction-types', authorize('payroll', 'allowances_deductions', 'create'), payroll.createDeductionType);

export default router;

