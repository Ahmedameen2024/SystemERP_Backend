import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse, paginatedResponse, getPaginationParams } from '../utils/response';
import { PERMISSION_REGISTRY } from '../config/permissionRegistry';

// ========== COMPANIES ==========
export const getCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT c.*, cur.code as currency_code, cur.name_ar as currency_name
       FROM companies c LEFT JOIN currencies cur ON cur.id = c.base_currency_id
       WHERE c.id = $1`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows[0] || null);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب بيانات الشركة', 500);
  }
};

export const updateCompany = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nameAr, nameEn, logoPath, activity, taxNumber, crNumber, phone, email, website, address, country, city, baseCurrencyId, fiscalYearStart, fiscalYearEnd } = req.body;
    const result = await query(
      `UPDATE companies SET name_ar=$1, name_en=$2, logo_path=$3, activity=$4, tax_number=$5,
       cr_number=$6, phone=$7, email=$8, website=$9, address=$10, country=$11, city=$12,
       base_currency_id=$13, fiscal_year_start=$14, fiscal_year_end=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [nameAr, nameEn, logoPath, activity, taxNumber, crNumber, phone, email, website, address, country, city, baseCurrencyId, fiscalYearStart, fiscalYearEnd, req.user!.companyId]
    );
    successResponse(res, result.rows[0], 'تم تحديث بيانات الشركة بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث بيانات الشركة', 500);
  }
};

// ========== BRANCHES ==========
export const getBranches = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query as Record<string, string>);
    const search = req.query.search as string || '';

    const countResult = await query(
      `SELECT COUNT(*) FROM branches WHERE company_id=$1 AND (name_ar ILIKE $2 OR name_en ILIKE $2 OR code ILIKE $2)`,
      [req.user!.companyId, `%${search}%`]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT b.*, u.name_ar as manager_name FROM branches b
       LEFT JOIN users u ON u.id = b.manager_id
       WHERE b.company_id=$1 AND (b.name_ar ILIKE $2 OR b.name_en ILIKE $2 OR b.code ILIKE $2)
       ORDER BY b.created_at DESC LIMIT $3 OFFSET $4`,
      [req.user!.companyId, `%${search}%`, limit, offset]
    );
    paginatedResponse(res, result.rows, total, page, limit);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الفروع', 500);
  }
};

export const createBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, managerId, city, address, phone, email } = req.body;
    const result = await query(
      `INSERT INTO branches (company_id, code, name_ar, name_en, manager_id, city, address, phone, email)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.companyId, code, nameAr, nameEn, managerId || null, city, address, phone, email]
    );
    successResponse(res, result.rows[0], 'تم إضافة الفرع بنجاح', 201);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === '23505') {
      errorResponse(res, 'كود الفرع مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة الفرع', 500);
    }
  }
};

export const updateBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, nameAr, nameEn, managerId, city, address, phone, email, status } = req.body;
    const result = await query(
      `UPDATE branches SET code=$1,name_ar=$2,name_en=$3,manager_id=$4,city=$5,address=$6,
       phone=$7,email=$8,status=$9,updated_at=NOW() WHERE id=$10 AND company_id=$11 RETURNING *`,
      [code, nameAr, nameEn, managerId || null, city, address, phone, email, status, id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'الفرع غير موجود', 404); return; }
    successResponse(res, result.rows[0], 'تم تحديث الفرع بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث الفرع', 500);
  }
};

export const deleteBranch = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await query('UPDATE branches SET status=$1 WHERE id=$2 AND company_id=$3', ['Inactive', id, req.user!.companyId]);
    successResponse(res, null, 'تم إلغاء تفعيل الفرع بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف الفرع', 500);
  }
};

// ========== CURRENCIES ==========
export const getCurrencies = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM currencies WHERE status=$1 ORDER BY is_default DESC, code ASC', ['Active']);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب العملات', 500);
  }
};

