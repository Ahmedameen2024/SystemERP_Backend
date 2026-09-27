import { Request, Response } from 'express';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// ============================================================
// SUPPLIER GROUPS
// ============================================================

export const getSupplierGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT sg.*, 
              gl.code AS account_code, gl.name_ar AS account_name,
              c.code AS currency_code, c.name_ar AS currency_name,
              (SELECT COUNT(*) FROM suppliers s WHERE s.group_id = sg.id) AS supplier_count
       FROM supplier_groups sg
       LEFT JOIN gl_accounts gl ON gl.id = sg.default_account_id
       LEFT JOIN currencies c ON c.id = sg.default_currency_id
       WHERE sg.company_id = $1
       ORDER BY sg.created_at DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب مجموعات الموردين', 500);
  }
};

export const createSupplierGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, description, defaultAccountId, defaultCurrencyId, status } = req.body;
    if (!nameAr) { errorResponse(res, 'اسم المجموعة مطلوب', 400); return; }
    if (!code) { errorResponse(res, 'كود المجموعة مطلوب', 400); return; }

    const result = await query(
      `INSERT INTO supplier_groups (company_id, code, name_ar, name_en, description, default_account_id, default_currency_id, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.companyId, code, nameAr, nameEn || null, description || null,
      defaultAccountId || null, defaultCurrencyId || null, status || 'Active', req.user!.userId]
    );
    successResponse(res, result.rows[0], 'تم إضافة مجموعة الموردين بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود المجموعة مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة مجموعة الموردين', 500);
    }
  }
};

export const updateSupplierGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, nameAr, nameEn, description, defaultAccountId, defaultCurrencyId, status } = req.body;

    const result = await query(
      `UPDATE supplier_groups SET code=$1, name_ar=$2, name_en=$3, description=$4,
       default_account_id=$5, default_currency_id=$6, status=$7, updated_at=NOW()
       WHERE id=$8 AND company_id=$9 RETURNING *`,
      [code, nameAr, nameEn || null, description || null,
        defaultAccountId || null, defaultCurrencyId || null, status,
        id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'المجموعة غير موجودة', 404); return; }
    successResponse(res, result.rows[0], 'تم تحديث مجموعة الموردين بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث مجموعة الموردين', 500);
  }
};

export const deleteSupplierGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    // Check if used
    const usedCheck = await query(
      `SELECT COUNT(*) FROM suppliers WHERE group_id = $1`, [id]
    );
    if (parseInt(usedCheck.rows[0].count) > 0) {
      errorResponse(res, 'لا يمكن حذف مجموعة تحتوي على موردين. قم بتعطيلها بدلاً من الحذف.', 400);
      return;
    }
    await query(`DELETE FROM supplier_groups WHERE id=$1 AND company_id=$2`, [id, req.user!.companyId]);
    successResponse(res, null, 'تم حذف مجموعة الموردين بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف مجموعة الموردين', 500);
  }
};

// ============================================================
// SUPPLIER TYPES
// ============================================================

export const getSupplierTypes = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT st.*,
              (SELECT COUNT(*) FROM suppliers s WHERE s.type_id = st.id) AS supplier_count
       FROM supplier_types st
       WHERE st.company_id = $1
       ORDER BY st.created_at DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب أنواع الموردين', 500);
  }
};

export const createSupplierType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, description, status } = req.body;
    if (!nameAr) { errorResponse(res, 'اسم النوع مطلوب', 400); return; }
    if (!code) { errorResponse(res, 'كود النوع مطلوب', 400); return; }

    const result = await query(
      `INSERT INTO supplier_types (company_id, code, name_ar, name_en, description, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user!.companyId, code, nameAr, nameEn || null, description || null, status || 'Active', req.user!.userId]
    );
    successResponse(res, result.rows[0], 'تم إضافة نوع المورد بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود النوع مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة نوع المورد', 500);
    }
  }
};

export const updateSupplierType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, nameAr, nameEn, description, status } = req.body;
    const result = await query(
      `UPDATE supplier_types SET code=$1, name_ar=$2, name_en=$3, description=$4, status=$5
       WHERE id=$6 AND company_id=$7 RETURNING *`,
      [code, nameAr, nameEn || null, description || null, status, id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'النوع غير موجود', 404); return; }
    successResponse(res, result.rows[0], 'تم تحديث نوع المورد بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث نوع المورد', 500);
  }
};

export const deleteSupplierType = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usedCheck = await query(`SELECT COUNT(*) FROM suppliers WHERE type_id = $1`, [id]);
    if (parseInt(usedCheck.rows[0].count) > 0) {
      errorResponse(res, 'لا يمكن حذف نوع مستخدم من قِبل موردين', 400);
      return;
    }
    await query(`DELETE FROM supplier_types WHERE id=$1 AND company_id=$2`, [id, req.user!.companyId]);
    successResponse(res, null, 'تم حذف نوع المورد بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف نوع المورد', 500);
  }
};

// ============================================================
// PAYMENT TERMS
// ============================================================

export const getPaymentTerms = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM payment_terms WHERE company_id = $1 ORDER BY days ASC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب شروط الدفع', 500);
  }
};

export const createPaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, nameAr, nameEn, days, paymentType, description, status } = req.body;
    if (!nameAr) { errorResponse(res, 'اسم الشرط مطلوب', 400); return; }
    if (!code) { errorResponse(res, 'كود الشرط مطلوب', 400); return; }

    const result = await query(
      `INSERT INTO payment_terms (company_id, code, name_ar, name_en, days, payment_type, description, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user!.companyId, code, nameAr, nameEn || null, days || 0,
      paymentType || 'Credit', description || null, status || 'Active', req.user!.userId]
    );
    successResponse(res, result.rows[0], 'تم إضافة شرط الدفع بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') {
      errorResponse(res, 'كود شرط الدفع مستخدم مسبقاً', 409);
    } else {
      errorResponse(res, 'خطأ في إضافة شرط الدفع', 500);
    }
  }
};

export const updatePaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { code, nameAr, nameEn, days, paymentType, description, status } = req.body;
    const result = await query(
      `UPDATE payment_terms SET code=$1, name_ar=$2, name_en=$3, days=$4, payment_type=$5,
       description=$6, status=$7 WHERE id=$8 AND company_id=$9 RETURNING *`,
      [code, nameAr, nameEn || null, days || 0, paymentType || 'Credit',
        description || null, status, id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'شرط الدفع غير موجود', 404); return; }
    successResponse(res, result.rows[0], 'تم تحديث شرط الدفع بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في تحديث شرط الدفع', 500);
  }
};

export const deletePaymentTerm = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const usedCheck = await query(`SELECT COUNT(*) FROM suppliers WHERE payment_term_id = $1`, [id]);
    if (parseInt(usedCheck.rows[0].count) > 0) {
      errorResponse(res, 'لا يمكن حذف شرط دفع مستخدم', 400);
      return;
    }
    await query(`DELETE FROM payment_terms WHERE id=$1 AND company_id=$2`, [id, req.user!.companyId]);
    successResponse(res, null, 'تم حذف شرط الدفع بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف شرط الدفع', 500);
  }
};

// ============================================================
// SUPPLIERS (Enhanced)
// ============================================================

export const getSuppliers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search = '', status, groupId, typeId } = req.query;
    let sql = `SELECT s.*,
                      sg.name_ar AS group_name,
                      st.name_ar AS type_name,
                      pt.name_ar AS payment_term_name, pt.days AS payment_days,
                      c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol,
                      gl.code AS ap_account_code, gl.name_ar AS ap_account_name
               FROM suppliers s
               LEFT JOIN supplier_groups sg ON sg.id = s.group_id
               LEFT JOIN supplier_types st ON st.id = s.type_id
               LEFT JOIN payment_terms pt ON pt.id = s.payment_term_id
               LEFT JOIN currencies c ON c.id = s.currency_id
               LEFT JOIN gl_accounts gl ON gl.id = s.ap_account_id
               WHERE s.company_id = $1`;
    const params: unknown[] = [req.user!.companyId];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (s.name_ar ILIKE $${params.length} OR s.code ILIKE $${params.length} OR s.phone ILIKE $${params.length} OR s.email ILIKE $${params.length})`;
    }
    if (status) { params.push(status); sql += ` AND s.status = $${params.length}`; }
    if (groupId) { params.push(groupId); sql += ` AND s.group_id = $${params.length}`; }
    if (typeId) { params.push(typeId); sql += ` AND s.type_id = $${params.length}`; }

    sql += ' ORDER BY s.created_at DESC';

    const result = await query(sql, params);

    // Attach currencies per supplier
    const supplierIds = result.rows.map((r: any) => r.id);
    let currenciesMap: Record<string, any[]> = {};
    if (supplierIds.length > 0) {
      const currRes = await query(
        `SELECT sc.*, cur.code AS currency_code, cur.name_ar AS currency_name, cur.symbol
         FROM supplier_currencies sc
         JOIN currencies cur ON cur.id = sc.currency_id
         WHERE sc.supplier_id = ANY($1)`,
        [supplierIds]
      );
      for (const row of currRes.rows) {
        if (!currenciesMap[row.supplier_id]) currenciesMap[row.supplier_id] = [];
        currenciesMap[row.supplier_id].push(row);
      }
    }

    const enriched = result.rows.map((s: any) => ({
      ...s,
      currencies: currenciesMap[s.id] || [],
    }));

    successResponse(res, enriched);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الموردين', 500);
  }
};

