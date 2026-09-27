import { Request, Response } from 'express';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// ========== CUSTOMERS ==========
export const getCustomers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT c.*, 
              cu.code AS currency_code, cu.name_ar AS currency_name,
              COALESCE(
                (
                  SELECT json_agg(
                    json_build_object(
                      'currency_id', cc.currency_id,
                      'currency_code', cur.code,
                      'currency_name', cur.name_ar,
                      'symbol', cur.symbol,
                      'balance', cc.balance,
                      'opening_balance', cc.opening_balance,
                      'credit_limit', cc.credit_limit,
                      'is_default', cc.is_default
                    )
                  )
                  FROM customer_currencies cc
                  JOIN currencies cur ON cc.currency_id = cur.id
                  WHERE cc.customer_id = c.id
                ),
                '[]'::json
              ) AS currencies
       FROM customers c
       LEFT JOIN currencies cu ON c.currency_id = cu.id
       WHERE c.company_id = $1 ORDER BY c.code`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب العملاء', 500);
  }
};

export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, nameAr, nameEn, tradeName, phone, email, city, address,
      taxNumber, crNumber, creditLimit, openingBalance, currencyId, currencyIds,
      arAccountId, paymentTerms, status
    } = req.body;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    const primaryCurrencyId = chosenCurrencyIds.length > 0 ? chosenCurrencyIds[0] : null;

    const result = await transaction(async (client) => {
      const custRes = await client.query(
        `INSERT INTO customers (company_id, code, name_ar, name_en, trade_name, phone, email, city, address, tax_number, cr_number, credit_limit, opening_balance, balance, currency_id, ar_account_id, payment_terms, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [
          req.user!.companyId, code, nameAr, nameEn || nameAr, tradeName || '',
          phone || '', email || '', city || '', address || '',
          taxNumber || '', crNumber || '', creditLimit || 0,
          openingBalance || 0, openingBalance || 0,
          primaryCurrencyId, arAccountId || null, paymentTerms || 30, status || 'Active'
        ]
      );

      const customer = custRes.rows[0];

      // Insert into customer_currencies
      for (let i = 0; i < chosenCurrencyIds.length; i++) {
        const cId = chosenCurrencyIds[i];
        const openBal = (i === 0 && openingBalance !== undefined) ? Number(openingBalance) || 0 : 0;
        await client.query(
          `INSERT INTO customer_currencies (customer_id, currency_id, opening_balance, balance, credit_limit, is_default)
           VALUES ($1, $2, $3, $3, $4, $5)
           ON CONFLICT (customer_id, currency_id) DO NOTHING`,
          [customer.id, cId, openBal, creditLimit || null, i === 0]
        );
      }

      return customer;
    });

    successResponse(res, result, 'تم إضافة العميل بنجاح', 201);
  } catch (error: any) {
    if (error.code === '23505') errorResponse(res, 'كود العميل مستخدم مسبقاً', 409);
    else errorResponse(res, 'خطأ في إضافة العميل', 500);
  }
};

export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code, nameAr, nameEn, tradeName, phone, email, city, address,
      taxNumber, crNumber, creditLimit, currencyId, currencyIds,
      arAccountId, paymentTerms, status
    } = req.body;

    const chosenCurrencyIds: string[] = currencyIds && Array.isArray(currencyIds) && currencyIds.length > 0
      ? currencyIds
      : (currencyId ? [currencyId] : []);

    const primaryCurrencyId = chosenCurrencyIds.length > 0 ? chosenCurrencyIds[0] : null;

    await transaction(async (client) => {
      const result = await client.query(
        `UPDATE customers SET
           code=$1, name_ar=$2, name_en=$3, trade_name=$4, phone=$5, email=$6,
           city=$7, address=$8, tax_number=$9, cr_number=$10, credit_limit=$11,
           currency_id=COALESCE($12, currency_id), ar_account_id=$13, payment_terms=$14, status=$15
         WHERE id=$16 AND company_id=$17 RETURNING *`,
        [
          code, nameAr, nameEn, tradeName || '', phone || '', email || '',
          city || '', address || '', taxNumber || '', crNumber || '', creditLimit || 0,
          primaryCurrencyId, arAccountId || null, paymentTerms || 30, status,
          id, req.user!.companyId
        ]
      );

      if (result.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // Sync customer_currencies
      if (chosenCurrencyIds.length > 0) {
        for (let i = 0; i < chosenCurrencyIds.length; i++) {
          const cId = chosenCurrencyIds[i];
          await client.query(
            `INSERT INTO customer_currencies (customer_id, currency_id, opening_balance, balance, credit_limit, is_default)
             VALUES ($1, $2, 0, 0, $3, $4)
             ON CONFLICT (customer_id, currency_id) DO UPDATE SET is_default = $4`,
            [id, cId, creditLimit || null, i === 0]
          );
        }
        // Remove unused currencies with 0 balance
        await client.query(
          `DELETE FROM customer_currencies WHERE customer_id = $1 AND currency_id != ALL($2) AND balance = 0`,
          [id, chosenCurrencyIds]
        );
      }
    });

    const updated = await query(`SELECT * FROM customers WHERE id=$1`, [id]);
    successResponse(res, updated.rows[0], 'تم تحديث العميل بنجاح');
  } catch (error: any) {
    if (error.message === 'NOT_FOUND') {
      errorResponse(res, 'العميل غير موجود', 404);
    } else {
      errorResponse(res, 'خطأ في تحديث العميل', 500);
    }
  }
};