export const createCurrency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, symbol, decimalPlaces, isDefault } = req.body;
    await transaction(async (client) => {
      if (isDefault) await client.query('UPDATE currencies SET is_default=FALSE');
      const result = await client.query(
        `INSERT INTO currencies (code, name_ar, name_en, symbol, decimal_places, is_default)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [code, nameAr, nameEn, symbol, decimalPlaces || 2, isDefault || false]
      );
      successResponse(res, result.rows[0], 'تم إضافة العملة بنجاح', 201);
    });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === '23505') {
      errorResponse(res, 'كود العملة مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة العملة', 500);
    }
  }
};

export const updateCurrency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, symbol, decimalPlaces, isDefault, status } = req.body;
    await transaction(async (client) => {
      if (isDefault) await client.query('UPDATE currencies SET is_default=FALSE WHERE id != $1', [id]);
      const result = await client.query(
        `UPDATE currencies SET name_ar=$1,name_en=$2,symbol=$3,decimal_places=$4,is_default=$5,status=$6
         WHERE id=$7 RETURNING *`,
        [nameAr, nameEn, symbol, decimalPlaces, isDefault, status, id]
      );
      if (result.rows.length === 0) { errorResponse(res, 'العملة غير موجودة', 404); return; }
      successResponse(res, result.rows[0], 'تم تحديث العملة بنجاح');
    });
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث العملة', 500);
  }
};

// ========== EXCHANGE RATES ==========
export const getExchangeRates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currencyId, fromDate, toDate } = req.query;
    let sql = `SELECT er.*, c.code as currency_code, c.name_ar as currency_name, c.symbol
               FROM exchange_rates er JOIN currencies c ON c.id = er.currency_id
               WHERE er.company_id=$1`;
    const params: unknown[] = [req.user!.companyId];
    if (currencyId) { sql += ` AND er.currency_id=$${params.length + 1}`; params.push(currencyId); }
    if (fromDate) { sql += ` AND er.rate_date >= $${params.length + 1}`; params.push(fromDate); }
    if (toDate) { sql += ` AND er.rate_date <= $${params.length + 1}`; params.push(toDate); }
    sql += ' ORDER BY er.rate_date DESC LIMIT 100';
    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب أسعار الصرف', 500);
  }
};

export const createExchangeRate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currencyId, rateDate, buyRate, sellRate, midRate } = req.body;
    const result = await query(
      `INSERT INTO exchange_rates (company_id, currency_id, rate_date, buy_rate, sell_rate, mid_rate, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (currency_id, rate_date) DO UPDATE
       SET buy_rate=$4, sell_rate=$5, mid_rate=$6, created_by=$7 RETURNING *`,
      [req.user!.companyId, currencyId, rateDate, buyRate, sellRate, midRate, req.user!.userId]
    );
    successResponse(res, result.rows[0], 'تم حفظ سعر الصرف بنجاح', 201);
  } catch (error) {
    errorResponse(res, 'خطأ في حفظ سعر الصرف', 500);
  }
};

// ========== USERS ==========
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, offset } = getPaginationParams(req.query as Record<string, string>);
    const search = req.query.search as string || '';

    const countResult = await query(
      `SELECT COUNT(*) FROM users WHERE company_id=$1 AND (username ILIKE $2 OR name_ar ILIKE $2 OR email ILIKE $2)`,
      [req.user!.companyId, `%${search}%`]
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT u.id, u.username, u.name_ar, u.name_en, u.email, u.status, u.language,
              u.last_login, u.created_at, r.name_ar as role_name, b.name_ar as branch_name
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.company_id=$1 AND (u.username ILIKE $2 OR u.name_ar ILIKE $2 OR u.email ILIKE $2)
       ORDER BY u.created_at DESC LIMIT $3 OFFSET $4`,
      [req.user!.companyId, `%${search}%`, limit, offset]
    );
    paginatedResponse(res, result.rows, total, page, limit);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب المستخدمين', 500);
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password, nameAr, nameEn, email, roleId, branchId, language } = req.body;
    if (!username || !password) { errorResponse(res, 'اسم المستخدم وكلمة المرور مطلوبان', 400); return; }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (username, password_hash, name_ar, name_en, email, role_id, company_id, branch_id, language)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, username, name_ar, name_en, email, status, created_at`,
      [username, passwordHash, nameAr, nameEn, email, roleId, req.user!.companyId, branchId || null, language || 'ar']
    );
    successResponse(res, result.rows[0], 'تم إضافة المستخدم بنجاح', 201);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === '23505') {
      errorResponse(res, 'اسم المستخدم أو البريد الإلكتروني مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة المستخدم', 500);
    }
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, email, roleId, branchId, language, status, password } = req.body;
    let passwordHash: string | undefined;
    if (password) passwordHash = await bcrypt.hash(password, 12);

    const result = await query(
      `UPDATE users SET name_ar=$1, name_en=$2, email=$3, role_id=$4, branch_id=$5, 
       language=$6, status=$7 ${passwordHash ? ', password_hash=$9' : ''}, updated_at=NOW()
       WHERE id=$8 AND company_id=${passwordHash ? '$10' : '$9'} RETURNING id, username, name_ar, status`,
      passwordHash
        ? [nameAr, nameEn, email, roleId, branchId || null, language, status, id, passwordHash, req.user!.companyId]
        : [nameAr, nameEn, email, roleId, branchId || null, language, status, id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'المستخدم غير موجود', 404); return; }
    successResponse(res, result.rows[0], 'تم تحديث المستخدم بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث المستخدم', 500);
  }
};

// ========== ROLES & PERMISSIONS ==========
export const getRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT r.id, r.company_id, r.name_ar, r.name_en, r.description, r.is_system_role, r.created_at,
              COUNT(DISTINCT u.id)::int AS user_count,
              COUNT(DISTINCT CASE WHEN u.status = 'Active' THEN u.id END)::int AS active_user_count,
              (SELECT COUNT(*)::int FROM permissions p WHERE p.role_id = r.id AND (p.can_view = TRUE OR p.can_create = TRUE OR p.can_edit = TRUE OR p.can_delete = TRUE OR p.can_approve = TRUE OR p.can_print = TRUE OR p.can_export = TRUE)) AS active_permissions_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       WHERE r.company_id=$1
       GROUP BY r.id
       ORDER BY r.is_system_role DESC, r.name_ar`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الأدوار', 500);
  }
};