export const getSupplierById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT s.*,
              sg.name_ar AS group_name, st.name_ar AS type_name,
              pt.name_ar AS payment_term_name, pt.days AS payment_days,
              c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol,
              gl.code AS ap_account_code, gl.name_ar AS ap_account_name,
              pgl.code AS purchase_account_code, pgl.name_ar AS purchase_account_name
       FROM suppliers s
       LEFT JOIN supplier_groups sg ON sg.id = s.group_id
       LEFT JOIN supplier_types st ON st.id = s.type_id
       LEFT JOIN payment_terms pt ON pt.id = s.payment_term_id
       LEFT JOIN currencies c ON c.id = s.currency_id
       LEFT JOIN gl_accounts gl ON gl.id = s.ap_account_id
       LEFT JOIN gl_accounts pgl ON pgl.id = s.purchase_account_id
       WHERE s.id = $1 AND s.company_id = $2`,
      [id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'المورد غير موجود', 404); return; }

    const currencies = await query(
      `SELECT sc.*, cur.code AS currency_code, cur.name_ar AS currency_name, cur.symbol
       FROM supplier_currencies sc
       JOIN currencies cur ON cur.id = sc.currency_id
       WHERE sc.supplier_id = $1`,
      [id]
    );

    successResponse(res, { ...result.rows[0], currencies: currencies.rows });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب بيانات المورد', 500);
  }
};

export const createSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      nameAr, nameEn, tradeName, contactPerson, responsiblePerson,
      phone, additionalPhone, email, website,
      city, address, country, region,
      taxNumber, crNumber,
      creditLimit, openingBalance,
      currencyId, currencyIds,
      paymentTerms, paymentTermId,
      apAccountId, purchaseAccountId,
      groupId, typeId,
      bankName, bankAccountNumber, iban, bankBranch, swiftCode,
      status
    } = req.body;

    if (!nameAr) { errorResponse(res, 'اسم المورد العربي مطلوب', 400); return; }
    if (!currencyIds || currencyIds.length === 0) {
      errorResponse(res, 'يجب تحديد عملة واحدة على الأقل للمورد', 400);
      return;
    }

    await transaction(async (client) => {
      // Generate supplier code
      const seqRes = await client.query(
        `SELECT COALESCE(MAX(CAST(NULLIF(REGEXP_REPLACE(code, '[^0-9]', '', 'g'), '') AS INTEGER)), 0) + 1 AS next_num
         FROM suppliers WHERE company_id = $1`,
        [req.user!.companyId]
      );
      const nextNum = seqRes.rows[0].next_num || 1;
      const code = `SUP-${String(nextNum).padStart(5, '0')}`;

      const primaryCurrencyId = currencyIds[0] || currencyId;
      const creditLimitValue = creditLimit !== '' && creditLimit !== null && creditLimit !== undefined
        ? parseFloat(creditLimit) : null;
      const openingBalanceValue = openingBalance ? parseFloat(openingBalance) : 0;

      const result = await client.query(
        `INSERT INTO suppliers (
          company_id, code, name_ar, name_en, trade_name,
          contact_person, responsible_person,
          phone, additional_phone, email, website,
          city, address, country, region,
          tax_number, cr_number,
          credit_limit, opening_balance, balance,
          currency_id, payment_terms, payment_term_id,
          ap_account_id, purchase_account_id,
          group_id, type_id,
          bank_name, bank_account_number, iban, bank_branch, swift_code,
          status, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          $18,$19,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,NOW()
        ) RETURNING *`,
        [
          req.user!.companyId, code, nameAr, nameEn || null, tradeName || null,
          contactPerson || null, responsiblePerson || null,
          phone || null, additionalPhone || null, email || null, website || null,
          city || null, address || null, country || 'Saudi Arabia', region || null,
          taxNumber || null, crNumber || null,
          creditLimitValue, openingBalanceValue,
          primaryCurrencyId, paymentTerms || 30, paymentTermId || null,
          apAccountId || null, purchaseAccountId || null,
          groupId || null, typeId || null,
          bankName || null, bankAccountNumber || null, iban || null, bankBranch || null, swiftCode || null,
          status || 'Active'
        ]
      );

      const supplierId = result.rows[0].id;

      // Insert supplier currencies
      for (let i = 0; i < currencyIds.length; i++) {
        await client.query(
          `INSERT INTO supplier_currencies (supplier_id, currency_id, opening_balance, balance, is_default)
           VALUES ($1, $2, $3, $3, $4)
           ON CONFLICT (supplier_id, currency_id) DO UPDATE SET is_default = $4`,
          [supplierId, currencyIds[i], i === 0 ? openingBalanceValue : 0, i === 0]
        );
      }

      // Audit log
      await client.query(
        `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, new_values, description)
         VALUES ($1, 'INSERT', 'suppliers', $2, $3, $4)`,
        [req.user!.userId, supplierId, JSON.stringify(result.rows[0]), `إنشاء مورد جديد: ${nameAr}`]
      );

      successResponse(res, result.rows[0], 'تم إضافة المورد بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إضافة المورد', 500);
  }
};

export const updateSupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      nameAr, nameEn, tradeName, contactPerson, responsiblePerson,
      phone, additionalPhone, email, website,
      city, address, country, region,
      taxNumber, crNumber,
      creditLimit, paymentTerms, paymentTermId,
      apAccountId, purchaseAccountId,
      groupId, typeId,
      currencyIds,
      bankName, bankAccountNumber, iban, bankBranch, swiftCode,
      status
    } = req.body;

    const creditLimitValue = creditLimit !== '' && creditLimit !== null && creditLimit !== undefined
      ? parseFloat(creditLimit) : null;
    const chosenCurrencyIds = Array.isArray(currencyIds) ? currencyIds : [];
    const primaryCurrencyId = chosenCurrencyIds[0] || null;

    await transaction(async (client) => {
      const oldRes = await client.query(`SELECT * FROM suppliers WHERE id=$1 AND company_id=$2`, [id, req.user!.companyId]);
      if (oldRes.rows.length === 0) throw new Error('NOT_FOUND');
      const old = oldRes.rows[0];

      await client.query(
        `UPDATE suppliers SET
          name_ar=$1, name_en=$2, trade_name=$3,
          contact_person=$4, responsible_person=$5,
          phone=$6, additional_phone=$7, email=$8, website=$9,
          city=$10, address=$11, country=$12, region=$13,
          tax_number=$14, cr_number=$15, credit_limit=$16,
          currency_id=COALESCE($17, currency_id),
          payment_terms=$18, payment_term_id=$19,
          ap_account_id=$20, purchase_account_id=$21,
          group_id=$22, type_id=$23,
          bank_name=$24, bank_account_number=$25, iban=$26, bank_branch=$27, swift_code=$28,
          status=$29
         WHERE id=$30 AND company_id=$31`,
        [
          nameAr, nameEn || null, tradeName || null,
          contactPerson || null, responsiblePerson || null,
          phone || null, additionalPhone || null, email || null, website || null,
          city || null, address || null, country || 'Saudi Arabia', region || null,
          taxNumber || null, crNumber || null, creditLimitValue,
          primaryCurrencyId, paymentTerms || 30, paymentTermId || null,
          apAccountId || null, purchaseAccountId || null,
          groupId || null, typeId || null,
          bankName || null, bankAccountNumber || null, iban || null, bankBranch || null, swiftCode || null,
          status || 'Active',
          id, req.user!.companyId
        ]
      );

      // Sync currencies
      if (chosenCurrencyIds.length > 0) {
        for (let i = 0; i < chosenCurrencyIds.length; i++) {
          await client.query(
            `INSERT INTO supplier_currencies (supplier_id, currency_id, opening_balance, balance, is_default)
             VALUES ($1, $2, 0, 0, $3)
             ON CONFLICT (supplier_id, currency_id) DO UPDATE SET is_default = $3`,
            [id, chosenCurrencyIds[i], i === 0]
          );
        }
        // Remove unused currencies (only if balance = 0)
        await client.query(
          `DELETE FROM supplier_currencies WHERE supplier_id = $1 AND currency_id != ALL($2) AND balance = 0`,
          [id, chosenCurrencyIds]
        );
      }

      // Audit
      await client.query(
        `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, old_values, description)
         VALUES ($1, 'UPDATE', 'suppliers', $2, $3, $4)`,
        [req.user!.userId, id, JSON.stringify(old), `تعديل بيانات المورد: ${nameAr}`]
      );
    });

    const updated = await query(
      `SELECT s.*, sg.name_ar AS group_name, st.name_ar AS type_name
       FROM suppliers s
       LEFT JOIN supplier_groups sg ON sg.id = s.group_id
       LEFT JOIN supplier_types st ON st.id = s.type_id
       WHERE s.id = $1`,
      [id]
    );
    successResponse(res, updated.rows[0], 'تم تحديث المورد بنجاح');
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      errorResponse(res, 'المورد غير موجود', 404);
    } else {
      errorResponse(res, error.message || 'خطأ في تحديث المورد', 500);
    }
  }
};

export const toggleSupplierStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await query(
      `UPDATE suppliers SET status=$1 WHERE id=$2 AND company_id=$3 RETURNING *`,
      [status, id, req.user!.companyId]
    );
    if (result.rows.length === 0) { errorResponse(res, 'المورد غير موجود', 404); return; }
    successResponse(res, result.rows[0], status === 'Active' ? 'تم تفعيل المورد' : 'تم تعطيل المورد');
  } catch (error) {
    errorResponse(res, 'خطأ في تغيير حالة المورد', 500);
  }
};

// ============================================================
// SUPPLIER PROFILE (Statement, Purchases, Payments)
// ============================================================

export const getSupplierStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { fromDate, toDate, currencyId } = req.query;

    // Build the statement from journal entries linked to this supplier
    let sql = `
      SELECT 
        je.entry_date AS date,
        je.entry_number AS document_number,
        je.reference_no,
        je.reference_type AS transaction_type,
        jel.line_description AS description,
        CASE WHEN jel.debit > 0 THEN jel.debit ELSE 0 END AS debit,
        CASE WHEN jel.credit > 0 THEN jel.credit ELSE 0 END AS credit,
        c.code AS currency_code,
        je.exchange_rate,
        jel.debit_base,
        jel.credit_base
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      LEFT JOIN currencies c ON c.id = je.currency_id
      WHERE jel.supplier_id = $1
        AND je.status = 'Posted'
    `;
    const params: unknown[] = [id];

    if (fromDate) { params.push(fromDate); sql += ` AND je.entry_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); sql += ` AND je.entry_date <= $${params.length}`; }
    if (currencyId) { params.push(currencyId); sql += ` AND je.currency_id = $${params.length}`; }

    sql += ` ORDER BY je.entry_date ASC, je.created_at ASC`;

    const result = await query(sql, params);

    // Calculate running balance
    let balance = 0;
    const rows = result.rows.map((row: any) => {
      balance += (Number(row.credit) - Number(row.debit));
      return { ...row, balance };
    });

    // Summary
    const totalDebit = rows.reduce((s: number, r: any) => s + Number(r.debit), 0);
    const totalCredit = rows.reduce((s: number, r: any) => s + Number(r.credit), 0);

    successResponse(res, {
      rows,
      summary: {
        totalDebit,
        totalCredit,
        balance: totalCredit - totalDebit,
      },
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب كشف حساب المورد', 500);
  }
};