// ========== SALES INVOICES ==========
export const getSalesInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT si.*, 
              c.name_ar AS customer_name, c.code AS customer_code, 
              w.name_ar AS warehouse_name,
              cur.code AS currency_code, cur.name_ar AS currency_name, cur.symbol AS currency_symbol, cur.is_default AS currency_is_default,
              co.base_currency_id, def_cur.code AS base_currency_code, def_cur.symbol AS base_currency_symbol
       FROM sales_invoices si
       JOIN customers c ON si.customer_id = c.id
       JOIN currencies cur ON si.currency_id = cur.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       LEFT JOIN branches b ON b.id = si.branch_id
       LEFT JOIN companies co ON co.id = b.company_id
       LEFT JOIN currencies def_cur ON def_cur.id = co.base_currency_id
       WHERE si.branch_id IN (SELECT id FROM branches WHERE company_id=$1)
       ORDER BY si.created_at DESC LIMIT 200`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب فواتير المبيعات', 500);
  }
};

export const getSalesInvoiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const headerResult = await query(
      `SELECT si.*, 
              c.name_ar AS customer_name, c.code AS customer_code, c.tax_number AS customer_tax_number,
              c.address AS customer_address, c.ar_account_id,
              w.name_ar AS warehouse_name,
              cur.code AS currency_code, cur.name_ar AS currency_name, cur.symbol AS currency_symbol, cur.decimal_places, cur.is_default AS currency_is_default,
              co.base_currency_id, def_cur.code AS base_currency_code, def_cur.name_ar AS base_currency_name, def_cur.symbol AS base_currency_symbol
       FROM sales_invoices si
       JOIN customers c ON si.customer_id = c.id
       JOIN currencies cur ON si.currency_id = cur.id
       LEFT JOIN warehouses w ON si.warehouse_id = w.id
       LEFT JOIN branches b ON b.id = si.branch_id
       LEFT JOIN companies co ON co.id = b.company_id
       LEFT JOIN currencies def_cur ON def_cur.id = co.base_currency_id
       WHERE si.id=$1`,
      [id]
    );
    if (headerResult.rows.length === 0) {
      errorResponse(res, 'الفاتورة غير موجودة', 404);
      return;
    }

    const linesResult = await query(
      `SELECT sil.*, i.name_ar AS item_name, i.code AS item_code, u.name_ar AS uom_name
       FROM sales_invoice_lines sil
       JOIN items i ON sil.item_id = i.id
       JOIN uoms u ON sil.uom_id = u.id
       WHERE sil.sales_invoice_id=$1 ORDER BY sil.sort_order`,
      [id]
    );
    successResponse(res, { ...headerResult.rows[0], lines: linesResult.rows });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الفاتورة', 500);
  }
};

export const createSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId, warehouseId, invoiceDate, dueDate, currencyId, exchangeRate, salesRepId, paymentMethodId, notes, lines } = req.body;

    if (!customerId) { errorResponse(res, 'العميل مطلوب', 400); return; }
    if (!warehouseId) { errorResponse(res, 'المستودع مطلوب', 400); return; }
    if (!invoiceDate) { errorResponse(res, 'تاريخ الفاتورة مطلوب', 400); return; }
    if (!currencyId) { errorResponse(res, 'العملة مطلوبة — يجب اختيار عملة من قائمة العملات', 400); return; }
    if (!lines || lines.length === 0) {
      errorResponse(res, 'يجب إضافة صنف واحد على الأقل للفاتورة', 400);
      return;
    }

    const rate = Number(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      errorResponse(res, 'سعر الصرف يجب أن يكون أكبر من صفر', 400);
      return;
    }

    // Validate currency exists & check if default
    const currencyCheck = await query(
      `SELECT id, code, is_default FROM currencies WHERE id = $1 AND status = 'Active'`,
      [currencyId]
    );
    if (currencyCheck.rows.length === 0) {
      errorResponse(res, 'العملة غير موجودة أو غير نشطة', 400);
      return;
    }

    const finalRate = currencyCheck.rows[0].is_default ? 1 : rate;

    await transaction(async (client) => {
      // 1. Calculate totals
      let totalAmount = 0;
      let discountAmount = 0;
      let taxAmount = 0;

      const processedLines = [];
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const discPct = Number(line.discountPercentage || 0);
        const taxRate = Number(line.taxRate || 0);

        if (qty <= 0 || unitPrice < 0) {
          throw new Error('الكمية يجب أن تكون أكبر من صفر وسعر الوحدة لا يمكن أن يكون سالباً');
        }

        const gross = qty * unitPrice;
        const discountAmt = gross * (discPct / 100);
        const subtotal = gross - discountAmt;
        const lineTax = subtotal * (taxRate / 100);
        const lineTotal = subtotal + lineTax;

        totalAmount += subtotal;
        discountAmount += discountAmt;
        taxAmount += lineTax;

        // Fetch current item cost from inventory_balances (WAC)
        const balRes = await client.query(
          `SELECT average_cost FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2`,
          [line.itemId, warehouseId]
        );
        const unitCost = balRes.rows.length > 0 ? Number(balRes.rows[0].average_cost) : 0;
        const cogsAmount = qty * unitCost;

        processedLines.push({ ...line, qty, unitPrice, discPct, lineTotal, lineTax, discountAmt, unitCost, cogsAmount });
      }

      const netAmount = totalAmount + taxAmount;

      // 2. Create Invoice Header
      const invoiceNumber = `INV-${Date.now()}`;
      const invoiceResult = await client.query(
        `INSERT INTO sales_invoices (invoice_number, invoice_date, due_date, customer_id, branch_id, warehouse_id, currency_id, exchange_rate, sales_rep_id, payment_method_id, total_amount, discount_amount, tax_amount, net_amount, remaining_amount, notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,'Draft',$16) RETURNING *`,
        [invoiceNumber, invoiceDate, dueDate || null, customerId, req.user!.branchId, warehouseId, currencyId, finalRate, salesRepId || null, paymentMethodId || null, totalAmount, discountAmount, taxAmount, netAmount, notes || '', req.user!.userId]
      );
      const invoiceId = invoiceResult.rows[0].id;

      // 3. Insert Lines
      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i];
        await client.query(
          `INSERT INTO sales_invoice_lines (sales_invoice_id, item_id, uom_id, quantity, unit_price, discount_percentage, tax_amount, total_amount, unit_cost, cogs_amount, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [invoiceId, line.itemId, line.uomId, line.qty, line.unitPrice, line.discPct, line.lineTax, line.lineTotal, line.unitCost, line.cogsAmount, line.notes || '', i]
        );
      }

      successResponse(res, invoiceResult.rows[0], 'تم إنشاء الفاتورة بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء الفاتورة', 500);
  }
};

