import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
import { JwtPayload } from '../middleware/auth';
import { PERMISSION_REGISTRY } from '../config/permissionRegistry';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      errorResponse(res, 'اسم المستخدم وكلمة المرور مطلوبان', 400);
      return;
    }

    // Fetch user with role and company info
    const result = await query(
      `SELECT u.id, u.username, u.password_hash, u.name_ar, u.name_en, 
              u.email, u.status, u.language, u.role_id, u.company_id, u.branch_id,
              r.name_ar as role_name_ar, r.name_en as role_name_en, r.is_system_role,
              c.name_ar as company_name_ar
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.username = $1`,
      [username]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401);
      return;
    }

    const user = result.rows[0];

    if (user.status !== 'Active') {
      errorResponse(res, 'الحساب غير نشط. يرجى التواصل مع مدير النظام', 401);
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      errorResponse(res, 'اسم المستخدم أو كلمة المرور غير صحيحة', 401);
      return;
    }

    // Update last login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Log the login event
    await query(
      `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, description, ip_address, user_agent)
       VALUES ($1, 'LOGIN', 'users', $1, 'User login', $2, $3)`,
      [user.id, req.ip, req.headers['user-agent'] || '']
    );

    const isSuperAdmin =
      user.is_system_role === true ||
      user.role_name_ar === 'مدير النظام' ||
      user.role_name_en === 'System Administrator' ||
      user.username === 'admin';

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      companyId: user.company_id,
      branchId: user.branch_id,
      roleNameAr: user.role_name_ar,
      roleNameEn: user.role_name_en,
      isSuperAdmin,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET || 'erp_secret_key_change_in_prod', {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET || 'erp_refresh_secret_key_change_in_prod',
      { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any }
    );

    successResponse(res, {
      token,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        nameAr: user.name_ar,
        nameEn: user.name_en,
        email: user.email,
        language: user.language,
        roleId: user.role_id,
        roleNameAr: user.role_name_ar,
        roleNameEn: user.role_name_en,
        isSuperAdmin,
        companyId: user.company_id,
        companyNameAr: user.company_name_ar,
        branchId: user.branch_id,
      },
    }, 'تم تسجيل الدخول بنجاح');

  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, 'حدث خطأ أثناء تسجيل الدخول', 500);
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;
    if (!token) {
      errorResponse(res, 'رمز التحديث مطلوب', 400);
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'erp_refresh_secret_key_change_in_prod') as { userId: string };
    const result = await query(
      `SELECT u.id, u.username, u.status, u.role_id, u.company_id, u.branch_id,
              r.name_ar as role_name_ar, r.name_en as role_name_en, r.is_system_role
       FROM users u 
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'Active') {
      errorResponse(res, 'الجلسة غير صالحة', 401);
      return;
    }

    const user = result.rows[0];
    const isSuperAdmin =
      user.is_system_role === true ||
      user.role_name_ar === 'مدير النظام' ||
      user.role_name_en === 'System Administrator' ||
      user.username === 'admin';

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      companyId: user.company_id,
      branchId: user.branch_id,
      roleNameAr: user.role_name_ar,
      roleNameEn: user.role_name_en,
      isSuperAdmin,
    };

    const newToken = jwt.sign(payload, process.env.JWT_SECRET || 'erp_secret_key_change_in_prod', {
      expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
    });

    successResponse(res, { token: newToken }, 'تم تجديد الرمز بنجاح');

  } catch (error) {
    errorResponse(res, 'رمز التحديث غير صالح أو منتهي الصلاحية', 401);
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.user) {
      await query(
        `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, description, ip_address)
         VALUES ($1, 'LOGOUT', 'users', $1, 'User logout', $2)`,
        [req.user.userId, req.ip]
      );
    }
    successResponse(res, null, 'تم تسجيل الخروج بنجاح');
  } catch (error) {
    errorResponse(res, 'حدث خطأ أثناء تسجيل الخروج', 500);
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT u.id, u.username, u.name_ar, u.name_en, u.email, u.language,
              u.status, u.last_login, u.created_at,
              r.name_ar as role_name_ar, r.name_en as role_name_en, r.is_system_role,
              c.name_ar as company_name_ar, c.logo_path,
              b.name_ar as branch_name_ar
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'المستخدم غير موجود', 404);
      return;
    }

    const userProfile = result.rows[0];
    const isSuperAdmin =
      userProfile.is_system_role === true ||
      userProfile.role_name_ar === 'مدير النظام' ||
      userProfile.role_name_en === 'System Administrator' ||
      userProfile.username === 'admin';

    let permissions: any[] = [];
    if (isSuperAdmin) {
      // Super admin automatically receives all permissions in registry
      permissions = PERMISSION_REGISTRY.map((p) => ({
        module_name: p.module,
        screen_name: p.screen,
        can_view: true,
        can_create: true,
        can_edit: true,
        can_delete: true,
        can_approve: true,
        can_print: true,
        can_export: true,
      }));
    } else {
      const permsResult = await query(
        `SELECT module_name, screen_name, can_view, can_create, can_edit, 
                can_delete, can_approve, can_print, can_export
         FROM permissions WHERE role_id = $1`,
        [req.user!.roleId]
      );
      permissions = permsResult.rows;
    }

    successResponse(res, {
      ...userProfile,
      isSuperAdmin,
      permissions,
    });
  } catch (error) {
    errorResponse(res, 'حدث خطأ في جلب بيانات المستخدم', 500);
  }
};


/*
import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';
import { JwtPayload } from '../middleware/auth';

export const login = async (req: Request, res: Response): Promise<void> => {
  console.log('[LOGIN] 1 - Request received');

  try {
    const { username, password } = req.body;

    console.log('[LOGIN] 2 - Request body received');

    if (!username || !password) {
      console.log('[LOGIN] STOP - Missing username or password');

      errorResponse(
        res,
        'اسم المستخدم وكلمة المرور مطلوبان',
        400
      );

      return;
    }

    console.log('[LOGIN] 3 - Credentials validated');

    // ---------------------------------------------------------
    // 1. Get user from database
    // ---------------------------------------------------------

    console.log('[LOGIN] 4 - Starting user database query');

    const result = await query(
      `SELECT 
          u.id,
          u.username,
          u.password_hash,
          u.name_ar,
          u.name_en,
          u.email,
          u.status,
          u.language,
          u.role_id,
          u.company_id,
          u.branch_id,
          r.name_ar AS role_name_ar,
          r.name_en AS role_name_en,
          c.name_ar AS company_name_ar
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.username = $1`,
      [username]
    );

    console.log('[LOGIN] 5 - User database query completed');
    console.log('[LOGIN] 5.1 - Rows returned:', result.rows.length);

    if (result.rows.length === 0) {
      console.log('[LOGIN] STOP - User not found');

      errorResponse(
        res,
        'اسم المستخدم أو كلمة المرور غير صحيحة',
        401
      );

      return;
    }

    const user = result.rows[0];

    console.log('[LOGIN] 6 - User found');

    // ---------------------------------------------------------
    // 2. Check account status
    // ---------------------------------------------------------

    console.log('[LOGIN] 7 - Checking account status');

    if (user.status !== 'Active') {
      console.log('[LOGIN] STOP - User account is inactive');

      errorResponse(
        res,
        'الحساب غير نشط. يرجى التواصل مع مدير النظام',
        401
      );

      return;
    }

    console.log('[LOGIN] 8 - Account is active');

    // ---------------------------------------------------------
    // 3. Check password
    // ---------------------------------------------------------

    console.log('[LOGIN] 9 - Starting bcrypt password comparison');

    const isPasswordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    console.log('[LOGIN] 10 - Password comparison completed');

    if (!isPasswordValid) {
      console.log('[LOGIN] STOP - Invalid password');

      errorResponse(
        res,
        'اسم المستخدم أو كلمة المرور غير صحيحة',
        401
      );

      return;
    }

    console.log('[LOGIN] 11 - Password is valid');

    // ---------------------------------------------------------
    // 4. Update last login
    // ---------------------------------------------------------

    console.log('[LOGIN] 12 - Updating last_login');

    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    console.log('[LOGIN] 13 - last_login updated');

    // ---------------------------------------------------------
    // 5. Audit log
    // ---------------------------------------------------------

    console.log('[LOGIN] 14 - Creating audit log');

    await query(
      `INSERT INTO audit_logs
        (
          user_id,
          action_type,
          table_name,
          record_id,
          description,
          ip_address,
          user_agent
        )
       VALUES
        (
          $1,
          'LOGIN',
          'users',
          $1,
          'User login',
          $2,
          $3
        )`,
      [
        user.id,
        req.ip,
        req.headers['user-agent'] || ''
      ]
    );

    console.log('[LOGIN] 15 - Audit log created');

    // ---------------------------------------------------------
    // 6. Create JWT
    // ---------------------------------------------------------

    console.log('[LOGIN] 16 - Creating access token');

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      console.error('[LOGIN] ERROR - JWT_SECRET is missing');

      errorResponse(
        res,
        'إعدادات الخادم غير مكتملة: JWT_SECRET غير موجود',
        500
      );

      return;
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      console.error(
        '[LOGIN] ERROR - JWT_REFRESH_SECRET is missing'
      );

      errorResponse(
        res,
        'إعدادات الخادم غير مكتملة: JWT_REFRESH_SECRET غير موجود',
        500
      );

      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      companyId: user.company_id,
      branchId: user.branch_id,
    };

    const token = jwt.sign(
      payload,
      jwtSecret,
      {
        expiresIn: (process.env.JWT_EXPIRES_IN || '8h') as any,
      }
    );

    console.log('[LOGIN] 17 - Access token created');

    // ---------------------------------------------------------
    // 7. Create refresh token
    // ---------------------------------------------------------

    console.log('[LOGIN] 18 - Creating refresh token');

    const refreshToken = jwt.sign(
      {
        userId: user.id
      },
      refreshSecret,
      {
        expiresIn: (
          process.env.JWT_REFRESH_EXPIRES_IN || '7d'
        ) as any,
      }
    );

    console.log('[LOGIN] 19 - Refresh token created');

    // ---------------------------------------------------------
    // 8. Send response
    // ---------------------------------------------------------

    console.log('[LOGIN] 20 - Sending successful response');

    successResponse(
      res,
      {
        token,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          nameAr: user.name_ar,
          nameEn: user.name_en,
          email: user.email,
          language: user.language,
          roleId: user.role_id,
          roleNameAr: user.role_name_ar,
          roleNameEn: user.role_name_en,
          companyId: user.company_id,
          companyNameAr: user.company_name_ar,
          branchId: user.branch_id,
        },
      },
      'تم تسجيل الدخول بنجاح'
    );

    console.log('[LOGIN] 21 - Response sent successfully');

  } catch (error) {
    console.error('[LOGIN] FATAL ERROR:', error);

    errorResponse(
      res,
      'حدث خطأ أثناء تسجيل الدخول',
      500
    );
  }
};


// ============================================================
// REFRESH TOKEN
// ============================================================

export const refreshToken = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      errorResponse(
        res,
        'رمز التحديث مطلوب',
        400
      );
      return;
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      errorResponse(
        res,
        'إعدادات الخادم غير مكتملة',
        500
      );
      return;
    }

    const decoded = jwt.verify(
      token,
      refreshSecret
    ) as { userId: string };

    const result = await query(
      `SELECT
          u.id,
          u.username,
          u.status,
          u.role_id,
          u.company_id,
          u.branch_id
       FROM users u
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (
      result.rows.length === 0 ||
      result.rows[0].status !== 'Active'
    ) {
      errorResponse(
        res,
        'الجلسة غير صالحة',
        401
      );
      return;
    }

    const user = result.rows[0];

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      errorResponse(
        res,
        'إعدادات الخادم غير مكتملة',
        500
      );
      return;
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      roleId: user.role_id,
      companyId: user.company_id,
      branchId: user.branch_id,
    };

    const newToken = jwt.sign(
      payload,
      jwtSecret,
      {
        expiresIn: (
          process.env.JWT_EXPIRES_IN || '8h'
        ) as any,
      }
    );

    successResponse(
      res,
      {
        token: newToken
      },
      'تم تجديد الرمز بنجاح'
    );

  } catch (error) {
    console.error('[REFRESH] ERROR:', error);

    errorResponse(
      res,
      'رمز التحديث غير صالح أو منتهي الصلاحية',
      401
    );
  }
};