export const getSupplierOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const supplierRes = await query(
      `SELECT s.*, c.code AS currency_code, c.symbol
       FROM suppliers s LEFT JOIN currencies c ON c.id = s.currency_id
       WHERE s.id = $1 AND s.company_id = $2`,
      [id, req.user!.companyId]
    );
    if (supplierRes.rows.length === 0) { errorResponse(res, 'المورد غير موجود', 404); return; }
    const supplier = supplierRes.rows[0];

    const [invoicesRes, paymentsRes, openPORes, pendingReceiptsRes, evaluationRes] = await Promise.all([
      // Total purchases (posted)
      query(`SELECT COALESCE(SUM(net_amount * exchange_rate), 0) AS total_purchases,
                    COALESCE(SUM(remaining_amount * exchange_rate), 0) AS total_outstanding,
                    COALESCE(SUM(paid_amount * exchange_rate), 0) AS total_paid,
                    MAX(invoice_date) AS last_invoice_date,
                    COUNT(*) AS invoice_count
             FROM purchase_invoices WHERE supplier_id=$1 AND status='Posted'`, [id]),
      // Total payments
      query(`SELECT COALESCE(SUM(amount * exchange_rate), 0) AS total_payments,
                    MAX(voucher_date) AS last_payment_date
             FROM payment_vouchers WHERE supplier_id=$1 AND status='Posted'`, [id]),
      // Open purchase orders
      query(`SELECT COUNT(*) AS open_orders FROM purchase_orders 
             WHERE supplier_id=$1 AND status IN ('Approved', 'PartiallyReceived')`, [id]),
      // Pending receipts
      query(`SELECT COUNT(*) AS pending_receipts FROM purchase_receipts
             WHERE supplier_id=$1 AND status='Draft'`, [id]),
      // Latest evaluation
      query(`SELECT AVG(overall_score) AS avg_score, COUNT(*) AS eval_count
             FROM supplier_evaluations WHERE supplier_id=$1`, [id]),
    ]);

    const inv = invoicesRes.rows[0];
    const pmt = paymentsRes.rows[0];
    const creditLimit = Number(supplier.credit_limit) || 0;
    const outstanding = Number(inv.total_outstanding) || 0;
    const creditUsedPct = creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : null;

    successResponse(res, {
      supplier,
      totalPurchases: Number(inv.total_purchases) || 0,
      totalPaid: Number(pmt.total_payments) || 0,
      totalOutstanding: outstanding,
      creditLimit,
      creditUsedPct,
      lastInvoiceDate: inv.last_invoice_date,
      lastPaymentDate: pmt.last_payment_date,
      invoiceCount: Number(inv.invoice_count) || 0,
      openOrders: Number(openPORes.rows[0].open_orders) || 0,
      pendingReceipts: Number(pendingReceiptsRes.rows[0].pending_receipts) || 0,
      avgEvalScore: evaluationRes.rows[0].avg_score,
      evalCount: Number(evaluationRes.rows[0].eval_count) || 0,
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب ملخص المورد', 500);
  }
};

