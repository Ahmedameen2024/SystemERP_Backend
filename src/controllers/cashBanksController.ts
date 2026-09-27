import { Request, Response } from 'express';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// Helper to record audit log
const logAudit = async (
  userId: string,
  actionType: 'INSERT' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'POST' | 'VOID',
  tableName: string,
  recordId: string,
  oldValues: any,
  newValues: any,
  req: Request,
  description: string
) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.ip || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    await query(
      `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, old_values, new_values, ip_address, user_agent, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId,
        actionType,
        tableName,
        recordId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent,
        description,
      ]
    );
  } catch (err) {
    console.error('Failed to log audit entry:', err);
  }
};

// ==========================================
// ==========================================
// CASH BOXES MASTER CONTROLLER
// ==========================================

export const getCashBoxes = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { search, branchId, status, page = 1, limit = 50 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const params: any[] = [companyId];
    let queryText = `
      SELECT cb.*,
             b.name_ar AS branch_name_ar, b.name_en AS branch_name_en,
             c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol,
             gl.code AS gl_account_code, gl.name_ar AS gl_account_name,
             u.name_ar AS responsible_employee_name,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'currency_id', cbc.currency_id,
                     'currency_code', cur.code,
                     'currency_name', cur.name_ar,
                     'symbol', cur.symbol,
                     'current_balance', cbc.current_balance,
                     'opening_balance', cbc.opening_balance,
                     'maximum_balance', cbc.maximum_balance,
                     'is_default', cbc.is_default
                   )
                 )
                 FROM cash_box_currencies cbc
                 JOIN currencies cur ON cbc.currency_id = cur.id
                 WHERE cbc.cash_box_id = cb.id
               ),
               '[]'::json
             ) AS currencies
      FROM cash_boxes cb
      LEFT JOIN branches b ON cb.branch_id = b.id
      LEFT JOIN currencies c ON cb.currency_id = c.id
      LEFT JOIN gl_accounts gl ON cb.gl_account_id = gl.id
      LEFT JOIN users u ON cb.responsible_employee_id = u.id
      WHERE cb.company_id = $1 AND cb.is_deleted = FALSE
    `;

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (cb.code ILIKE $${params.length} OR cb.name_ar ILIKE $${params.length} OR cb.name_en ILIKE $${params.length})`;
    }

    if (branchId) {
      params.push(branchId);
      queryText += ` AND cb.branch_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND cb.status = $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${queryText}) AS total`, params);
    const totalItems = parseInt(countResult.rows[0]?.count || '0', 10);

    queryText += ` ORDER BY cb.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(queryText, params);

    successResponse(res, {
      items: result.rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / Number(limit)) || 1,
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    errorResponse(res, 'خطأ في جلب الصناديق المالية', 500, error.message);
  }
};

export const getCashBoxById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const result = await query(
      `SELECT cb.*,
              b.name_ar AS branch_name_ar, c.code AS currency_code, gl.code AS gl_account_code, gl.name_ar AS gl_account_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'currency_id', cbc.currency_id,
                      'currency_code', cur.code,
                      'currency_name', cur.name_ar,
                      'symbol', cur.symbol,
                      'current_balance', cbc.current_balance,
                      'opening_balance', cbc.opening_balance,
                      'maximum_balance', cbc.maximum_balance,
                      'is_default', cbc.is_default
                    )
                  )
                  FROM cash_box_currencies cbc
                  JOIN currencies cur ON cbc.currency_id = cur.id
                  WHERE cbc.cash_box_id = cb.id
                ),
                '[]'::json
              ) AS currencies
       FROM cash_boxes cb
       LEFT JOIN branches b ON cb.branch_id = b.id
       LEFT JOIN currencies c ON cb.currency_id = c.id
       LEFT JOIN gl_accounts gl ON cb.gl_account_id = gl.id
       WHERE cb.id = $1 AND cb.company_id = $2 AND cb.is_deleted = FALSE`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'الصندوق غير موجود', 404);
      return;
    }

    successResponse(res, result.rows[0]);
  } catch (error: any) {
    errorResponse(res, 'خطأ في جلب تفاصيل الصندوق', 500, error.message);
  }
};

export const createCashBox = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const {
      code,
      nameAr,
      nameEn,
      branchId,
      currencyId,
      currencyIds,
      currencies,
      glAccountId,
      responsibleEmployeeId,
      openingBalance = 0,
      maximumBalance = 0,
      status = 'Active',
      notes,
    } = req.body;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    if (!code || !nameAr || !branchId || chosenCurrencyIds.length === 0 || !glAccountId) {
      errorResponse(res, 'جميع الحقول الأساسية مطلوبة (كود الصندوق، الاسم العربي، الفرع، العملات، الحساب المحاسبي)', 400);
      return;
    }

    const existing = await query(
      `SELECT id FROM cash_boxes WHERE company_id = $1 AND code = $2 AND is_deleted = FALSE`,
      [companyId, code]
    );

    if (existing.rows.length > 0) {
      errorResponse(res, 'كود الصندوق مستخدم مسبقاً', 409);
      return;
    }

    const primaryCurrencyId = chosenCurrencyIds[0];
    const currentBalance = Number(openingBalance) || 0;

    const result = await query(
      `INSERT INTO cash_boxes (
        company_id, branch_id, code, name_ar, name_en, currency_id, gl_account_id,
        responsible_employee_id, opening_balance, current_balance, maximum_balance,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        companyId,
        branchId,
        code,
        nameAr,
        nameEn || nameAr,
        primaryCurrencyId,
        glAccountId,
        responsibleEmployeeId || null,
        Number(openingBalance) || 0,
        currentBalance,
        Number(maximumBalance) || 0,
        status,
        notes || null,
        userId,
      ]
    );

    const createdBox = result.rows[0];

    // Populate cash_box_currencies
    if (currencies && Array.isArray(currencies) && currencies.length > 0) {
      for (let i = 0; i < currencies.length; i++) {
        const item = currencies[i];
        const cId = item.currencyId || item.currency_id;
        if (!cId) continue;
        const openBal = Number(item.openingBalance || item.opening_balance || 0);
        const maxBal = Number(item.maximumBalance || item.maximum_balance || 0);
        await query(
          `INSERT INTO cash_box_currencies (cash_box_id, currency_id, opening_balance, current_balance, maximum_balance, is_default)
           VALUES ($1, $2, $3, $3, $4, $5)
           ON CONFLICT (cash_box_id, currency_id) DO NOTHING`,
          [createdBox.id, cId, openBal, maxBal, i === 0]
        );
      }
    } else {
      for (let i = 0; i < chosenCurrencyIds.length; i++) {
        const cId = chosenCurrencyIds[i];
        const openBal = (i === 0 && openingBalance !== undefined) ? Number(openingBalance) || 0 : 0;
        await query(
          `INSERT INTO cash_box_currencies (cash_box_id, currency_id, opening_balance, current_balance, maximum_balance, is_default)
           VALUES ($1, $2, $3, $3, $4, $5)
           ON CONFLICT (cash_box_id, currency_id) DO NOTHING`,
          [createdBox.id, cId, openBal, Number(maximumBalance) || 0, i === 0]
        );
      }
    }

    await logAudit(userId, 'INSERT', 'cash_boxes', createdBox.id, null, createdBox, req, `إنشاء صندوق مالي جديد: ${nameAr} (${code})`);

    successResponse(res, createdBox, 'تم إنشاء الصندوق المالي بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود الصندوق مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة الصندوق المالي', 500, error.message);
    }
  }
};