export const updateSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { customerId, warehouseId, invoiceDate, dueDate, currencyId, exchangeRate, salesRepId, paymentMethodId, notes, lines } = req.body;

    const existing = await query(
      `SELECT status FROM sales_invoices WHERE id = $1 AND branch_id IN (SELECT id FROM branches WHERE company_id = $2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) { errorResponse(res, 'الفاتورة غير موجودة', 404); return; }
    if (existing.rows[0].status !== 'Draft') {
      errorResponse(res, 'لا يمكن تعديل الفاتورة إلا في حالة المسودة', 400);
      return;
    }

    if (!currencyId) { errorResponse(res, 'العملة مطلوبة', 400); return; }
    const rate = Number(exchangeRate);
    if (isNaN(rate) || rate <= 0) { errorResponse(res, 'سعر الصرف يجب أن يكون أكبر من صفر', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    const currencyCheck = await query(`SELECT id, is_default FROM currencies WHERE id=$1`, [currencyId]);
    const finalRate = currencyCheck.rows[0]?.is_default ? 1 : rate;

    await transaction(async (client) => {
      let totalAmount = 0;
      let discountAmount = 0;
      let taxAmount = 0;

      const processedLines = [];
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitPrice = Number(line.unitPrice);
        const discPct = Number(line.discountPercentage || 0);
        const taxRate = Number(line.taxRate || 0);
        const gross = qty * unitPrice;
        const discountAmt = gross * (discPct / 100);
        const subtotal = gross - discountAmt;
        const lineTax = subtotal * (taxRate / 100);
        const lineTotal = subtotal + lineTax;

        totalAmount += subtotal;
        discountAmount += discountAmt;
        taxAmount += lineTax;

        const balRes = await client.query(
          `SELECT average_cost FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2`,
          [line.itemId, warehouseId]
        );
        const unitCost = balRes.rows.length > 0 ? Number(balRes.rows[0].average_cost) : 0;
        const cogsAmount = qty * unitCost;

        processedLines.push({ ...line, qty, unitPrice, discPct, lineTotal, lineTax, discountAmt, unitCost, cogsAmount });
      }

      const netAmount = totalAmount + taxAmount;

      await client.query(
        `UPDATE sales_invoices SET
           customer_id=$1, warehouse_id=$2, invoice_date=$3, due_date=$4,
           currency_id=$5, exchange_rate=$6, sales_rep_id=$7, payment_method_id=$8,
           total_amount=$9, discount_amount=$10, tax_amount=$11, net_amount=$12, remaining_amount=$12,
           notes=$13
         WHERE id=$14`,
        [customerId, warehouseId, invoiceDate, dueDate || null, currencyId, finalRate, salesRepId || null, paymentMethodId || null, totalAmount, discountAmount, taxAmount, netAmount, notes || '', id]
      );

      await client.query(`DELETE FROM sales_invoice_lines WHERE sales_invoice_id = $1`, [id]);
      for (let i = 0; i < processedLines.length; i++) {
        const line = processedLines[i];
        await client.query(
          `INSERT INTO sales_invoice_lines (sales_invoice_id, item_id, uom_id, quantity, unit_price, discount_percentage, tax_amount, total_amount, unit_cost, cogs_amount, notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, line.itemId, line.uomId, line.qty, line.unitPrice, line.discPct, line.lineTax, line.lineTotal, line.unitCost, line.cogsAmount, line.notes || '', i]
        );
      }

      const updated = await client.query(`SELECT * FROM sales_invoices WHERE id = $1`, [id]);
      successResponse(res, updated.rows[0], 'تم تحديث الفاتورة بنجاح');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في تحديث الفاتورة', 500);
  }
};