export const getSupplierPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, fromDate, toDate } = req.query;

    let sql = `SELECT pi.*, c.code AS currency_code, c.symbol
               FROM purchase_invoices pi
               JOIN currencies c ON c.id = pi.currency_id
               WHERE pi.supplier_id = $1`;
    const params: unknown[] = [id];
    if (status) { params.push(status); sql += ` AND pi.status = $${params.length}`; }
    if (fromDate) { params.push(fromDate); sql += ` AND pi.invoice_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); sql += ` AND pi.invoice_date <= $${params.length}`; }
    sql += ' ORDER BY pi.invoice_date DESC LIMIT 100';

    const result = await query(sql, params);

    // Also get purchase requests & orders
    const poRes = await query(
      `SELECT po.*, c.code AS currency_code FROM purchase_orders po
       JOIN currencies c ON c.id = po.currency_id
       WHERE po.supplier_id = $1 ORDER BY po.order_date DESC LIMIT 50`,
      [id]
    );

    successResponse(res, {
      invoices: result.rows,
      orders: poRes.rows,
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب مشتريات المورد', 500);
  }
};

export const getSupplierPayments = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT pv.*, c.code AS currency_code, c.symbol,
              pm.name_ar AS payment_method_name,
              cb.name_ar AS cash_box_name,
              ba.name_ar AS bank_account_name
       FROM payment_vouchers pv
       JOIN currencies c ON c.id = pv.currency_id
       LEFT JOIN payment_methods pm ON pm.id = pv.payment_method_id
       LEFT JOIN cash_boxes cb ON cb.id = pv.cash_box_id
       LEFT JOIN bank_accounts ba ON ba.id = pv.bank_account_id
       WHERE pv.supplier_id = $1
       ORDER BY pv.voucher_date DESC LIMIT 100`,
      [id]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب دفعات المورد', 500);
  }
};

// ============================================================
// SUPPLIER EVALUATIONS
// ============================================================

export const getSupplierEvaluations = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT se.*, u.name_ar AS evaluated_by_name
       FROM supplier_evaluations se
       LEFT JOIN users u ON u.id = se.evaluated_by
       WHERE se.supplier_id = $1
       ORDER BY se.evaluation_date DESC`,
      [id]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب تقييمات المورد', 500);
  }
};

export const createSupplierEvaluation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      evaluationDate, qualityScore, deliverySpeedScore, punctualityScore,
      priceComplianceScore, serviceQualityScore, responsivenessScore, notes
    } = req.body;

    const scores = [
      Number(qualityScore || 0), Number(deliverySpeedScore || 0),
      Number(punctualityScore || 0), Number(priceComplianceScore || 0),
      Number(serviceQualityScore || 0), Number(responsivenessScore || 0),
    ].filter(s => s > 0);
    const overallScore = scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const result = await query(
      `INSERT INTO supplier_evaluations
         (supplier_id, evaluation_date, quality_score, delivery_speed_score, punctuality_score,
          price_compliance_score, service_quality_score, responsiveness_score, overall_score, notes, evaluated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [id, evaluationDate, qualityScore || null, deliverySpeedScore || null,
        punctualityScore || null, priceComplianceScore || null,
        serviceQualityScore || null, responsivenessScore || null,
        overallScore.toFixed(2), notes || null, req.user!.userId]
    );
    successResponse(res, result.rows[0], 'تم إضافة التقييم بنجاح', 201);
  } catch (error) {
    errorResponse(res, 'خطأ في إضافة التقييم', 500);
  }
};

// ============================================================
// PURCHASE REQUESTS
// ============================================================

export const getPurchaseRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, supplierId, fromDate, toDate } = req.query;
    let sql = `SELECT pr.*,
                      s.name_ar AS supplier_name,
                      d.name_ar AS department_name,
                      u.name_ar AS requested_by_name,
                      au.name_ar AS approved_by_name
               FROM purchase_requests pr
               LEFT JOIN suppliers s ON s.id = pr.supplier_id
               LEFT JOIN departments d ON d.id = pr.department_id
               LEFT JOIN users u ON u.id = pr.requested_by
               LEFT JOIN users au ON au.id = pr.approved_by
               WHERE pr.branch_id IN (SELECT id FROM branches WHERE company_id = $1)`;
    const params: unknown[] = [req.user!.companyId];

    if (status) { params.push(status); sql += ` AND pr.status = $${params.length}`; }
    if (supplierId) { params.push(supplierId); sql += ` AND pr.supplier_id = $${params.length}`; }
    if (fromDate) { params.push(fromDate); sql += ` AND pr.request_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); sql += ` AND pr.request_date <= $${params.length}`; }
    sql += ' ORDER BY pr.created_at DESC LIMIT 200';

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب طلبات الشراء', 500);
  }
};

export const getPurchaseRequestById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const headerRes = await query(
      `SELECT pr.*, s.name_ar AS supplier_name, d.name_ar AS department_name,
              u.name_ar AS requested_by_name
       FROM purchase_requests pr
       LEFT JOIN suppliers s ON s.id = pr.supplier_id
       LEFT JOIN departments d ON d.id = pr.department_id
       LEFT JOIN users u ON u.id = pr.requested_by
       WHERE pr.id = $1`,
      [id]
    );
    if (headerRes.rows.length === 0) { errorResponse(res, 'طلب الشراء غير موجود', 404); return; }

    const linesRes = await query(
      `SELECT prl.*, i.name_ar AS item_name, i.code AS item_code, u.name_ar AS uom_name
       FROM purchase_request_lines prl
       JOIN items i ON i.id = prl.item_id
       JOIN uoms u ON u.id = prl.uom_id
       WHERE prl.purchase_request_id = $1 ORDER BY prl.sort_order`,
      [id]
    );
    successResponse(res, { ...headerRes.rows[0], lines: linesRes.rows });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب طلب الشراء', 500);
  }
};

export const createPurchaseRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, departmentId, requestDate, expectedDate, priority, notes, lines } = req.body;
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    await transaction(async (client) => {
      const seqRes = await client.query(`SELECT nextval('seq_purchase_request') AS seq`);
      const requestNumber = `PR-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      const headerRes = await client.query(
        `INSERT INTO purchase_requests
           (request_number, request_date, department_id, requested_by, supplier_id,
            branch_id, priority, expected_date, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Draft',$4) RETURNING *`,
        [requestNumber, requestDate, departmentId || null, req.user!.userId,
          supplierId || null, req.user!.branchId, priority || 'Normal', expectedDate || null, notes || '']
      );
      const prId = headerRes.rows[0].id;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        await client.query(
          `INSERT INTO purchase_request_lines
             (purchase_request_id, item_id, uom_id, quantity, estimated_price, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [prId, l.itemId, l.uomId, l.quantity, l.estimatedPrice || 0, l.notes || '', i]
        );
      }

      successResponse(res, headerRes.rows[0], 'تم إنشاء طلب الشراء بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء طلب الشراء', 500);
  }
};

export const approvePurchaseRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, reason } = req.body; // action: 'approve' | 'reject'

    const existing = await query(`SELECT * FROM purchase_requests WHERE id=$1`, [id]);
    if (existing.rows.length === 0) { errorResponse(res, 'الطلب غير موجود', 404); return; }
    if (!['Draft', 'Pending'].includes(existing.rows[0].status)) {
      errorResponse(res, 'لا يمكن تغيير حالة هذا الطلب', 400);
      return;
    }

    const newStatus = action === 'approve' ? 'Approved' : 'Rejected';
    await query(
      `UPDATE purchase_requests SET status=$1, approved_by=$2, approved_at=NOW(), rejection_reason=$3
       WHERE id=$4`,
      [newStatus, req.user!.userId, reason || null, id]
    );

    successResponse(res, null, newStatus === 'Approved' ? 'تم اعتماد طلب الشراء' : 'تم رفض طلب الشراء');
  } catch (error) {
    errorResponse(res, 'خطأ في تغيير حالة الطلب', 500);
  }
};

export const convertRequestToOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const prRes = await query(
      `SELECT pr.*, prl.*
       FROM purchase_requests pr
       JOIN purchase_request_lines prl ON prl.purchase_request_id = pr.id
       WHERE pr.id = $1 AND pr.status = 'Approved'`,
      [id]
    );
    if (prRes.rows.length === 0) {
      errorResponse(res, 'الطلب غير موجود أو غير معتمد', 404);
      return;
    }

    // Return the PR data for frontend to pre-fill PO form
    const pr = prRes.rows[0];
    const linesRes = await query(
      `SELECT prl.*, i.name_ar AS item_name, i.code AS item_code
       FROM purchase_request_lines prl
       JOIN items i ON i.id = prl.item_id
       WHERE prl.purchase_request_id = $1`,
      [id]
    );

    successResponse(res, {
      purchaseRequest: pr,
      lines: linesRes.rows,
    }, 'بيانات طلب الشراء جاهزة للتحويل لأمر شراء');
  } catch (error) {
    errorResponse(res, 'خطأ في تحويل الطلب', 500);
  }
};

// ============================================================
// PURCHASE ORDERS (Enhanced)
// ============================================================

export const getPurchaseOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, supplierId, fromDate, toDate } = req.query;
    let sql = `SELECT po.*,
                      s.name_ar AS supplier_name, s.code AS supplier_code,
                      c.code AS currency_code, c.symbol AS currency_symbol,
                      w.name_ar AS warehouse_name,
                      pt.name_ar AS payment_term_name
               FROM purchase_orders po
               JOIN suppliers s ON s.id = po.supplier_id
               JOIN currencies c ON c.id = po.currency_id
               LEFT JOIN warehouses w ON w.id = po.warehouse_id
               LEFT JOIN payment_terms pt ON pt.id = po.payment_term_id
               WHERE po.branch_id IN (SELECT id FROM branches WHERE company_id = $1)`;
    const params: unknown[] = [req.user!.companyId];

    if (status) { params.push(status); sql += ` AND po.status = $${params.length}`; }
    if (supplierId) { params.push(supplierId); sql += ` AND po.supplier_id = $${params.length}`; }
    if (fromDate) { params.push(fromDate); sql += ` AND po.order_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); sql += ` AND po.order_date <= $${params.length}`; }
    sql += ' ORDER BY po.created_at DESC LIMIT 200';

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب أوامر الشراء', 500);
  }
};