export const updateCashBox = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const {
      code,
      nameAr,
      nameEn,
      branchId,
      currencyId,
      currencyIds,
      currencies,
      glAccountId,
      responsibleEmployeeId,
      openingBalance,
      maximumBalance,
      status,
      notes,
    } = req.body;

    const existing = await query(
      `SELECT * FROM cash_boxes WHERE id = $1 AND company_id = $2 AND is_deleted = FALSE`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      errorResponse(res, 'الصندوق غير موجود', 404);
      return;
    }

    const oldValues = existing.rows[0];

    if (code && code !== oldValues.code) {
      const codeCheck = await query(
        `SELECT id FROM cash_boxes WHERE company_id = $1 AND code = $2 AND id != $3 AND is_deleted = FALSE`,
        [companyId, code, id]
      );
      if (codeCheck.rows.length > 0) {
        errorResponse(res, 'كود الصندوق مستخدم مسبقاً', 409);
        return;
      }
    }

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    const primaryCurrencyId = chosenCurrencyIds.length > 0 ? chosenCurrencyIds[0] : null;

    const result = await query(
      `UPDATE cash_boxes SET
        code = COALESCE($1, code),
        name_ar = COALESCE($2, name_ar),
        name_en = COALESCE($3, name_en),
        branch_id = COALESCE($4, branch_id),
        currency_id = COALESCE($5, currency_id),
        gl_account_id = COALESCE($6, gl_account_id),
        responsible_employee_id = $7,
        opening_balance = COALESCE($8, opening_balance),
        maximum_balance = COALESCE($9, maximum_balance),
        status = COALESCE($10, status),
        notes = COALESCE($11, notes),
        updated_at = NOW()
       WHERE id = $12 AND company_id = $13
       RETURNING *`,
      [
        code,
        nameAr,
        nameEn,
        branchId,
        primaryCurrencyId,
        glAccountId,
        responsibleEmployeeId || null,
        openingBalance !== undefined ? Number(openingBalance) : null,
        maximumBalance !== undefined ? Number(maximumBalance) : null,
        status,
        notes,
        id,
        companyId,
      ]
    );

    const updatedBox = result.rows[0];

    // Sync cash_box_currencies
    if (currencies && Array.isArray(currencies) && currencies.length > 0) {
      for (let i = 0; i < currencies.length; i++) {
        const item = currencies[i];
        const cId = item.currencyId || item.currency_id;
        if (!cId) continue;
        const maxBal = Number(item.maximumBalance || item.maximum_balance || 0);
        await query(
          `INSERT INTO cash_box_currencies (cash_box_id, currency_id, opening_balance, current_balance, maximum_balance, is_default)
           VALUES ($1, $2, 0, 0, $3, $4)
           ON CONFLICT (cash_box_id, currency_id) DO UPDATE SET is_default = $4, maximum_balance = $3`,
          [id, cId, maxBal, i === 0]
        );
      }
    } else if (chosenCurrencyIds.length > 0) {
      for (let i = 0; i < chosenCurrencyIds.length; i++) {
        const cId = chosenCurrencyIds[i];
        await query(
          `INSERT INTO cash_box_currencies (cash_box_id, currency_id, opening_balance, current_balance, maximum_balance, is_default)
           VALUES ($1, $2, 0, 0, $3, $4)
           ON CONFLICT (cash_box_id, currency_id) DO UPDATE SET is_default = $4`,
          [id, cId, Number(maximumBalance) || 0, i === 0]
        );
      }
      await query(
        `DELETE FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id != ALL($2) AND current_balance = 0`,
        [id, chosenCurrencyIds]
      );
    }

    await logAudit(userId, 'UPDATE', 'cash_boxes', updatedBox.id, oldValues, updatedBox, req, `تحديث بيانات الصندوق المالي: ${updatedBox.name_ar}`);

    successResponse(res, updatedBox, 'تم تحديث بيانات الصندوق بنجاح');
  } catch (error: any) {
    errorResponse(res, 'خطأ في تحديث الصندوق المالي', 500, error.message);
  }
};