// ============================================================
// LOGOUT
// ============================================================

export const logout = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (req.user) {
      await query(
        `INSERT INTO audit_logs
          (
            user_id,
            action_type,
            table_name,
            record_id,
            description,
            ip_address
          )
         VALUES
          (
            $1,
            'LOGOUT',
            'users',
            $1,
            'User logout',
            $2
          )`,
        [
          req.user.userId,
          req.ip
        ]
      );
    }

    successResponse(
      res,
      null,
      'تم تسجيل الخروج بنجاح'
    );

  } catch (error) {
    console.error('[LOGOUT] ERROR:', error);

    errorResponse(
      res,
      'حدث خطأ أثناء تسجيل الخروج',
      500
    );
  }
};


// ============================================================
// GET PROFILE
// ============================================================

export const getProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const result = await query(
      `SELECT
          u.id,
          u.username,
          u.name_ar,
          u.name_en,
          u.email,
          u.language,
          u.status,
          u.last_login,
          u.created_at,
          r.name_ar AS role_name_ar,
          r.name_en AS role_name_en,
          c.name_ar AS company_name_ar,
          c.logo_path,
          b.name_ar AS branch_name_ar
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN branches b ON b.id = u.branch_id
       WHERE u.id = $1`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      errorResponse(
        res,
        'المستخدم غير موجود',
        404
      );
      return;
    }

    const permsResult = await query(
      `SELECT
          module_name,
          screen_name,
          can_view,
          can_create,
          can_edit,
          can_delete,
          can_approve,
          can_print,
          can_export
       FROM permissions
       WHERE role_id = $1`,
      [req.user!.roleId]
    );

    successResponse(
      res,
      {
        ...result.rows[0],
        permissions: permsResult.rows,
      }
    );

  } catch (error) {
    console.error('[PROFILE] ERROR:', error);

    errorResponse(
      res,
      'حدث خطأ في جلب بيانات المستخدم',
      500
    );
  }
};*/