export const getPurchaseOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const headerRes = await query(
      `SELECT po.*, s.name_ar AS supplier_name, s.code AS supplier_code, s.phone AS supplier_phone,
              s.ap_account_id, c.code AS currency_code, c.symbol, c.decimal_places,
              w.name_ar AS warehouse_name
       FROM purchase_orders po
       JOIN suppliers s ON s.id = po.supplier_id
       JOIN currencies c ON c.id = po.currency_id
       LEFT JOIN warehouses w ON w.id = po.warehouse_id
       WHERE po.id = $1`,
      [id]
    );
    if (headerRes.rows.length === 0) { errorResponse(res, 'أمر الشراء غير موجود', 404); return; }

    const linesRes = await query(
      `SELECT pol.*, i.name_ar AS item_name, i.code AS item_code, u.name_ar AS uom_name,
              t.rate AS tax_rate, t.name_ar AS tax_name
       FROM purchase_order_lines pol
       JOIN items i ON i.id = pol.item_id
       JOIN uoms u ON u.id = pol.uom_id
       LEFT JOIN taxes t ON t.id = pol.tax_id
       WHERE pol.purchase_order_id = $1 ORDER BY pol.sort_order`,
      [id]
    );

    // Receipts for this PO
    const receiptsRes = await query(
      `SELECT pr.*, w.name_ar AS warehouse_name FROM purchase_receipts pr
       LEFT JOIN warehouses w ON w.id = pr.warehouse_id
       WHERE pr.purchase_order_id = $1 ORDER BY pr.receipt_date DESC`,
      [id]
    );

    successResponse(res, { ...headerRes.rows[0], lines: linesRes.rows, receipts: receiptsRes.rows });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب أمر الشراء', 500);
  }
};