export const deleteSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query(
      `SELECT status FROM sales_invoices WHERE id = $1 AND branch_id IN (SELECT id FROM branches WHERE company_id = $2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) { errorResponse(res, 'الفاتورة غير موجودة', 404); return; }
    if (existing.rows[0].status !== 'Draft') {
      errorResponse(res, 'لا يمكن حذف الفاتورة إلا في حالة المسودة', 400);
      return;
    }
    await transaction(async (client) => {
      await client.query(`DELETE FROM sales_invoice_lines WHERE sales_invoice_id = $1`, [id]);
      await client.query(`DELETE FROM sales_invoices WHERE id = $1`, [id]);
    });
    successResponse(res, null, 'تم حذف الفاتورة بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف الفاتورة', 500);
  }
};

export const postSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await transaction(async (client) => {
      // Fetch Invoice Header
      const invRes = await client.query(
        `SELECT si.*, 
                c.code AS currency_code, c.is_default AS currency_is_default,
                co.base_currency_id,
                def_c.code AS base_currency_code
         FROM sales_invoices si
         JOIN currencies c ON si.currency_id = c.id
         JOIN branches b ON b.id = si.branch_id
         JOIN companies co ON co.id = b.company_id
         LEFT JOIN currencies def_c ON def_c.id = co.base_currency_id
         WHERE si.id=$1 FOR UPDATE`,
        [id]
      );
      if (invRes.rows.length === 0) throw new Error('الفاتورة غير موجودة');
      const invoice = invRes.rows[0];
      if (!['Draft', 'Approved'].includes(invoice.status)) {
        throw new Error('يمكن ترحيل الفواتير في حالة "مسودة" أو "معتمدة" فقط');
      }

      const exchangeRate = Number(invoice.exchange_rate);

      // Fetch Lines
      const linesRes = await client.query(
        `SELECT sil.*, i.inventory_account_id, i.cogs_account_id, i.revenue_account_id, i.name_ar AS item_name
         FROM sales_invoice_lines sil
         JOIN items i ON sil.item_id = i.id
         WHERE sil.sales_invoice_id=$1 ORDER BY sil.sort_order`,
        [id]
      );
      const lines = linesRes.rows;

      // 1. Deduct stock from inventory_balances for each line
      for (const line of lines) {
        const balRes = await client.query(
          `SELECT quantity_on_hand, average_cost FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [line.item_id, invoice.warehouse_id]
        );
        if (balRes.rows.length === 0 || Number(balRes.rows[0].quantity_on_hand) < Number(line.quantity)) {
          const itemRes = await client.query(`SELECT name_ar FROM items WHERE id=$1`, [line.item_id]);
          throw new Error(`الكمية المتوفرة غير كافية للصنف: ${itemRes.rows[0]?.name_ar || line.item_id}`);
        }
        const currentQty = Number(balRes.rows[0].quantity_on_hand);
        const currentAvgCost = Number(balRes.rows[0].average_cost);
        const newQty = currentQty - Number(line.quantity);
        const newValue = newQty * currentAvgCost;

        // Update unit_cost and cogs on line (use current WAC)
        const cogsAmount = Number(line.quantity) * currentAvgCost;
        await client.query(
          `UPDATE sales_invoice_lines SET unit_cost=$1, cogs_amount=$2 WHERE id=$3`,
          [currentAvgCost, cogsAmount, line.id]
        );

        await client.query(
          `UPDATE inventory_balances SET quantity_on_hand=$1, total_value=$2, last_updated=NOW() WHERE item_id=$3 AND warehouse_id=$4`,
          [newQty, newValue, line.item_id, invoice.warehouse_id]
        );

        // Record inventory issue transaction
        const txnNumber = `TXN-SINV-${Date.now()}-${line.item_id.slice(0, 8)}`;
        const txnRes = await client.query(
          `INSERT INTO inventory_transactions
             (transaction_number, transaction_date, transaction_type, warehouse_id,
              reference_type, reference_id, description, status, created_by)
           VALUES ($1,$2,'Issue',$3,'SalesInvoice',$4,$5,'Posted',$6) RETURNING id`,
          [
            txnNumber, invoice.invoice_date, invoice.warehouse_id,
            id, `صرف بضاعة لمبيعات: ${line.item_name} — ${invoice.invoice_number}`,
            req.user!.userId
          ]
        );
        const txnId = txnRes.rows[0].id;

        await client.query(
          `INSERT INTO inventory_transaction_lines
             (inventory_transaction_id, item_id, uom_id, quantity, unit_cost, total_cost)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [txnId, line.item_id, line.uom_id, Number(line.quantity), currentAvgCost, cogsAmount]
        );
      }

      // 2. Build aggregated totals for Journal Entry in BASE CURRENCY
      let totalRevenueBase = 0;
      let totalCogs = 0; // COGS is already in base currency from inventory_balances
      const totalTaxBase = Number(invoice.tax_amount) * exchangeRate;
      const netAmountBase = Number(invoice.net_amount) * exchangeRate;

      const revenueByAccount: Record<string, number> = {};
      const cogsByAccount: Record<string, number> = {};

      for (const line of lines) {
        const lineRevenueOrig = Number(line.total_amount) - Number(line.tax_amount);
        const lineRevenueBase = lineRevenueOrig * exchangeRate;
        const lineCogs = Number(line.quantity) * Number(line.unit_cost);

        if (line.revenue_account_id) {
          revenueByAccount[line.revenue_account_id] = (revenueByAccount[line.revenue_account_id] || 0) + lineRevenueBase;
        }
        if (line.cogs_account_id) {
          cogsByAccount[line.cogs_account_id] = (cogsByAccount[line.cogs_account_id] || 0) + lineCogs;
        }

        totalRevenueBase += lineRevenueBase;
        totalCogs += lineCogs;
      }

      // 3. Fetch Customer's AR Account
      const custRes = await client.query(`SELECT ar_account_id FROM customers WHERE id=$1`, [invoice.customer_id]);
      const arAccountId = custRes.rows[0]?.ar_account_id;

      // 4. Create Main Journal Entry (Debit AR = Net Amount in Base Currency)
      const jeNumber = `JE-SALES-${Date.now()}`;
      const description = invoice.currency_is_default
        ? `فاتورة مبيعات: ${invoice.invoice_number}`
        : `فاتورة مبيعات: ${invoice.invoice_number} (${invoice.currency_code} × ${exchangeRate} = ${invoice.base_currency_code})`;

      const jeRes = await client.query(
        `INSERT INTO journal_entries (entry_number, entry_date, description, reference_no, reference_type, reference_id, branch_id, total_debit, total_credit, created_by, status)
         VALUES ($1,$2,$3,$4,'SalesInvoice',$5,$6,$7,$7,$8,'Posted') RETURNING id`,
        [jeNumber, invoice.invoice_date, description, invoice.invoice_number, id, invoice.branch_id, netAmountBase, req.user!.userId]
      );
      const jeId = jeRes.rows[0].id;

      // Debit: Accounts Receivable (full net amount incl. VAT in base currency)
      if (arAccountId) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,$3,0,$4)`,
          [jeId, arAccountId, netAmountBase, `مديونية عميل: فاتورة ${invoice.invoice_number}`]
        );
      }

      // Credit: Revenue accounts (in base currency)
      for (const [accId, amount] of Object.entries(revenueByAccount)) {
        if (accId && amount > 0) {
          await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,0,$3,$4)`,
            [jeId, accId, amount, `إيرادات مبيعات: ${invoice.invoice_number}`]
          );
        }
      }

      // Credit: VAT Payable (in base currency)
      if (totalTaxBase > 0) {
        const vatAccRes = await client.query(
          `SELECT id FROM gl_accounts WHERE company_id=$1 AND account_type='Liability' AND (name_ar LIKE '%ضريبة%' OR name_en ILIKE '%vat%' OR name_en ILIKE '%tax payable%') AND status='Active' LIMIT 1`,
          [req.user!.companyId]
        );
        if (vatAccRes.rows.length > 0) {
          await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,0,$3,$4)`,
            [jeId, vatAccRes.rows[0].id, totalTaxBase, `ضريبة القيمة المضافة: ${invoice.invoice_number}`]
          );
        }
      }

      // COGS Journal Entry (separate JE for cost deduction in base currency)
      if (totalCogs > 0) {
        const cogsJeNumber = `JE-COGS-${Date.now()}`;
        const cogsJeRes = await client.query(
          `INSERT INTO journal_entries (entry_number, entry_date, description, reference_no, reference_type, reference_id, branch_id, total_debit, total_credit, created_by, status)
           VALUES ($1,$2,$3,$4,'SalesInvoiceCOGS',$5,$6,$7,$7,$8,'Posted') RETURNING id`,
          [cogsJeNumber, invoice.invoice_date, `تكلفة البضاعة المباعة: ${invoice.invoice_number}`, invoice.invoice_number, id, invoice.branch_id, totalCogs, req.user!.userId]
        );
        const cogsJeId = cogsJeRes.rows[0].id;

        for (const line of lines) {
          const lineCogs = Number(line.quantity) * Number(line.unit_cost);
          if (lineCogs > 0) {
            // Debit COGS
            if (line.cogs_account_id) {
              await client.query(
                `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,$3,0,$4)`,
                [cogsJeId, line.cogs_account_id, lineCogs, `COGS: ${invoice.invoice_number}`]
              );
            }
            // Credit Inventory
            if (line.inventory_account_id) {
              await client.query(
                `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,0,$3,$4)`,
                [cogsJeId, line.inventory_account_id, lineCogs, `تخفيض المخزون: ${invoice.invoice_number}`]
              );
            }
          }
        }
      }

      // 5. Update invoice status and link JE
      await client.query(
        `UPDATE sales_invoices SET status='Posted', journal_entry_id=$1, approved_by=$2 WHERE id=$3`,
        [jeId, req.user!.userId, id]
      );

      // 6. Update customer balance (in base currency and independent original currency)
      await client.query(
        `UPDATE customers SET balance = balance + $1 WHERE id=$2`,
        [netAmountBase, invoice.customer_id]
      );
      await client.query(
        `INSERT INTO customer_currencies (customer_id, currency_id, balance, opening_balance)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (customer_id, currency_id)
         DO UPDATE SET balance = customer_currencies.balance + $3`,
        [invoice.customer_id, invoice.currency_id, Number(invoice.net_amount)]
      );

      successResponse(res, {
        invoiceId: id,
        jeId,
        status: 'Posted',
        netAmount: Number(invoice.net_amount),
        currencyCode: invoice.currency_code,
        exchangeRate,
        baseAmount: netAmountBase,
        baseCurrencyCode: invoice.base_currency_code
      }, 'تم ترحيل الفاتورة وإنشاء القيود المحاسبية وتحديث المخزون');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في ترحيل الفاتورة', 500);
  }
};