export const deleteCashBox = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const existing = await query(
      `SELECT * FROM cash_boxes WHERE id = $1 AND company_id = $2 AND is_deleted = FALSE`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      errorResponse(res, 'الصندوق غير موجود', 404);
      return;
    }

    const rvCheck = await query(`SELECT id FROM receipt_vouchers WHERE cash_box_id = $1 LIMIT 1`, [id]);
    const pvCheck = await query(`SELECT id FROM payment_vouchers WHERE cash_box_id = $1 LIMIT 1`, [id]);
    const jlCheck = await query(`SELECT id FROM journal_entry_lines WHERE cash_box_id = $1 LIMIT 1`, [id]);

    if (rvCheck.rows.length > 0 || pvCheck.rows.length > 0 || jlCheck.rows.length > 0) {
      errorResponse(res, 'لا يمكن حذف الصندوق لارتباطه بمعاملات مالية سابقة', 400);
      return;
    }

    await query(
      `UPDATE cash_boxes SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    await logAudit(userId, 'DELETE', 'cash_boxes', id, existing.rows[0], null, req, `حذف الصندوق المالي: ${existing.rows[0].name_ar}`);

    successResponse(res, null, 'تم حذف الصندوق بنجاح');
  } catch (error: any) {
    errorResponse(res, 'خطأ في حذف الصندوق المالي', 500, error.message);
  }
};


// ==========================================
// BANK ACCOUNTS MASTER CONTROLLER
// ==========================================

export const getBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const { search, branchId, status, page = 1, limit = 50 } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const params: any[] = [companyId];
    let queryText = `
      SELECT ba.*,
             b.name_ar AS branch_name_ar, b.name_en AS branch_name_en,
             c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol,
             gl.code AS gl_account_code, gl.name_ar AS gl_account_name,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'currency_id', bac.currency_id,
                     'currency_code', cur.code,
                     'currency_name', cur.name_ar,
                     'symbol', cur.symbol,
                     'current_balance', bac.current_balance,
                     'opening_balance', bac.opening_balance,
                     'is_default', bac.is_default
                   )
                 )
                 FROM bank_account_currencies bac
                 JOIN currencies cur ON bac.currency_id = cur.id
                 WHERE bac.bank_account_id = ba.id
               ),
               '[]'::json
             ) AS currencies
      FROM bank_accounts ba
      LEFT JOIN branches b ON ba.branch_id = b.id
      LEFT JOIN currencies c ON ba.currency_id = c.id
      LEFT JOIN gl_accounts gl ON ba.gl_account_id = gl.id
      WHERE ba.company_id = $1 AND ba.is_deleted = FALSE
    `;

    if (search) {
      params.push(`%${search}%`);
      queryText += ` AND (ba.code ILIKE $${params.length} OR ba.name_ar ILIKE $${params.length} OR ba.name_en ILIKE $${params.length} OR ba.account_number ILIKE $${params.length} OR ba.iban ILIKE $${params.length})`;
    }

    if (branchId) {
      params.push(branchId);
      queryText += ` AND ba.branch_id = $${params.length}`;
    }

    if (status) {
      params.push(status);
      queryText += ` AND ba.status = $${params.length}`;
    }

    const countResult = await query(`SELECT COUNT(*) FROM (${queryText}) AS total`, params);
    const totalItems = parseInt(countResult.rows[0]?.count || '0', 10);

    queryText += ` ORDER BY ba.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);

    const result = await query(queryText, params);

    successResponse(res, {
      items: result.rows,
      pagination: {
        totalItems,
        totalPages: Math.ceil(totalItems / Number(limit)) || 1,
        currentPage: Number(page),
        limit: Number(limit),
      },
    });
  } catch (error: any) {
    errorResponse(res, 'خطأ في جلب الحسابات البنكية', 500, error.message);
  }
};