export const createPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      supplierId, warehouseId, orderDate, expectedDate,
      currencyId, exchangeRate, paymentTermId,
      purchaseRequestId, notes, lines
    } = req.body;

    if (!supplierId) { errorResponse(res, 'المورد مطلوب', 400); return; }
    if (!currencyId) { errorResponse(res, 'العملة مطلوبة', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    await transaction(async (client) => {
      const seqRes = await client.query(`SELECT nextval('seq_purchase_order') AS seq`);
      const orderNumber = `PO-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      let totalAmount = 0, discountAmount = 0, taxAmount = 0;
      const processedLines = [];
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        const discPct = Number(line.discountPercentage || 0);
        const taxRate = Number(line.taxRate || 0);
        const gross = qty * unitCost;
        const discAmt = gross * (discPct / 100);
        const subtotal = gross - discAmt;
        const lineTax = subtotal * (taxRate / 100);
        const lineTotal = subtotal + lineTax;
        totalAmount += subtotal;
        discountAmount += discAmt;
        taxAmount += lineTax;
        processedLines.push({ ...line, qty, unitCost, discAmt, lineTax, lineTotal });
      }
      const netAmount = totalAmount + taxAmount;

      const poRes = await client.query(
        `INSERT INTO purchase_orders
           (order_number, order_date, expected_date, supplier_id, branch_id, warehouse_id,
            currency_id, exchange_rate, total_amount, discount_amount, tax_amount, net_amount,
            payment_term_id, purchase_request_id, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Draft',$16) RETURNING *`,
        [orderNumber, orderDate, expectedDate || null, supplierId,
          req.user!.branchId, warehouseId, currencyId, Number(exchangeRate) || 1,
          totalAmount, discountAmount, taxAmount, netAmount,
          paymentTermId || null, purchaseRequestId || null, notes || '',
          req.user!.userId]
      );
      const poId = poRes.rows[0].id;

      for (let i = 0; i < processedLines.length; i++) {
        const l = processedLines[i];
        await client.query(
          `INSERT INTO purchase_order_lines
             (purchase_order_id, item_id, uom_id, quantity, received_quantity, unit_cost,
              discount_percentage, tax_id, tax_amount, total_amount, notes, sort_order)
           VALUES ($1,$2,$3,$4,0,$5,$6,$7,$8,$9,$10,$11)`,
          [poId, l.itemId, l.uomId, l.qty, l.unitCost, l.discountPercentage || 0,
            l.taxId || null, l.lineTax, l.lineTotal, l.notes || '', i]
        );
      }

      // If converted from PR, mark PR as converted
      if (purchaseRequestId) {
        await client.query(
          `UPDATE purchase_requests SET status='Converted', converted_to_po_id=$1 WHERE id=$2`,
          [poId, purchaseRequestId]
        );
      }

      successResponse(res, poRes.rows[0], 'تم إنشاء أمر الشراء بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء أمر الشراء', 500);
  }
};

export const approvePurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT status FROM purchase_orders WHERE id=$1`, [id]);
    if (existing.rows.length === 0) { errorResponse(res, 'أمر الشراء غير موجود', 404); return; }
    if (existing.rows[0].status !== 'Draft') {
      errorResponse(res, 'يمكن اعتماد أوامر الشراء في حالة المسودة فقط', 400);
      return;
    }
    await query(
      `UPDATE purchase_orders SET status='Approved', approved_by=$1 WHERE id=$2`,
      [req.user!.userId, id]
    );

    // Audit
    await query(
      `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, description)
       VALUES ($1, 'APPROVE', 'purchase_orders', $2, 'اعتماد أمر الشراء')`,
      [req.user!.userId, id]
    );

    successResponse(res, null, 'تم اعتماد أمر الشراء بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في اعتماد أمر الشراء', 500);
  }
};

export const cancelPurchaseOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query(`SELECT status FROM purchase_orders WHERE id=$1`, [id]);
    if (existing.rows.length === 0) { errorResponse(res, 'أمر الشراء غير موجود', 404); return; }
    if (!['Draft', 'Approved'].includes(existing.rows[0].status)) {
      errorResponse(res, 'لا يمكن إلغاء أمر شراء بدأ استلامه', 400);
      return;
    }
    await query(`UPDATE purchase_orders SET status='Cancelled' WHERE id=$1`, [id]);
    successResponse(res, null, 'تم إلغاء أمر الشراء');
  } catch (error) {
    errorResponse(res, 'خطأ في إلغاء أمر الشراء', 500);
  }
};

// ============================================================
// PURCHASE RECEIPTS
// ============================================================

export const getPurchaseReceipts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, poId, status } = req.query;
    let sql = `SELECT pr.*,
                      s.name_ar AS supplier_name,
                      po.order_number,
                      w.name_ar AS warehouse_name,
                      c.code AS currency_code
               FROM purchase_receipts pr
               JOIN suppliers s ON s.id = pr.supplier_id
               JOIN purchase_orders po ON po.id = pr.purchase_order_id
               LEFT JOIN warehouses w ON w.id = pr.warehouse_id
               JOIN currencies c ON c.id = pr.currency_id
               WHERE pr.branch_id IN (SELECT id FROM branches WHERE company_id = $1)`;
    const params: unknown[] = [req.user!.companyId];

    if (supplierId) { params.push(supplierId); sql += ` AND pr.supplier_id = $${params.length}`; }
    if (poId) { params.push(poId); sql += ` AND pr.purchase_order_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND pr.status = $${params.length}`; }
    sql += ' ORDER BY pr.created_at DESC LIMIT 200';

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب استلامات المشتريات', 500);
  }
};

export const createPurchaseReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { purchaseOrderId, receiptDate, warehouseId, currencyId, exchangeRate, notes, lines } = req.body;

    if (!purchaseOrderId) { errorResponse(res, 'أمر الشراء مطلوب', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    await transaction(async (client) => {
      // Validate PO
      const poRes = await client.query(
        `SELECT * FROM purchase_orders WHERE id=$1 AND status IN ('Approved','PartiallyReceived') FOR UPDATE`,
        [purchaseOrderId]
      );
      if (poRes.rows.length === 0) {
        throw new Error('أمر الشراء غير موجود أو غير معتمد');
      }
      const po = poRes.rows[0];

      const seqRes = await client.query(`SELECT nextval('seq_purchase_receipt') AS seq`);
      const receiptNumber = `GRN-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      const receiptRes = await client.query(
        `INSERT INTO purchase_receipts
           (receipt_number, receipt_date, purchase_order_id, supplier_id, branch_id,
            warehouse_id, currency_id, exchange_rate, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Draft',$10) RETURNING *`,
        [receiptNumber, receiptDate, purchaseOrderId, po.supplier_id,
          po.branch_id, warehouseId || po.warehouse_id,
          currencyId || po.currency_id, Number(exchangeRate) || Number(po.exchange_rate) || 1,
          notes || '', req.user!.userId]
      );
      const receiptId = receiptRes.rows[0].id;

      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const unitCost = Number(l.unitCost) || 0;
        const qty = Number(l.receivedQuantity);
        await client.query(
          `INSERT INTO purchase_receipt_lines
             (purchase_receipt_id, po_line_id, item_id, uom_id, ordered_quantity,
              received_quantity, unit_cost, total_cost, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [receiptId, l.poLineId || null, l.itemId, l.uomId,
            l.orderedQuantity || 0, qty, unitCost, qty * unitCost, l.notes || '', i]
        );
      }

      successResponse(res, receiptRes.rows[0], 'تم إنشاء وصل الاستلام بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء وصل الاستلام', 500);
  }
};

export const postPurchaseReceipt = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await transaction(async (client) => {
      const receiptRes = await client.query(
        `SELECT pr.*, c.code AS currency_code FROM purchase_receipts pr
         JOIN currencies c ON c.id = pr.currency_id
         WHERE pr.id = $1 AND pr.status = 'Draft' FOR UPDATE`,
        [id]
      );
      if (receiptRes.rows.length === 0) throw new Error('وصل الاستلام غير موجود أو مرحّل مسبقاً');
      const receipt = receiptRes.rows[0];

      const linesRes = await client.query(
        `SELECT prl.*, i.inventory_account_id, i.name_ar AS item_name
         FROM purchase_receipt_lines prl
         JOIN items i ON i.id = prl.item_id
         WHERE prl.purchase_receipt_id = $1`,
        [id]
      );
      const lines = linesRes.rows;
      if (lines.length === 0) throw new Error('لا توجد أصناف في وصل الاستلام');

      const exchangeRate = Number(receipt.exchange_rate) || 1;

      // Create inventory transaction
      const txnNumber = `GRN-TXN-${Date.now()}`;
      const txnRes = await client.query(
        `INSERT INTO inventory_transactions
           (transaction_number, transaction_date, transaction_type, warehouse_id,
            reference_type, reference_id, description, status, created_by)
         VALUES ($1,$2,'Receipt',$3,'PurchaseReceipt',$4,$5,'Posted',$6) RETURNING id`,
        [txnNumber, receipt.receipt_date, receipt.warehouse_id, id,
          `استلام بضاعة: ${receipt.receipt_number}`, req.user!.userId]
      );
      const txnId = txnRes.rows[0].id;

      for (const line of lines) {
        const qty = Number(line.received_quantity);
        const unitCostBase = Number(line.unit_cost) * exchangeRate;

        // Update inventory balance
        const balRes = await client.query(
          `SELECT quantity_on_hand, average_cost, total_value
           FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [line.item_id, receipt.warehouse_id]
        );

        if (balRes.rows.length === 0) {
          await client.query(
            `INSERT INTO inventory_balances (item_id, warehouse_id, quantity_on_hand, average_cost, total_value, last_updated)
             VALUES ($1,$2,$3,$4,$5,NOW())`,
            [line.item_id, receipt.warehouse_id, qty, unitCostBase, qty * unitCostBase]
          );
        } else {
          const curQty = Number(balRes.rows[0].quantity_on_hand);
          const curVal = Number(balRes.rows[0].total_value);
          const newQty = curQty + qty;
          const newVal = curVal + (qty * unitCostBase);
          const newAvg = newQty > 0 ? newVal / newQty : unitCostBase;
          await client.query(
            `UPDATE inventory_balances SET quantity_on_hand=$1, average_cost=$2, total_value=$3, last_updated=NOW()
             WHERE item_id=$4 AND warehouse_id=$5`,
            [newQty, newAvg, newVal, line.item_id, receipt.warehouse_id]
          );
        }

        // Inventory transaction line
        await client.query(
          `INSERT INTO inventory_transaction_lines
             (inventory_transaction_id, item_id, uom_id, quantity, unit_cost, total_cost)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [txnId, line.item_id, line.uom_id, qty, unitCostBase, qty * unitCostBase]
        );

        // Update PO line received_quantity
        if (line.po_line_id) {
          await client.query(
            `UPDATE purchase_order_lines SET received_quantity = received_quantity + $1 WHERE id = $2`,
            [qty, line.po_line_id]
          );
        }
      }

      // Update receipt status
      await client.query(
        `UPDATE purchase_receipts SET status='Posted', inventory_transaction_id=$1 WHERE id=$2`,
        [txnId, id]
      );

      // Check if PO is fully received
      const poCheckRes = await client.query(
        `SELECT pol.quantity, pol.received_quantity FROM purchase_order_lines pol
         WHERE pol.purchase_order_id = $1`,
        [receipt.purchase_order_id]
      );
      const allReceived = poCheckRes.rows.every(
        (r: any) => Number(r.received_quantity) >= Number(r.quantity)
      );
      const anyReceived = poCheckRes.rows.some((r: any) => Number(r.received_quantity) > 0);
      const newPOStatus = allReceived ? 'FullyReceived' : (anyReceived ? 'PartiallyReceived' : 'Approved');
      await client.query(`UPDATE purchase_orders SET status=$1 WHERE id=$2`, [newPOStatus, receipt.purchase_order_id]);

      // Audit
      await client.query(
        `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, description)
         VALUES ($1, 'APPROVE', 'purchase_receipts', $2, 'ترحيل وصل الاستلام وتحديث المخزون')`,
        [req.user!.userId, id]
      );

      successResponse(res, { receiptId: id, txnId, status: 'Posted' }, 'تم ترحيل وصل الاستلام وتحديث المخزون بنجاح');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في ترحيل وصل الاستلام', 500);
  }
};

// ============================================================
// PURCHASE RETURNS
// ============================================================

export const getPurchaseReturns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supplierId, status } = req.query;
    let sql = `SELECT pr.*,
                      s.name_ar AS supplier_name,
                      pi.invoice_number AS original_invoice_number,
                      c.code AS currency_code
               FROM purchase_returns pr
               JOIN suppliers s ON s.id = pr.supplier_id
               JOIN purchase_invoices pi ON pi.id = pr.original_invoice_id
               JOIN currencies c ON c.id = pr.currency_id
               WHERE pr.branch_id IN (SELECT id FROM branches WHERE company_id = $1)`;
    const params: unknown[] = [req.user!.companyId];

    if (supplierId) { params.push(supplierId); sql += ` AND pr.supplier_id = $${params.length}`; }
    if (status) { params.push(status); sql += ` AND pr.status = $${params.length}`; }
    sql += ' ORDER BY pr.created_at DESC LIMIT 200';

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب مردودات المشتريات', 500);
  }
};

export const createPurchaseReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { originalInvoiceId, warehouseId, returnDate, currencyId, exchangeRate, reason, notes, lines } = req.body;
    if (!originalInvoiceId) { errorResponse(res, 'الفاتورة الأصلية مطلوبة', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    await transaction(async (client) => {
      const invRes = await client.query(
        `SELECT * FROM purchase_invoices WHERE id=$1 AND status='Posted'`, [originalInvoiceId]
      );
      if (invRes.rows.length === 0) throw new Error('الفاتورة غير موجودة أو غير مرحّلة');
      const invoice = invRes.rows[0];

      const seqRes = await client.query(`SELECT nextval('seq_purchase_return') AS seq`);
      const returnNumber = `PR-RET-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      let totalAmount = 0, taxAmount = 0;
      const processedLines = [];
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        const discPct = Number(line.discountPercentage || 0);
        const taxRate = Number(line.taxRate || 0);
        const gross = qty * unitCost;
        const subtotal = gross * (1 - discPct / 100);
        const lineTax = subtotal * (taxRate / 100);
        totalAmount += subtotal;
        taxAmount += lineTax;
        processedLines.push({ ...line, qty, unitCost, subtotal, lineTax, lineTotal: subtotal + lineTax });
      }
      const netAmount = totalAmount + taxAmount;

      const retRes = await client.query(
        `INSERT INTO purchase_returns
           (return_number, return_date, original_invoice_id, supplier_id, branch_id,
            warehouse_id, currency_id, exchange_rate, total_amount, tax_amount, net_amount,
            reason, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'Draft',$14) RETURNING *`,
        [returnNumber, returnDate, originalInvoiceId, invoice.supplier_id,
          invoice.branch_id, warehouseId || invoice.warehouse_id,
          currencyId || invoice.currency_id, Number(exchangeRate) || Number(invoice.exchange_rate) || 1,
          totalAmount, taxAmount, netAmount, reason || '', notes || '', req.user!.userId]
      );
      const retId = retRes.rows[0].id;

      for (let i = 0; i < processedLines.length; i++) {
        const l = processedLines[i];
        await client.query(
          `INSERT INTO purchase_return_lines
             (purchase_return_id, original_invoice_line_id, item_id, uom_id,
              quantity, unit_cost, discount_percentage, tax_id, tax_amount, total_amount, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [retId, l.originalLineId || null, l.itemId, l.uomId,
            l.qty, l.unitCost, l.discountPercentage || 0, l.taxId || null, l.lineTax, l.lineTotal,
            l.notes || '', i]
        );
      }

      successResponse(res, retRes.rows[0], 'تم إنشاء مرتجع الشراء بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء مرتجع الشراء', 500);
  }
};

export const postPurchaseReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await transaction(async (client) => {
      const retRes = await client.query(
        `SELECT pr.* FROM purchase_returns pr WHERE pr.id=$1 AND pr.status='Draft' FOR UPDATE`, [id]
      );
      if (retRes.rows.length === 0) throw new Error('مرتجع الشراء غير موجود أو مرحّل مسبقاً');
      const ret = retRes.rows[0];

      const linesRes = await client.query(
        `SELECT prl.*, i.inventory_account_id, i.name_ar AS item_name
         FROM purchase_return_lines prl
         JOIN items i ON i.id = prl.item_id
         WHERE prl.purchase_return_id = $1`,
        [id]
      );
      const lines = linesRes.rows;
      const exchangeRate = Number(ret.exchange_rate) || 1;

      // Get supplier AP account
      const supplierRes = await client.query(
        `SELECT ap_account_id FROM suppliers WHERE id = $1`, [ret.supplier_id]
      );
      const apAccountId = supplierRes.rows[0]?.ap_account_id;

      const netAmountBase = Number(ret.net_amount) * exchangeRate;

      // Create Journal Entry
      const jeNumber = `JE-PRET-${Date.now()}`;
      const jeRes = await client.query(
        `INSERT INTO journal_entries
           (entry_number, entry_date, description, reference_no, reference_type, reference_id,
            branch_id, total_debit, total_credit, created_by, status)
         VALUES ($1,$2,$3,$4,'PurchaseReturn',$5,$6,$7,$7,$8,'Posted') RETURNING id`,
        [jeNumber, ret.return_date, `مرتجع مشتريات: ${ret.return_number}`,
          ret.return_number, id, ret.branch_id, netAmountBase, req.user!.userId]
      );
      const jeId = jeRes.rows[0].id;

      // Debit: AP (Supplier) — reduce liability
      if (apAccountId) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description, supplier_id)
           VALUES ($1,$2,$3,0,$4,$5)`,
          [jeId, apAccountId, netAmountBase, `مرتجع: ${ret.return_number}`, ret.supplier_id]
        );
      }

      // Credit: Inventory accounts (reduce inventory)
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitCostBase = Number(line.unit_cost) * exchangeRate;
        const lineTotal = qty * unitCostBase;

        if (line.inventory_account_id && lineTotal > 0) {
          await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description)
             VALUES ($1,$2,0,$3,$4)`,
            [jeId, line.inventory_account_id, lineTotal, `إرجاع بضاعة: ${line.item_name}`]
          );
        }

        // Reduce inventory
        await client.query(
          `UPDATE inventory_balances
           SET quantity_on_hand = quantity_on_hand - $1,
               total_value = GREATEST(0, total_value - $2),
               last_updated = NOW()
           WHERE item_id = $3 AND warehouse_id = $4`,
          [qty, lineTotal, line.item_id, ret.warehouse_id]
        );
      }

      // Update return status
      await client.query(
        `UPDATE purchase_returns SET status='Posted', journal_entry_id=$1, approved_by=$2 WHERE id=$3`,
        [jeId, req.user!.userId, id]
      );

      // Update supplier balance
      await client.query(
        `UPDATE suppliers SET balance = balance - $1 WHERE id = $2`, [netAmountBase, ret.supplier_id]
      );

      // Audit
      await client.query(
        `INSERT INTO audit_logs (user_id, action_type, table_name, record_id, description)
         VALUES ($1, 'APPROVE', 'purchase_returns', $2, 'ترحيل مرتجع مشتريات')`,
        [req.user!.userId, id]
      );

      successResponse(res, { returnId: id, jeId, status: 'Posted' }, 'تم ترحيل مرتجع الشراء بنجاح');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في ترحيل مرتجع الشراء', 500);
  }
};

// ============================================================
// PURCHASING DASHBOARD (Real Data)
// ============================================================

export const getPurchasingDashboard = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const branchSubquery = `(SELECT id FROM branches WHERE company_id = '${companyId}')`;

    const [suppliersRes, invoicesRes, ordersRes, overdueRes, recentInvoicesRes, recentOrdersRes, topSuppliersRes] = await Promise.all([
      // Supplier counts
      query(
        `SELECT COUNT(*) AS total, SUM(CASE WHEN status='Active' THEN 1 ELSE 0 END) AS active
         FROM suppliers WHERE company_id=$1`, [companyId]
      ),
      // Invoice stats
      query(
        `SELECT 
           COALESCE(SUM(net_amount * exchange_rate), 0) AS total_purchases,
           COALESCE(SUM(remaining_amount * exchange_rate), 0) AS total_outstanding,
           COALESCE(SUM(paid_amount * exchange_rate), 0) AS total_paid,
           COUNT(CASE WHEN status IN ('Posted','PartiallyPaid') THEN 1 END) AS open_invoices,
           COUNT(CASE WHEN status IN ('Posted','PartiallyPaid') AND due_date < CURRENT_DATE THEN 1 END) AS overdue_invoices
         FROM purchase_invoices
         WHERE branch_id IN ${branchSubquery} AND status != 'Void'`
      ),
      // Open PO count
      query(`SELECT COUNT(*) AS open_orders FROM purchase_orders
             WHERE branch_id IN ${branchSubquery} AND status IN ('Approved','PartiallyReceived')`),
      // Overdue suppliers count
      query(
        `SELECT COUNT(DISTINCT supplier_id) AS overdue_suppliers
         FROM purchase_invoices
         WHERE branch_id IN ${branchSubquery}
           AND status IN ('Posted','PartiallyPaid')
           AND due_date < CURRENT_DATE
           AND remaining_amount > 0`
      ),
      // Recent invoices
      query(
        `SELECT pi.invoice_number, pi.invoice_date, pi.net_amount, pi.status,
                s.name_ar AS supplier_name, c.code AS currency_code
         FROM purchase_invoices pi
         JOIN suppliers s ON s.id = pi.supplier_id
         JOIN currencies c ON c.id = pi.currency_id
         WHERE pi.branch_id IN ${branchSubquery}
         ORDER BY pi.created_at DESC LIMIT 5`
      ),
      // Recent orders
      query(
        `SELECT po.order_number, po.order_date, po.net_amount, po.status,
                s.name_ar AS supplier_name, c.code AS currency_code
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         JOIN currencies c ON c.id = po.currency_id
         WHERE po.branch_id IN ${branchSubquery}
         ORDER BY po.created_at DESC LIMIT 5`
      ),
      // Top suppliers by purchases
      query(
        `SELECT s.name_ar AS supplier_name, s.code AS supplier_code,
                COALESCE(SUM(pi.net_amount * pi.exchange_rate), 0) AS total_purchases
         FROM suppliers s
         LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.status = 'Posted'
           AND pi.branch_id IN ${branchSubquery}
         WHERE s.company_id=$1
         GROUP BY s.id, s.name_ar, s.code
         ORDER BY total_purchases DESC LIMIT 5`, [companyId]
      ),
    ]);

    successResponse(res, {
      suppliers: {
        total: Number(suppliersRes.rows[0].total) || 0,
        active: Number(suppliersRes.rows[0].active) || 0,
      },
      invoices: {
        totalPurchases: Number(invoicesRes.rows[0].total_purchases) || 0,
        totalOutstanding: Number(invoicesRes.rows[0].total_outstanding) || 0,
        totalPaid: Number(invoicesRes.rows[0].total_paid) || 0,
        openInvoices: Number(invoicesRes.rows[0].open_invoices) || 0,
        overdueInvoices: Number(invoicesRes.rows[0].overdue_invoices) || 0,
      },
      openOrders: Number(ordersRes.rows[0].open_orders) || 0,
      overdueSuppliers: Number(overdueRes.rows[0].overdue_suppliers) || 0,
      recentInvoices: recentInvoicesRes.rows,
      recentOrders: recentOrdersRes.rows,
      topSuppliers: topSuppliersRes.rows,
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب بيانات لوحة المشتريات', 500);
  }
};

// ============================================================
// PURCHASING REPORTS
// ============================================================

export const getSupplierBalances = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT s.id, s.code, s.name_ar, s.balance,
              c.code AS currency_code, c.symbol,
              COALESCE((SELECT SUM(net_amount) FROM purchase_invoices WHERE supplier_id=s.id AND status='Posted'), 0) AS total_invoices,
              COALESCE((SELECT SUM(amount) FROM payment_vouchers WHERE supplier_id=s.id AND status='Posted'), 0) AS total_payments
       FROM suppliers s
       LEFT JOIN currencies c ON c.id = s.currency_id
       WHERE s.company_id=$1 AND s.status='Active'
       ORDER BY s.balance DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب أرصدة الموردين', 500);
  }
};

export const getSupplierAging = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT * FROM v_supplier_aging WHERE company_id=$1 ORDER BY total_balance DESC`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب تقرير الأعمار', 500);
  }
};

export const getPurchasesBySupplier = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fromDate, toDate } = req.query;
    let sql = `SELECT s.code AS supplier_code, s.name_ar AS supplier_name,
                      COUNT(pi.id) AS invoice_count,
                      COALESCE(SUM(pi.net_amount * pi.exchange_rate), 0) AS total_purchases,
                      COALESCE(SUM(pi.paid_amount * pi.exchange_rate), 0) AS total_paid,
                      COALESCE(SUM(pi.remaining_amount * pi.exchange_rate), 0) AS outstanding
               FROM suppliers s
               LEFT JOIN purchase_invoices pi ON pi.supplier_id = s.id AND pi.status = 'Posted'`;
    const params: unknown[] = [req.user!.companyId];
    if (fromDate) { params.push(fromDate); sql += ` AND pi.invoice_date >= $${params.length}`; }
    if (toDate) { params.push(toDate); sql += ` AND pi.invoice_date <= $${params.length}`; }
    sql += ` WHERE s.company_id = $1 GROUP BY s.id, s.code, s.name_ar ORDER BY total_purchases DESC`;

    const result = await query(sql, params);
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب تقرير المشتريات حسب المورد', 500);
  }
};