export const voidSalesInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const existing = await query(
      `SELECT status, customer_id, currency_id, net_amount, exchange_rate FROM sales_invoices WHERE id=$1 AND branch_id IN (SELECT id FROM branches WHERE company_id=$2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) {
      errorResponse(res, 'الفاتورة غير موجودة', 404);
      return;
    }
    if (existing.rows[0].status === 'Void') {
      errorResponse(res, 'الفاتورة ملغاة مسبقاً', 400);
      return;
    }

    const invoice = existing.rows[0];
    const netAmountBase = Number(invoice.net_amount) * Number(invoice.exchange_rate || 1);

    await transaction(async (client) => {
      if (invoice.status === 'Posted') {
        // Deduct from customer balance & customer_currencies
        await client.query(`UPDATE customers SET balance = balance - $1 WHERE id=$2`, [netAmountBase, invoice.customer_id]);
        await client.query(
          `UPDATE customer_currencies SET balance = balance - $1 WHERE customer_id=$2 AND currency_id=$3`,
          [Number(invoice.net_amount), invoice.customer_id, invoice.currency_id]
        );
      }

      await client.query(
        `UPDATE sales_invoices SET status='Void' WHERE id=$1`,
        [id]
      );
    });

    const result = await query(`SELECT * FROM sales_invoices WHERE id=$1`, [id]);
    successResponse(res, result.rows[0], reason ? `تم إلغاء الفاتورة: ${reason}` : 'تم إلغاء الفاتورة');
  } catch (error: any) {
    errorResponse(res, 'خطأ في إلغاء الفاتورة', 500, error.message);
  }
};

// ========== SALES REPORTS ==========
export const getSalesDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [totalSalesRes, invoiceCountRes, customersRes, topItemsRes, monthlyTrendRes] = await Promise.all([
      // Total sales this month
      query(
        `SELECT COALESCE(SUM(net_amount), 0) AS total FROM sales_invoices 
         WHERE branch_id IN (SELECT id FROM branches WHERE company_id=$1) 
         AND invoice_date BETWEEN $2 AND $3 AND status IN ('Posted','Paid','PartiallyPaid')`,
        [companyId, startOfMonth, endOfMonth]
      ),
      // Invoice count this month
      query(
        `SELECT COUNT(*) AS count FROM sales_invoices 
         WHERE branch_id IN (SELECT id FROM branches WHERE company_id=$1) 
         AND invoice_date BETWEEN $2 AND $3`,
        [companyId, startOfMonth, endOfMonth]
      ),
      // Customers count
      query(`SELECT COUNT(*) AS count FROM customers WHERE company_id=$1 AND status='Active'`, [companyId]),
      // Top selling items
      query(
        `SELECT i.name_ar, i.code, SUM(sil.quantity) AS total_qty, SUM(sil.total_amount) AS total_revenue
         FROM sales_invoice_lines sil
         JOIN items i ON sil.item_id = i.id
         JOIN sales_invoices si ON sil.sales_invoice_id = si.id
         WHERE si.branch_id IN (SELECT id FROM branches WHERE company_id=$1)
           AND si.invoice_date BETWEEN $2 AND $3 AND si.status IN ('Posted','Paid','PartiallyPaid')
         GROUP BY i.id, i.name_ar, i.code ORDER BY total_revenue DESC LIMIT 5`,
        [companyId, startOfMonth, endOfMonth]
      ),
      // Monthly trend (last 6 months)
      query(
        `SELECT TO_CHAR(invoice_date, 'YYYY-MM') AS month, COALESCE(SUM(net_amount), 0) AS total
         FROM sales_invoices
         WHERE branch_id IN (SELECT id FROM branches WHERE company_id=$1)
           AND status IN ('Posted','Paid','PartiallyPaid')
           AND invoice_date >= NOW() - INTERVAL '6 months'
         GROUP BY month ORDER BY month`,
        [companyId]
      ),
    ]);

    successResponse(res, {
      totalSalesThisMonth: Number(totalSalesRes.rows[0]?.total || 0),
      invoiceCountThisMonth: Number(invoiceCountRes.rows[0]?.count || 0),
      activeCustomers: Number(customersRes.rows[0]?.count || 0),
      topItems: topItemsRes.rows,
      monthlyTrend: monthlyTrendRes.rows,
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب إحصائيات المبيعات', 500);
  }
};

export const getCustomerStatement = async (req: Request, res: Response): Promise<void> => {
  try {
    const { customerId } = req.params;
    const { fromDate, toDate } = req.query;

    const customerRes = await query(`SELECT * FROM customers WHERE id=$1`, [customerId]);
    if (customerRes.rows.length === 0) {
      errorResponse(res, 'العميل غير موجود', 404);
      return;
    }

    const invoicesRes = await query(
      `SELECT si.invoice_number, si.invoice_date, si.due_date, si.net_amount, si.paid_amount, si.remaining_amount, si.status
       FROM sales_invoices si
       WHERE si.customer_id=$1 AND si.status NOT IN ('Draft','Void')
       ${fromDate ? `AND si.invoice_date >= '${fromDate}'` : ''}
       ${toDate ? `AND si.invoice_date <= '${toDate}'` : ''}
       ORDER BY si.invoice_date`,
      [customerId]
    );

    successResponse(res, {
      customer: customerRes.rows[0],
      invoices: invoicesRes.rows,
      totalDue: invoicesRes.rows.reduce((s: number, r: any) => s + Number(r.remaining_amount), 0),
    });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب كشف حساب العميل', 500);
  }
};

// ========== SALES RETURNS ==========
export const getSalesReturns = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT sr.*, c.name_ar AS customer_name, si.invoice_number AS original_invoice_number
       FROM sales_returns sr
       JOIN customers c ON sr.customer_id = c.id
       JOIN sales_invoices si ON sr.original_invoice_id = si.id
       WHERE sr.branch_id IN (SELECT id FROM branches WHERE company_id=$1)
       ORDER BY sr.created_at DESC LIMIT 100`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب مرتجعات المبيعات', 500);
  }
};