export const getBankAccountById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;

    const result = await query(
      `SELECT ba.*,
              b.name_ar AS branch_name_ar, c.code AS currency_code, gl.code AS gl_account_code, gl.name_ar AS gl_account_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'currency_id', bac.currency_id,
                      'currency_code', cur.code,
                      'currency_name', cur.name_ar,
                      'symbol', cur.symbol,
                      'current_balance', bac.current_balance,
                      'opening_balance', bac.opening_balance,
                      'is_default', bac.is_default
                    )
                  )
                  FROM bank_account_currencies bac
                  JOIN currencies cur ON bac.currency_id = cur.id
                  WHERE bac.bank_account_id = ba.id
                ),
                '[]'::json
              ) AS currencies
       FROM bank_accounts ba
       LEFT JOIN branches b ON ba.branch_id = b.id
       LEFT JOIN currencies c ON ba.currency_id = c.id
       LEFT JOIN gl_accounts gl ON ba.gl_account_id = gl.id
       WHERE ba.id = $1 AND ba.company_id = $2 AND ba.is_deleted = FALSE`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      errorResponse(res, 'الحساب البنكي غير موجود', 404);
      return;
    }

    successResponse(res, result.rows[0]);
  } catch (error: any) {
    errorResponse(res, 'خطأ في جلب تفاصيل الحساب البنكي', 500, error.message);
  }
};

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const {
      code,
      nameAr,
      nameEn,
      branchId,
      currencyId,
      currencyIds,
      glAccountId,
      accountNumber,
      iban,
      swift,
      contactPerson,
      phone,
      email,
      openingBalance = 0,
      status = 'Active',
      notes,
    } = req.body;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    if (!code || !nameAr || !branchId || chosenCurrencyIds.length === 0 || !glAccountId || !accountNumber) {
      errorResponse(res, 'جميع الحقول الأساسية مطلوبة (كود البنك، اسم البنك العربي، الفرع، العملة، الحساب المحاسبي، رقم الحساب)', 400);
      return;
    }

    const codeCheck = await query(
      `SELECT id FROM bank_accounts WHERE company_id = $1 AND code = $2 AND is_deleted = FALSE`,
      [companyId, code]
    );
    if (codeCheck.rows.length > 0) {
      errorResponse(res, 'كود الحساب البنكي مستخدم مسبقاً', 409);
      return;
    }

    const accCheck = await query(
      `SELECT id FROM bank_accounts WHERE company_id = $1 AND account_number = $2 AND is_deleted = FALSE`,
      [companyId, accountNumber]
    );
    if (accCheck.rows.length > 0) {
      errorResponse(res, 'رقم الحساب البنكي مستخدم مسبقاً', 409);
      return;
    }

    const primaryCurrencyId = chosenCurrencyIds[0];
    const currentBalance = Number(openingBalance) || 0;

    const result = await query(
      `INSERT INTO bank_accounts (
        company_id, branch_id, code, name_ar, name_en, currency_id, gl_account_id,
        account_number, iban, swift, contact_person, phone, email, opening_balance, current_balance,
        status, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *`,
      [
        companyId,
        branchId,
        code,
        nameAr,
        nameEn || nameAr,
        primaryCurrencyId,
        glAccountId,
        accountNumber,
        iban || null,
        swift || null,
        contactPerson || null,
        phone || null,
        email || null,
        Number(openingBalance) || 0,
        currentBalance,
        status,
        notes || null,
        userId,
      ]
    );

    const createdBank = result.rows[0];

    // Populate bank_account_currencies
    for (let i = 0; i < chosenCurrencyIds.length; i++) {
      const cId = chosenCurrencyIds[i];
      const openBal = (i === 0 && openingBalance !== undefined) ? Number(openingBalance) || 0 : 0;
      await query(
        `INSERT INTO bank_account_currencies (bank_account_id, currency_id, opening_balance, current_balance, is_default)
         VALUES ($1, $2, $3, $3, $4)
         ON CONFLICT (bank_account_id, currency_id) DO NOTHING`,
        [createdBank.id, cId, openBal, i === 0]
      );
    }

    await logAudit(userId, 'INSERT', 'bank_accounts', createdBank.id, null, createdBank, req, `إنشاء حساب بنكي جديد: ${nameAr} (${accountNumber})`);

    successResponse(res, createdBank, 'تم إضافة الحساب البنكي بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود أو رقم الحساب البنكي مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة الحساب البنكي', 500, error.message);
    }
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const {
      code,
      nameAr,
      nameEn,
      branchId,
      currencyId,
      currencyIds,
      glAccountId,
      accountNumber,
      iban,
      swift,
      contactPerson,
      phone,
      email,
      openingBalance,
      status,
      notes,
    } = req.body;

    const existing = await query(
      `SELECT * FROM bank_accounts WHERE id = $1 AND company_id = $2 AND is_deleted = FALSE`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      errorResponse(res, 'الحساب البنكي غير موجود', 404);
      return;
    }

    const oldValues = existing.rows[0];

    if (code && code !== oldValues.code) {
      const codeCheck = await query(
        `SELECT id FROM bank_accounts WHERE company_id = $1 AND code = $2 AND id != $3 AND is_deleted = FALSE`,
        [companyId, code, id]
      );
      if (codeCheck.rows.length > 0) {
        errorResponse(res, 'كود الحساب البنكي مستخدم مسبقاً', 409);
        return;
      }
    }

    if (accountNumber && accountNumber !== oldValues.account_number) {
      const accCheck = await query(
        `SELECT id FROM bank_accounts WHERE company_id = $1 AND account_number = $2 AND id != $3 AND is_deleted = FALSE`,
        [companyId, accountNumber, id]
      );
      if (accCheck.rows.length > 0) {
        errorResponse(res, 'رقم الحساب البنكي مستخدم مسبقاً', 409);
        return;
      }
    }

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    const primaryCurrencyId = chosenCurrencyIds.length > 0 ? chosenCurrencyIds[0] : null;

    const result = await query(
      `UPDATE bank_accounts SET
        code = COALESCE($1, code),
        name_ar = COALESCE($2, name_ar),
        name_en = COALESCE($3, name_en),
        branch_id = COALESCE($4, branch_id),
        currency_id = COALESCE($5, currency_id),
        gl_account_id = COALESCE($6, gl_account_id),
        account_number = COALESCE($7, account_number),
        iban = COALESCE($8, iban),
        swift = COALESCE($9, swift),
        contact_person = COALESCE($10, contact_person),
        phone = COALESCE($11, phone),
        email = COALESCE($12, email),
        opening_balance = COALESCE($13, opening_balance),
        status = COALESCE($14, status),
        notes = COALESCE($15, notes),
        updated_at = NOW()
       WHERE id = $16 AND company_id = $17
       RETURNING *`,
      [
        code,
        nameAr,
        nameEn,
        branchId,
        primaryCurrencyId,
        glAccountId,
        accountNumber,
        iban,
        swift,
        contactPerson,
        phone,
        email,
        openingBalance !== undefined ? Number(openingBalance) : null,
        status,
        notes,
        id,
        companyId,
      ]
    );

    const updatedBank = result.rows[0];

    // Sync bank_account_currencies
    if (chosenCurrencyIds.length > 0) {
      for (let i = 0; i < chosenCurrencyIds.length; i++) {
        const cId = chosenCurrencyIds[i];
        await query(
          `INSERT INTO bank_account_currencies (bank_account_id, currency_id, opening_balance, current_balance, is_default)
           VALUES ($1, $2, 0, 0, $3)
           ON CONFLICT (bank_account_id, currency_id) DO UPDATE SET is_default = $3`,
          [id, cId, i === 0]
        );
      }
      await query(
        `DELETE FROM bank_account_currencies WHERE bank_account_id = $1 AND currency_id != ALL($2) AND current_balance = 0`,
        [id, chosenCurrencyIds]
      );
    }

    await logAudit(userId, 'UPDATE', 'bank_accounts', updatedBank.id, oldValues, updatedBank, req, `تحديث بيانات الحساب البنكي: ${updatedBank.name_ar}`);

    successResponse(res, updatedBank, 'تم تحديث بيانات الحساب البنكي بنجاح');
  } catch (error: any) {
    errorResponse(res, 'خطأ في تحديث الحساب البنكي', 500, error.message);
  }
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;

    const existing = await query(
      `SELECT * FROM bank_accounts WHERE id = $1 AND company_id = $2 AND is_deleted = FALSE`,
      [id, companyId]
    );

    if (existing.rows.length === 0) {
      errorResponse(res, 'الحساب البنكي غير موجود', 404);
      return;
    }

    const rvCheck = await query(`SELECT id FROM receipt_vouchers WHERE bank_account_id = $1 LIMIT 1`, [id]);
    const pvCheck = await query(`SELECT id FROM payment_vouchers WHERE bank_account_id = $1 LIMIT 1`, [id]);
    const jlCheck = await query(`SELECT id FROM journal_entry_lines WHERE bank_account_id = $1 LIMIT 1`, [id]);

    if (rvCheck.rows.length > 0 || pvCheck.rows.length > 0 || jlCheck.rows.length > 0) {
      errorResponse(res, 'لا يمكن حذف الحساب البنكي لارتباطه بمعاملات مالية سابقة', 400);
      return;
    }

    await query(
      `UPDATE bank_accounts SET is_deleted = TRUE, updated_at = NOW() WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    await logAudit(userId, 'DELETE', 'bank_accounts', id, existing.rows[0], null, req, `حذف الحساب البنكي: ${existing.rows[0].name_ar}`);

    successResponse(res, null, 'تم حذف الحساب البنكي بنجاح');
  } catch (error: any) {
    errorResponse(res, 'خطأ في حذف الحساب البنكي', 500, error.message);
  }
};

// ==========================================
// CURRENCY TRANSFERS & EXCHANGE
// ==========================================

export const getCurrencyTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const result = await query(
      `SELECT ct.*,
              sc.code AS source_currency_code, sc.name_ar AS source_currency_name, sc.symbol AS source_currency_symbol,
              tc.code AS target_currency_code, tc.name_ar AS target_currency_name, tc.symbol AS target_currency_symbol,
              scb.name_ar AS source_cash_box_name, tcb.name_ar AS target_cash_box_name,
              sba.name_ar AS source_bank_account_name, tba.name_ar AS target_bank_account_name
       FROM currency_transfers ct
       JOIN currencies sc ON ct.source_currency_id = sc.id
       JOIN currencies tc ON ct.target_currency_id = tc.id
       LEFT JOIN cash_boxes scb ON ct.source_cash_box_id = scb.id
       LEFT JOIN cash_boxes tcb ON ct.target_cash_box_id = tcb.id
       LEFT JOIN bank_accounts sba ON ct.source_bank_account_id = sba.id
       LEFT JOIN bank_accounts tba ON ct.target_bank_account_id = tba.id
       WHERE ct.company_id = $1
       ORDER BY ct.transfer_date DESC, ct.created_at DESC`,
      [companyId]
    );
    successResponse(res, result.rows);
  } catch (error: any) {
    errorResponse(res, 'خطأ في جلب عمليات تحويل وصرف العملة', 500, error.message);
  }
};

export const createCurrencyTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const userId = req.user!.userId;
    const branchId = req.user!.branchId;

    const {
      transferDate,
      sourceCashBoxId,
      sourceBankAccountId,
      sourceCurrencyId,
      sourceAmount,
      targetCashBoxId,
      targetBankAccountId,
      targetCurrencyId,
      targetAmount,
      exchangeRate,
      differenceAmount = 0,
      notes,
    } = req.body;

    if (!transferDate || !sourceCurrencyId || !targetCurrencyId || Number(sourceAmount) <= 0 || Number(targetAmount) <= 0 || Number(exchangeRate) <= 0) {
      errorResponse(res, 'تاريخ التحويل والعملات والمبالغ وسعر الصرف مطلوبة وقيمها أكبر من صفر', 400);
      return;
    }

    if (!sourceCashBoxId && !sourceBankAccountId) {
      errorResponse(res, 'يجب تحديد الصندوق أو الحساب البنكي المصدر', 400);
      return;
    }
    if (!targetCashBoxId && !targetBankAccountId) {
      errorResponse(res, 'يجب تحديد الصندوق أو الحساب البنكي المستلم', 400);
      return;
    }

    await transaction(async (client) => {
      // 1. Verify available balance in source currency
      if (sourceCashBoxId) {
        const balRes = await client.query(
          `SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2 FOR UPDATE`,
          [sourceCashBoxId, sourceCurrencyId]
        );
        const currBal = balRes.rows.length > 0 ? Number(balRes.rows[0].current_balance) : 0;
        if (currBal < Number(sourceAmount)) {
          const curRes = await client.query(`SELECT code FROM currencies WHERE id = $1`, [sourceCurrencyId]);
          const curCode = curRes.rows[0]?.code || '';
          throw new Error(`رصيد الـ ${curCode} غير كافٍ في الصندوق المصدر. الرصيد المتوفر: ${currBal} ${curCode}، المطلوب تحويله: ${sourceAmount} ${curCode}`);
        }
        // Deduct from source cash box
        await client.query(
          `UPDATE cash_box_currencies SET current_balance = current_balance - $1 WHERE cash_box_id = $2 AND currency_id = $3`,
          [sourceAmount, sourceCashBoxId, sourceCurrencyId]
        );
      } else if (sourceBankAccountId) {
        const balRes = await client.query(
          `SELECT current_balance FROM bank_account_currencies WHERE bank_account_id = $1 AND currency_id = $2 FOR UPDATE`,
          [sourceBankAccountId, sourceCurrencyId]
        );
        const currBal = balRes.rows.length > 0 ? Number(balRes.rows[0].current_balance) : 0;
        if (currBal < Number(sourceAmount)) {
          const curRes = await client.query(`SELECT code FROM currencies WHERE id = $1`, [sourceCurrencyId]);
          const curCode = curRes.rows[0]?.code || '';
          throw new Error(`رصيد الـ ${curCode} غير كافٍ في الحساب البنكي المصدر. الرصيد المتوفر: ${currBal} ${curCode}`);
        }
        await client.query(
          `UPDATE bank_account_currencies SET current_balance = current_balance - $1 WHERE bank_account_id = $2 AND currency_id = $3`,
          [sourceAmount, sourceBankAccountId, sourceCurrencyId]
        );
      }

      // 2. Add to target cash box / bank account in target currency
      if (targetCashBoxId) {
        await client.query(
          `INSERT INTO cash_box_currencies (cash_box_id, currency_id, current_balance, opening_balance, is_default)
           VALUES ($1, $2, $3, 0, FALSE)
           ON CONFLICT (cash_box_id, currency_id)
           DO UPDATE SET current_balance = cash_box_currencies.current_balance + $3`,
          [targetCashBoxId, targetCurrencyId, targetAmount]
        );
      } else if (targetBankAccountId) {
        await client.query(
          `INSERT INTO bank_account_currencies (bank_account_id, currency_id, current_balance, opening_balance, is_default)
           VALUES ($1, $2, $3, 0, FALSE)
           ON CONFLICT (bank_account_id, currency_id)
           DO UPDATE SET current_balance = bank_account_currencies.current_balance + $3`,
          [targetBankAccountId, targetCurrencyId, targetAmount]
        );
      }

      // 3. Generate Double-entry Journal Entry
      const transferNumber = `FX-${Date.now()}`;
      const jeNumber = `JE-FX-${Date.now()}`;

      // Get GL accounts
      let sourceGlAccountId: string | null = null;
      let targetGlAccountId: string | null = null;

      if (sourceCashBoxId) {
        const r = await client.query(`SELECT gl_account_id FROM cash_boxes WHERE id = $1`, [sourceCashBoxId]);
        sourceGlAccountId = r.rows[0]?.gl_account_id;
      } else if (sourceBankAccountId) {
        const r = await client.query(`SELECT gl_account_id FROM bank_accounts WHERE id = $1`, [sourceBankAccountId]);
        sourceGlAccountId = r.rows[0]?.gl_account_id;
      }

      if (targetCashBoxId) {
        const r = await client.query(`SELECT gl_account_id FROM cash_boxes WHERE id = $1`, [targetCashBoxId]);
        targetGlAccountId = r.rows[0]?.gl_account_id;
      } else if (targetBankAccountId) {
        const r = await client.query(`SELECT gl_account_id FROM bank_accounts WHERE id = $1`, [targetBankAccountId]);
        targetGlAccountId = r.rows[0]?.gl_account_id;
      }

      // Determine Base valuation
      const sCur = await client.query(`SELECT code, is_default FROM currencies WHERE id = $1`, [sourceCurrencyId]);
      const tCur = await client.query(`SELECT code, is_default FROM currencies WHERE id = $1`, [targetCurrencyId]);
      
      const sIsDef = sCur.rows[0]?.is_default;
      const tIsDef = tCur.rows[0]?.is_default;
      
      // Calculate base amounts
      let baseValuation = Number(sourceAmount);
      if (!sIsDef && tIsDef) {
        baseValuation = Number(targetAmount);
      } else if (!sIsDef && !tIsDef) {
        baseValuation = Number(sourceAmount) * Number(exchangeRate);
      }

      const jeRes = await client.query(
        `INSERT INTO journal_entries (
          entry_number, entry_date, description, reference_no, reference_type, branch_id,
          currency_id, exchange_rate, total_debit, total_credit, created_by, status, posted_at
        ) VALUES ($1,$2,$3,$4,'CurrencyTransfer',$5,$6,$7,$8,$8,$9,'Posted',NOW()) RETURNING id`,
        [
          jeNumber,
          transferDate,
          notes || `صرف وتحويل عملة: ${sourceAmount} ${sCur.rows[0]?.code} إلى ${targetAmount} ${tCur.rows[0]?.code}`,
          transferNumber,
          branchId,
          targetCurrencyId,
          exchangeRate,
          baseValuation,
          userId,
        ]
      );
      const jeId = jeRes.rows[0].id;

      // Debit: Target (Receiving Account)
      if (targetGlAccountId) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, cash_box_id, bank_account_id, debit, credit, debit_base, credit_base, line_description, sort_order)
           VALUES ($1,$2,$3,$4,$5,0,$6,0,$7,0)`,
          [
            jeId, targetGlAccountId, targetCashBoxId || null, targetBankAccountId || null,
            Number(targetAmount), baseValuation, `استلام عملة محولة: ${targetAmount} ${tCur.rows[0]?.code}`
          ]
        );
      }

      // Credit: Source (Sending Account)
      if (sourceGlAccountId) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, cash_box_id, bank_account_id, debit, credit, debit_base, credit_base, line_description, sort_order)
           VALUES ($1,$2,$3,$4,0,$5,0,$6,$7,1)`,
          [
            jeId, sourceGlAccountId, sourceCashBoxId || null, sourceBankAccountId || null,
            Number(sourceAmount), baseValuation, `صرف عملة للتحويل: ${sourceAmount} ${sCur.rows[0]?.code}`
          ]
        );
      }

      // 4. Record Transfer
      const transferRes = await client.query(
        `INSERT INTO currency_transfers (
          company_id, branch_id, transfer_number, transfer_date,
          source_cash_box_id, source_bank_account_id, source_currency_id, source_amount,
          target_cash_box_id, target_bank_account_id, target_currency_id, target_amount,
          exchange_rate, difference_amount, notes, status, journal_entry_id, created_by
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Posted',$16,$17)
        RETURNING *`,
        [
          companyId, branchId, transferNumber, transferDate,
          sourceCashBoxId || null, sourceBankAccountId || null, sourceCurrencyId, Number(sourceAmount),
          targetCashBoxId || null, targetBankAccountId || null, targetCurrencyId, Number(targetAmount),
          Number(exchangeRate), Number(differenceAmount) || 0, notes || null, jeId, userId
        ]
      );

      successResponse(res, transferRes.rows[0], 'تم تنفيذ عملية تحويل وصرف العملة بنجاح وتحديث الأرصدة والقيود المحاسبية', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في تنفيذ عملية تحويل وصرف العملة', 500);
  }
};