export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { nameAr, nameEn, description } = req.body;
    if (!nameAr) {
      errorResponse(res, 'اسم الدور باللغة العربية مطلوب', 400);
      return;
    }
    const result = await query(
      `INSERT INTO roles (company_id, name_ar, name_en, description, is_system_role)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [req.user!.companyId, nameAr, nameEn || nameAr, description || '']
    );
    successResponse(res, result.rows[0], 'تم إضافة الدور بنجاح', 201);
  } catch (error) {
    errorResponse(res, 'خطأ في إضافة الدور', 500);
  }
};

export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { nameAr, nameEn, description } = req.body;

    const existing = await query('SELECT * FROM roles WHERE id=$1 AND company_id=$2', [id, req.user!.companyId]);
    if (existing.rows.length === 0) {
      errorResponse(res, 'الدور غير موجود', 404);
      return;
    }

    const role = existing.rows[0];
    if (role.is_system_role && (role.name_ar === 'مدير النظام' || role.name_en === 'System Administrator')) {
      // Allow updating description only, protect system role attributes
      const result = await query(
        `UPDATE roles SET description=$1 WHERE id=$2 RETURNING *`,
        [description, id]
      );
      successResponse(res, result.rows[0], 'تم تحديث وصف الدور بنجاح');
      return;
    }

    const result = await query(
      `UPDATE roles SET name_ar=$1, name_en=$2, description=$3 WHERE id=$4 AND company_id=$5 RETURNING *`,
      [nameAr || role.name_ar, nameEn || role.name_en, description, id, req.user!.companyId]
    );

    successResponse(res, result.rows[0], 'تم تحديث الدور بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث الدور', 500);
  }
};

export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query('SELECT * FROM roles WHERE id=$1 AND company_id=$2', [id, req.user!.companyId]);
    if (existing.rows.length === 0) {
      errorResponse(res, 'الدور غير موجود', 404);
      return;
    }

    const role = existing.rows[0];
    if (role.is_system_role) {
      errorResponse(res, 'لا يمكن حذف دور أساسي من أدوار النظام المحمية (مدير النظام)', 400);
      return;
    }

    // Check if any users or employees are assigned to this role
    const usersCount = await query('SELECT COUNT(*) FROM users WHERE role_id=$1', [id]);
    const count = parseInt(usersCount.rows[0].count, 10);
    if (count > 0) {
      errorResponse(res, `لا يمكن حذف هذا الدور لوجود ${count} مستخدم/موظف مرتبط به حالياً. يرجى نقل المستخدمين إلى دور آخر أولاً`, 400);
      return;
    }

    await transaction(async (client) => {
      await client.query('DELETE FROM permissions WHERE role_id=$1', [id]);
      await client.query('DELETE FROM roles WHERE id=$1', [id]);
    });

    successResponse(res, null, 'تم حذف الدور بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف الدور', 500);
  }
};

export const getPermissionRegistry = async (req: Request, res: Response): Promise<void> => {
  try {
    successResponse(res, PERMISSION_REGISTRY, 'تم جلب سجل الصلاحيات المركزي بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في جلب سجل الصلاحيات', 500);
  }
};

export const getPermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleId } = req.params;
    const result = await query(
      'SELECT * FROM permissions WHERE role_id=$1 ORDER BY module_name, screen_name',
      [roleId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الصلاحيات', 500);
  }
};

export const updatePermissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { roleId } = req.params;
    const { permissions } = req.body as { permissions: Array<{ moduleName: string; screenName: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; canApprove: boolean; canPrint: boolean; canExport: boolean }> };

    if (!permissions || !Array.isArray(permissions)) {
      errorResponse(res, 'بيانات الصلاحيات غير صحيحة', 400);
      return;
    }

    await transaction(async (client) => {
      for (const perm of permissions) {
        await client.query(
          `INSERT INTO permissions (role_id, module_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_print, can_export)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (role_id, module_name, screen_name) DO UPDATE
           SET can_view=$4, can_create=$5, can_edit=$6, can_delete=$7, can_approve=$8, can_print=$9, can_export=$10`,
          [roleId, perm.moduleName, perm.screenName, !!perm.canView, !!perm.canCreate, !!perm.canEdit, !!perm.canDelete, !!perm.canApprove, !!perm.canPrint, !!perm.canExport]
        );
      }
    });
    successResponse(res, null, 'تم تحديث الصلاحيات بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث الصلاحيات', 500);
  }
};

export const seedDefaultRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const defaultRoles = [
      { nameAr: 'مدير مالي', nameEn: 'Financial Manager', desc: 'إدارة الحسابات، القوائم المالية، القيود، والاعتمادات', modules: ['accounting', 'vouchers', 'reports'] },
      { nameAr: 'محاسب', nameEn: 'Accountant', desc: 'تسجيل القيود اليومية، كشوف الحسابات، وسندات القبض والصرف', modules: ['accounting', 'vouchers'] },
      { nameAr: 'أمين مخزن', nameEn: 'Warehouse Keeper', desc: 'إدارة المستودعات، الأصناف، استلام وصرف وتحويل المخزون', modules: ['inventory'] },
      { nameAr: 'موظف مشتريات', nameEn: 'Purchasing Officer', desc: 'إدارة الموردين، أوامر الشراء، وفواتير المشتريات واستلامها', modules: ['purchasing', 'inventory'] },
      { nameAr: 'موظف مبيعات', nameEn: 'Sales Officer', desc: 'إدارة العملاء، عروض الأسعار، وفواتير ومردودات المبيعات', modules: ['sales'] },
      { nameAr: 'مسؤول الموارد البشرية', nameEn: 'HR Officer', desc: 'إدارة الموظفين، الحضور والانصراف، الإجازات ومسيرات الرواتب', modules: ['hr', 'payroll'] },
      { nameAr: 'مدخل بيانات', nameEn: 'Data Entry', desc: 'إدخال البيانات الأساسية والمعاملات اليومية', modules: ['sales', 'purchasing', 'inventory', 'accounting'] },
    ];

    const createdRoles = [];
    for (const r of defaultRoles) {
      const existing = await query('SELECT id FROM roles WHERE company_id=$1 AND name_ar=$2', [companyId, r.nameAr]);
      let roleId: string;
      if (existing.rows.length === 0) {
        const ins = await query(
          'INSERT INTO roles (company_id, name_ar, name_en, description, is_system_role) VALUES ($1,$2,$3,$4,FALSE) RETURNING id',
          [companyId, r.nameAr, r.nameEn, r.desc]
        );
        roleId = ins.rows[0].id;
        createdRoles.push(r.nameAr);

        // Populate permissions for this role based on matched modules
        for (const p of PERMISSION_REGISTRY) {
          if (r.modules.includes(p.module)) {
            await query(
              `INSERT INTO permissions (role_id, module_name, screen_name, can_view, can_create, can_edit, can_delete, can_approve, can_print, can_export)
               VALUES ($1,$2,$3,TRUE,TRUE,TRUE,FALSE,FALSE,TRUE,TRUE)
               ON CONFLICT (role_id, module_name, screen_name) DO NOTHING`,
              [roleId, p.module, p.screen]
            );
          }
        }
      }
    }

    successResponse(res, { created: createdRoles }, 'تم فحص وزرع الأدوار القياسية بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في زرع الأدوار القياسية', 500);
  }
};

// ========== SYSTEM SETTINGS ==========
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM system_settings WHERE company_id=$1', [req.user!.companyId]);
    const settings: Record<string, string> = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    successResponse(res, settings);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الإعدادات', 500);
  }
};

export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const settings = req.body as Record<string, string>;
    await transaction(async (client) => {
      for (const [key, value] of Object.entries(settings)) {
        await client.query(
          `INSERT INTO system_settings (company_id, key, value, updated_by)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (company_id, key) DO UPDATE SET value=$3, updated_by=$4, updated_at=NOW()`,
          [req.user!.companyId, key, value, req.user!.userId]
        );
      }
    });
    successResponse(res, null, 'تم تحديث الإعدادات بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث الإعدادات', 500);
  }
};

// ========== PAYMENT METHODS ==========
export const getPaymentMethods = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM payment_methods WHERE company_id=$1 AND status=$2 ORDER BY name_ar', [req.user!.companyId, 'Active']);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب طرق الدفع', 500);
  }
};

// ========== TAXES ==========
export const getTaxes = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query('SELECT * FROM taxes WHERE company_id=$1 AND status=$2 ORDER BY name_ar', [req.user!.companyId, 'Active']);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الضرائب', 500);
  }
};

// ========== DEPARTMENTS ==========
export const getDepartments = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT d.*, b.name_ar as branch_name FROM departments d
       LEFT JOIN branches b ON b.id = d.branch_id
       WHERE b.company_id=$1 AND d.status='Active' ORDER BY d.name_ar`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الأقسام', 500);
  }
};

