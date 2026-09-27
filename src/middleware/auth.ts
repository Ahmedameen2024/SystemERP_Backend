import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db';
import { getScreenDefinition, ACTION_LABELS_AR } from '../config/permissionRegistry';

export interface JwtPayload {
  userId: string;
  username: string;
  roleId: string;
  roleNameAr?: string;
  roleNameEn?: string;
  isSuperAdmin?: boolean;
  companyId: string;
  branchId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'غير مصرح - يرجى تسجيل الدخول' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'erp_secret_key_change_in_prod') as JwtPayload;

    // Verify user still exists, is active, and fetch role metadata
    const result = await query(
      `SELECT u.id, u.username, u.status, u.role_id, u.company_id, u.branch_id,
              r.name_ar AS role_name_ar, r.name_en AS role_name_en, r.is_system_role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [decoded.userId]
    );

    if (result.rows.length === 0 || result.rows[0].status !== 'Active') {
      res.status(401).json({ success: false, message: 'الحساب غير نشط أو غير موجود' });
      return;
    }

    const row = result.rows[0];
    const isSuperAdmin = 
      row.is_system_role === true || 
      row.role_name_ar === 'مدير النظام' || 
      row.role_name_en === 'System Administrator' || 
      row.username === 'admin';

    req.user = {
      userId: row.id,
      username: row.username,
      roleId: row.role_id || decoded.roleId,
      companyId: row.company_id || decoded.companyId,
      branchId: row.branch_id || decoded.branchId,
      roleNameAr: row.role_name_ar,
      roleNameEn: row.role_name_en,
      isSuperAdmin,
    };
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'رمز المصادقة غير صالح أو منتهي الصلاحية' });
  }
};

export const authorize = (
  module: string,
  screen: string,
  action: 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'print' | 'export'
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, message: 'غير مصرح - يرجى تسجيل الدخول' });
        return;
      }

      // 1. Super Admin has absolute unrestricted permissions
      if (req.user.isSuperAdmin) {
        return next();
      }

      const actionMap: Record<string, string> = {
        view: 'can_view',
        create: 'can_create',
        edit: 'can_edit',
        delete: 'can_delete',
        approve: 'can_approve',
        print: 'can_print',
        export: 'can_export',
      };

      const column = actionMap[action];
      if (!column) {
        return next();
      }

      const result = await query(
        `SELECT ${column} FROM permissions 
         WHERE role_id = $1 AND module_name = $2 AND screen_name = $3`,
        [req.user.roleId, module, screen]
      );

      if (result.rows.length === 0 || !result.rows[0][column]) {
        const screenDef = getScreenDefinition(module, screen);
        const screenTitle = screenDef ? screenDef.screenNameAr : `${module}/${screen}`;
        const actionTitle = ACTION_LABELS_AR[action] || action;

        res.status(403).json({
          success: false,
          message: `ليس لديك صلاحية (${actionTitle}) في قسم [${screenTitle}]`,
          permission: {
            module,
            screen,
            action,
            screenTitle,
            actionTitle,
          },
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'خطأ في التحقق من الصلاحيات' });
    }
  };
};