export const createSalesReturn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { originalInvoiceId, warehouseId, returnDate, reason, lines } = req.body;

    if (!lines || lines.length === 0) {
      errorResponse(res, 'يجب تحديد الأصناف المرتجعة', 400);
      return;
    }

    await transaction(async (client) => {
      // Fetch original invoice
      const origInvRes = await client.query(
        `SELECT si.*, c.ar_account_id FROM sales_invoices si JOIN customers c ON si.customer_id = c.id WHERE si.id=$1`,
        [originalInvoiceId]
      );
      if (origInvRes.rows.length === 0) throw new Error('الفاتورة الأصلية غير موجودة');
      const origInv = origInvRes.rows[0];
      if (!['Posted', 'Paid', 'PartiallyPaid'].includes(origInv.status)) {
        throw new Error('المرتجع يجب أن يكون لفاتورة مرحّلة أو مدفوعة');
      }

      // Calculate totals
      let totalAmount = 0;
      let taxAmount = 0;

      for (const line of lines) {
        const origLineRes = await client.query(
          `SELECT * FROM sales_invoice_lines WHERE id=$1 AND sales_invoice_id=$2`,
          [line.originalLineId, originalInvoiceId]
        );
        if (origLineRes.rows.length === 0) throw new Error('سطر الفاتورة الأصلية غير موجود');
        const origLine = origLineRes.rows[0];
        if (Number(line.quantity) > Number(origLine.quantity)) {
          throw new Error('الكمية المرتجعة لا يمكن أن تتجاوز الكمية الأصلية');
        }

        const lineTotal = Number(line.quantity) * Number(origLine.unit_price);
        const lineTax = lineTotal * (Number(origLine.tax_amount) / Number(origLine.total_amount) || 0);
        totalAmount += lineTotal;
        taxAmount += lineTax;
      }

      const netAmount = totalAmount + taxAmount;
      const returnNumber = `SR-${Date.now()}`;

      // Create return header
      const returnRes = await client.query(
        `INSERT INTO sales_returns (return_number, return_date, original_invoice_id, customer_id, branch_id, warehouse_id, currency_id, total_amount, tax_amount, net_amount, reason, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Posted',$12) RETURNING *`,
        [returnNumber, returnDate, originalInvoiceId, origInv.customer_id, origInv.branch_id, warehouseId || origInv.warehouse_id, origInv.currency_id, totalAmount, taxAmount, netAmount, reason || '', req.user!.userId]
      );
      const returnId = returnRes.rows[0].id;

      // Insert return lines + restore inventory
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const origLineRes = await client.query(`SELECT * FROM sales_invoice_lines WHERE id=$1`, [line.originalLineId]);
        const origLine = origLineRes.rows[0];
        const lineTotal = Number(line.quantity) * Number(origLine.unit_price);

        await client.query(
          `INSERT INTO sales_return_lines (sales_return_id, original_line_id, item_id, uom_id, quantity, unit_price, tax_amount, total_amount, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [returnId, line.originalLineId, origLine.item_id, origLine.uom_id, line.quantity, origLine.unit_price, 0, lineTotal, i]
        );

        // Restore inventory (add quantity back)
        const balRes = await client.query(
          `SELECT quantity_on_hand, average_cost FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [origLine.item_id, warehouseId || origInv.warehouse_id]
        );
        if (balRes.rows.length > 0) {
          const newQty = Number(balRes.rows[0].quantity_on_hand) + Number(line.quantity);
          await client.query(
            `UPDATE inventory_balances SET quantity_on_hand=$1, total_value=$2, last_updated=NOW() WHERE item_id=$3 AND warehouse_id=$4`,
            [newQty, newQty * Number(balRes.rows[0].average_cost), origLine.item_id, warehouseId || origInv.warehouse_id]
          );
        }
      }

      // Create Accounting JE: Debit Revenue/Sales Returns, Credit AR
      const jeNumber = `JE-SR-${Date.now()}`;
      const jeRes = await client.query(
        `INSERT INTO journal_entries (entry_number, entry_date, description, reference_no, reference_type, reference_id, branch_id, total_debit, total_credit, created_by, status)
         VALUES ($1,$2,$3,$4,'SalesReturn',$5,$6,$7,$7,$8,'Posted') RETURNING id`,
        [jeNumber, returnDate, `مرتجع مبيعات: ${returnNumber}`, returnNumber, returnId, origInv.branch_id, netAmount, req.user!.userId]
      );
      const jeId = jeRes.rows[0].id;

      // Debit: Revenue (Sales Returns account — use same revenue account if available)
      // Credit: AR
      if (origInv.ar_account_id) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description) VALUES ($1,$2,0,$3,$4)`,
          [jeId, origInv.ar_account_id, netAmount, `تخفيض ذمم عميل: ${returnNumber}`]
        );
      }

      // Update return with JE
      await client.query(`UPDATE sales_returns SET journal_entry_id=$1 WHERE id=$2`, [jeId, returnId]);

      // Update customer balance
      await client.query(`UPDATE customers SET balance = balance - $1 WHERE id=$2`, [netAmount, origInv.customer_id]);

      successResponse(res, returnRes.rows[0], 'تم إنشاء المرتجع وتحديث المخزون والمحاسبة', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء المرتجع', 500);
  }
};