export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, branchId, managerId } = req.body;
    const result = await query(
      `INSERT INTO departments (code, name_ar, name_en, branch_id, manager_id) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [code, nameAr, nameEn, branchId, managerId || null]
    );
    successResponse(res, result.rows[0], 'تم إضافة القسم بنجاح', 201);
  } catch (error) {
    errorResponse(res, 'خطأ في إضافة القسم', 500);
  }
};

// ========== SUPPLIERS ==========
export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT s.*, 
              cu.code AS currency_code, cu.name_ar AS currency_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'currency_id', sc.currency_id,
                      'currency_code', c.code,
                      'currency_name', c.name_ar,
                      'symbol', c.symbol,
                      'balance', sc.balance,
                      'opening_balance', sc.opening_balance,
                      'credit_limit', sc.credit_limit,
                      'is_default', sc.is_default
                    )
                  )
                  FROM supplier_currencies sc
                  JOIN currencies c ON sc.currency_id = c.id
                  WHERE sc.supplier_id = s.id
                ),
                '[]'::json
              ) AS currencies
       FROM suppliers s
       LEFT JOIN currencies cu ON s.currency_id = cu.id
       WHERE s.company_id = $1 ORDER BY s.code`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الموردين', 500);
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, nameAr, nameEn, contactPerson, phone, email, city, address,
      taxNumber, crNumber, creditLimit, openingBalance, currencyId, currencyIds, currencies,
      apAccountId, paymentTerms, status
    } = req.body;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    if (chosenCurrencyIds.length === 0) {
      errorResponse(res, 'يجب تحديد عملة واحدة على الأقل للمورد', 400);
      return;
    }
    if (!nameAr) {
      errorResponse(res, 'الاسم العربي مطلوب', 400);
      return;
    }

    // Auto-generate code if not provided
    let supplierCode = code;
    if (!supplierCode) {
      const countResult = await query(
        `SELECT COUNT(*) FROM suppliers WHERE company_id = $1`,
        [req.user!.companyId]
      );
      const count = parseInt(countResult.rows[0].count) + 1;
      supplierCode = 'SUP-' + String(count).padStart(4, '0');
    }

    const creditLimitValue = (creditLimit !== undefined && creditLimit !== null && creditLimit !== '') 
      ? parseFloat(creditLimit) 
      : null;

    const primaryCurrencyId = chosenCurrencyIds[0];

    const result = await transaction(async (client) => {
      const suppRes = await client.query(
        `INSERT INTO suppliers 
          (company_id, code, name_ar, name_en, contact_person, phone, email, city, address,
           tax_number, cr_number, credit_limit, currency_id,
           ap_account_id, payment_terms, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          req.user!.companyId, supplierCode, nameAr, nameEn || null, contactPerson || null,
          phone || null, email || null, city || null, address || null,
          taxNumber || null, crNumber || null, creditLimitValue,
          primaryCurrencyId, apAccountId || null, paymentTerms || 30, status || 'Active'
        ]
      );

      const supplier = suppRes.rows[0];

      // Insert into supplier_currencies
      for (let i = 0; i < chosenCurrencyIds.length; i++) {
        const cId = chosenCurrencyIds[i];
        const openBal = (i === 0 && openingBalance !== undefined) ? Number(openingBalance) || 0 : 0;
        await client.query(
          `INSERT INTO supplier_currencies (supplier_id, currency_id, opening_balance, balance, credit_limit, is_default)
           VALUES ($1, $2, $3, $3, $4, $5)
           ON CONFLICT (supplier_id, currency_id) DO NOTHING`,
          [supplier.id, cId, openBal, creditLimitValue, i === 0]
        );
      }

      return supplier;
    });

    successResponse(res, result, 'تم إضافة المورد بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود المورد موجود مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة المورد', 500);
    }
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      nameAr, nameEn, contactPerson, phone, email, city, address,
      taxNumber, crNumber, creditLimit, currencyId, currencyIds,
      apAccountId, paymentTerms, status
    } = req.body;

    const creditLimitValue = (creditLimit !== undefined && creditLimit !== null && creditLimit !== '')
      ? parseFloat(creditLimit)
      : null;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    const primaryCurrencyId = chosenCurrencyIds.length > 0 ? chosenCurrencyIds[0] : null;

    await transaction(async (client) => {
      const result = await client.query(
        `UPDATE suppliers SET
          name_ar=$1, name_en=$2, contact_person=$3, phone=$4, email=$5,
          city=$6, address=$7, tax_number=$8, cr_number=$9, credit_limit=$10,
          currency_id=COALESCE($11, currency_id), ap_account_id=$12, payment_terms=$13, status=$14
         WHERE id=$15 AND company_id=$16 RETURNING *`,
        [
          nameAr, nameEn || null, contactPerson || null, phone || null, email || null,
          city || null, address || null, taxNumber || null, crNumber || null, creditLimitValue,
          primaryCurrencyId, apAccountId || null, paymentTerms || 30, status || 'Active',
          id, req.user!.companyId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // Sync supplier_currencies
      if (chosenCurrencyIds.length > 0) {
        // Insert any new currencies
        for (let i = 0; i < chosenCurrencyIds.length; i++) {
          const cId = chosenCurrencyIds[i];
          await client.query(
            `INSERT INTO supplier_currencies (supplier_id, currency_id, opening_balance, balance, credit_limit, is_default)
             VALUES ($1, $2, 0, 0, $3, $4)
             ON CONFLICT (supplier_id, currency_id) DO UPDATE SET is_default = $4`,
            [id, cId, creditLimitValue, i === 0]
          );
        }
        // Remove currencies no longer in chosenCurrencyIds (only if balance is 0)
        await client.query(
          `DELETE FROM supplier_currencies WHERE supplier_id = $1 AND currency_id != ALL($2) AND balance = 0`,
          [id, chosenCurrencyIds]
        );
      }
    });

    const updated = await query(`SELECT * FROM suppliers WHERE id = $1`, [id]);
    successResponse(res, updated.rows[0], 'تم تحديث المورد بنجاح');
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      errorResponse(res, 'المورد غير موجود', 404);
    } else {
      errorResponse(res, 'خطأ في تحديث المورد', 500);
    }
  }
};

// ========== FINANCIAL PERIODS ==========
export const getFinancialPeriods = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM financial_periods WHERE company_id = $1 ORDER BY start_date DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الفترات المالية', 500);
  }
};

