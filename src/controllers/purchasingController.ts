import { Request, Response } from 'express';
import { query, transaction } from '../config/db';
import { successResponse, errorResponse } from '../utils/response';

// ========== PURCHASE INVOICES ==========

export const getPurchaseInvoices = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await query(
      `SELECT pi.*, 
              s.name_ar AS supplier_name, s.code AS supplier_code,
              c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol,
              w.name_ar AS warehouse_name,
              def_c.code AS base_currency_code, def_c.symbol AS base_currency_symbol
       FROM purchase_invoices pi
       JOIN suppliers s ON pi.supplier_id = s.id
       JOIN currencies c ON pi.currency_id = c.id
       LEFT JOIN warehouses w ON pi.warehouse_id = w.id
       LEFT JOIN companies co ON co.id = $1
       LEFT JOIN currencies def_c ON def_c.id = co.base_currency_id
       WHERE pi.branch_id IN (SELECT id FROM branches WHERE company_id = $1)
       ORDER BY pi.created_at DESC LIMIT 200`,
      [req.user!.companyId]
    );
    successResponse(res, result.rows);
  } catch (error) {
    errorResponse(res, 'خطأ في جلب فواتير المشتريات', 500);
  }
};

export const getPurchaseInvoiceById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const headerResult = await query(
      `SELECT pi.*,
              s.name_ar AS supplier_name, s.code AS supplier_code, s.tax_number AS supplier_tax_number,
              s.address AS supplier_address, s.ap_account_id,
              c.code AS currency_code, c.name_ar AS currency_name, c.symbol AS currency_symbol, c.decimal_places,
              w.name_ar AS warehouse_name,
              co.base_currency_id,
              def_c.code AS base_currency_code, def_c.name_ar AS base_currency_name, def_c.symbol AS base_currency_symbol
       FROM purchase_invoices pi
       JOIN suppliers s ON pi.supplier_id = s.id
       JOIN currencies c ON pi.currency_id = c.id
       LEFT JOIN warehouses w ON pi.warehouse_id = w.id
       LEFT JOIN branches b ON b.id = pi.branch_id
       LEFT JOIN companies co ON co.id = b.company_id
       LEFT JOIN currencies def_c ON def_c.id = co.base_currency_id
       WHERE pi.id = $1`,
      [id]
    );

    if (headerResult.rows.length === 0) {
      errorResponse(res, 'الفاتورة غير موجودة', 404);
      return;
    }

    const linesResult = await query(
      `SELECT pil.*, 
              i.name_ar AS item_name, i.code AS item_code,
              u.name_ar AS uom_name,
              t.rate AS tax_rate, t.name_ar AS tax_name
       FROM purchase_invoice_lines pil
       JOIN items i ON pil.item_id = i.id
       JOIN uoms u ON pil.uom_id = u.id
       LEFT JOIN taxes t ON pil.tax_id = t.id
       WHERE pil.purchase_invoice_id = $1 ORDER BY pil.sort_order`,
      [id]
    );

    successResponse(res, { ...headerResult.rows[0], lines: linesResult.rows });
  } catch (error) {
    errorResponse(res, 'خطأ في جلب الفاتورة', 500);
  }
};

export const createPurchaseInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      supplierId, warehouseId, invoiceDate, dueDate,
      currencyId, exchangeRate,
      vendorInvoiceNumber, purchaseOrderId, notes,
      lines
    } = req.body;

    // ── Validation ──────────────────────────────────────────────
    if (!supplierId) { errorResponse(res, 'المورد مطلوب', 400); return; }
    if (!invoiceDate) { errorResponse(res, 'تاريخ الفاتورة مطلوب', 400); return; }
    if (!currencyId) { errorResponse(res, 'العملة مطلوبة — يجب اختيار عملة من قائمة العملات', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    const rate = Number(exchangeRate);
    if (isNaN(rate) || rate <= 0) {
      errorResponse(res, 'سعر الصرف يجب أن يكون أكبر من صفر', 400);
      return;
    }

    // Validate currency exists
    const currencyCheck = await query(
      `SELECT id, code, is_default FROM currencies WHERE id = $1 AND status = 'Active'`,
      [currencyId]
    );
    if (currencyCheck.rows.length === 0) {
      errorResponse(res, 'العملة غير موجودة أو غير نشطة', 400);
      return;
    }

    const isDefault = currencyCheck.rows[0].is_default;
    if (isDefault && rate !== 1) {
      // Allow but correct — default currency must have rate = 1
      // We'll accept it but could enforce: errorResponse(res, 'سعر صرف العملة الافتراضية يجب أن يكون 1', 400);
    }

    // Validate warehouseId
    if (!warehouseId) { errorResponse(res, 'المستودع مطلوب', 400); return; }

    await transaction(async (client) => {
      // ── Calculate Totals ─────────────────────────────────────
      let totalAmount = 0;   // before tax, after discount
      let discountAmount = 0;
      let taxAmount = 0;

      const processedLines = [];
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitCost = Number(line.unitCost);
        const discPct = Number(line.discountPercentage || 0);
        const taxRate = Number(line.taxRate || 0);

        if (qty <= 0 || unitCost < 0) {
          throw new Error('الكمية يجب أن تكون أكبر من صفر وسعر التكلفة لا يمكن أن يكون سالباً');
        }

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
      // base_amount = netAmount × exchangeRate (المبلغ بالعملة الافتراضية)

      // ── Generate Invoice Number ──────────────────────────────
      const seqRes = await client.query(`SELECT nextval('seq_purchase_invoice') AS seq`);
      const invoiceNumber = `PINV-${String(seqRes.rows[0].seq).padStart(5, '0')}`;

      // ── Get branch_id from user ──────────────────────────────
      const branchId = req.user!.branchId;

      // ── Insert Invoice Header ────────────────────────────────
      const invoiceResult = await client.query(
        `INSERT INTO purchase_invoices
           (invoice_number, vendor_invoice_number, invoice_date, due_date,
            supplier_id, purchase_order_id, branch_id, warehouse_id,
            currency_id, exchange_rate,
            total_amount, discount_amount, tax_amount, net_amount, remaining_amount,
            notes, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$14,$15,'Draft',$16)
         RETURNING *`,
        [
          invoiceNumber, vendorInvoiceNumber || null, invoiceDate, dueDate || null,
          supplierId, purchaseOrderId || null, branchId, warehouseId,
          currencyId, rate,
          totalAmount, discountAmount, taxAmount, netAmount,
          notes || '', req.user!.userId
        ]
      );
      const invoiceId = invoiceResult.rows[0].id;

      // ── Insert Lines ─────────────────────────────────────────
      for (let i = 0; i < processedLines.length; i++) {
        const l = processedLines[i];
        await client.query(
          `INSERT INTO purchase_invoice_lines
             (purchase_invoice_id, po_line_id, item_id, uom_id,
              quantity, unit_cost, discount_percentage, tax_id, tax_amount, total_amount,
              notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [
            invoiceId, l.poLineId || null, l.itemId, l.uomId,
            l.qty, l.unitCost, l.discountPercentage || 0,
            l.taxId || null, l.lineTax, l.lineTotal,
            l.notes || '', i
          ]
        );
      }

      successResponse(res, invoiceResult.rows[0], 'تم إنشاء فاتورة المشتريات بنجاح', 201);
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في إنشاء فاتورة المشتريات', 500);
  }
};

export const updatePurchaseInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      supplierId, warehouseId, invoiceDate, dueDate,
      currencyId, exchangeRate,
      vendorInvoiceNumber, purchaseOrderId, notes,
      lines
    } = req.body;

    // Must be Draft to edit
    const existing = await query(
      `SELECT status FROM purchase_invoices WHERE id = $1 AND branch_id IN (SELECT id FROM branches WHERE company_id = $2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) { errorResponse(res, 'الفاتورة غير موجودة', 404); return; }
    if (existing.rows[0].status !== 'Draft') {
      errorResponse(res, 'لا يمكن تعديل الفاتورة إلا في حالة المسودة', 400);
      return;
    }

    // Validate currency
    if (!currencyId) { errorResponse(res, 'العملة مطلوبة', 400); return; }
    const rate = Number(exchangeRate);
    if (isNaN(rate) || rate <= 0) { errorResponse(res, 'سعر الصرف يجب أن يكون أكبر من صفر', 400); return; }
    if (!lines || lines.length === 0) { errorResponse(res, 'يجب إضافة صنف واحد على الأقل', 400); return; }

    await transaction(async (client) => {
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

      await client.query(
        `UPDATE purchase_invoices SET
           vendor_invoice_number=$1, invoice_date=$2, due_date=$3,
           supplier_id=$4, purchase_order_id=$5, warehouse_id=$6,
           currency_id=$7, exchange_rate=$8,
           total_amount=$9, discount_amount=$10, tax_amount=$11, net_amount=$12, remaining_amount=$12,
           notes=$13
         WHERE id=$14`,
        [
          vendorInvoiceNumber || null, invoiceDate, dueDate || null,
          supplierId, purchaseOrderId || null, warehouseId,
          currencyId, rate,
          totalAmount, discountAmount, taxAmount, netAmount,
          notes || '', id
        ]
      );

      // Delete old lines and re-insert
      await client.query(`DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id = $1`, [id]);
      for (let i = 0; i < processedLines.length; i++) {
        const l = processedLines[i];
        await client.query(
          `INSERT INTO purchase_invoice_lines
             (purchase_invoice_id, po_line_id, item_id, uom_id,
              quantity, unit_cost, discount_percentage, tax_id, tax_amount, total_amount,
              notes, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
          [id, l.poLineId || null, l.itemId, l.uomId, l.qty, l.unitCost, l.discountPercentage || 0, l.taxId || null, l.lineTax, l.lineTotal, l.notes || '', i]
        );
      }

      const updated = await client.query(`SELECT * FROM purchase_invoices WHERE id = $1`, [id]);
      successResponse(res, updated.rows[0], 'تم تحديث الفاتورة بنجاح');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في تحديث الفاتورة', 500);
  }
};

export const deletePurchaseInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const existing = await query(
      `SELECT status FROM purchase_invoices WHERE id = $1 AND branch_id IN (SELECT id FROM branches WHERE company_id = $2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) { errorResponse(res, 'الفاتورة غير موجودة', 404); return; }
    if (existing.rows[0].status !== 'Draft') {
      errorResponse(res, 'لا يمكن حذف الفاتورة إلا في حالة المسودة', 400);
      return;
    }
    await transaction(async (client) => {
      await client.query(`DELETE FROM purchase_invoice_lines WHERE purchase_invoice_id = $1`, [id]);
      await client.query(`DELETE FROM purchase_invoices WHERE id = $1`, [id]);
    });
    successResponse(res, null, 'تم حذف الفاتورة بنجاح');
  } catch (error) {
    errorResponse(res, 'خطأ في حذف الفاتورة', 500);
  }
};

export const postPurchaseInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await transaction(async (client) => {
      // ── Fetch Invoice Header ─────────────────────────────────
      const invRes = await client.query(
        `SELECT pi.*, 
                c.code AS currency_code, c.is_default AS currency_is_default,
                co.base_currency_id,
                def_c.code AS base_currency_code
         FROM purchase_invoices pi
         JOIN currencies c ON pi.currency_id = c.id
         JOIN branches b ON b.id = pi.branch_id
         JOIN companies co ON co.id = b.company_id
         LEFT JOIN currencies def_c ON def_c.id = co.base_currency_id
         WHERE pi.id = $1 FOR UPDATE`,
        [id]
      );
      if (invRes.rows.length === 0) throw new Error('الفاتورة غير موجودة');
      const invoice = invRes.rows[0];
      if (!['Draft', 'Approved'].includes(invoice.status)) {
        throw new Error('يمكن ترحيل الفواتير في حالة مسودة أو معتمدة فقط');
      }

      const exchangeRate = Number(invoice.exchange_rate);

      // ── Fetch Lines with Item Accounts ───────────────────────
      const linesRes = await client.query(
        `SELECT pil.*, 
                i.inventory_account_id, i.name_ar AS item_name,
                i.cogs_account_id
         FROM purchase_invoice_lines pil
         JOIN items i ON pil.item_id = i.id
         WHERE pil.purchase_invoice_id = $1 ORDER BY pil.sort_order`,
        [id]
      );
      const lines = linesRes.rows;
      if (lines.length === 0) throw new Error('الفاتورة لا تحتوي على أصناف');

      // ── 1. Update Inventory Balances (WAC) ───────────────────
      for (const line of lines) {
        const qty = Number(line.quantity);
        // Cost in BASE currency for inventory valuation
        const unitCostBase = Number(line.unit_cost) * exchangeRate;

        const balRes = await client.query(
          `SELECT quantity_on_hand, average_cost, total_value
           FROM inventory_balances WHERE item_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [line.item_id, invoice.warehouse_id]
        );

        if (balRes.rows.length === 0) {
          // Create new balance record
          await client.query(
            `INSERT INTO inventory_balances (item_id, warehouse_id, quantity_on_hand, average_cost, total_value, last_updated)
             VALUES ($1,$2,$3,$4,$5,NOW())`,
            [line.item_id, invoice.warehouse_id, qty, unitCostBase, qty * unitCostBase]
          );
        } else {
          const currentQty = Number(balRes.rows[0].quantity_on_hand);
          const currentAvgCost = Number(balRes.rows[0].average_cost);
          const currentTotalValue = Number(balRes.rows[0].total_value);

          const newQty = currentQty + qty;
          const newTotalValue = currentTotalValue + (qty * unitCostBase);
          const newAvgCost = newQty > 0 ? newTotalValue / newQty : unitCostBase;

          await client.query(
            `UPDATE inventory_balances
             SET quantity_on_hand=$1, average_cost=$2, total_value=$3, last_updated=NOW()
             WHERE item_id=$4 AND warehouse_id=$5`,
            [newQty, newAvgCost, newTotalValue, line.item_id, invoice.warehouse_id]
          );
        }

        // Log inventory transaction (header)
        const txnNumber = `TXN-PINV-${Date.now()}-${line.item_id.slice(0, 8)}`;
        const txnRes = await client.query(
          `INSERT INTO inventory_transactions
             (transaction_number, transaction_date, transaction_type, warehouse_id,
              reference_type, reference_id, description, status, created_by)
           VALUES ($1,$2,'Receipt',$3,'PurchaseInvoice',$4,$5,'Posted',$6) RETURNING id`,
          [
            txnNumber, invoice.invoice_date, invoice.warehouse_id,
            id, `استلام بضاعة: ${line.item_name} — ${invoice.invoice_number}`,
            req.user!.userId
          ]
        );
        const txnId = txnRes.rows[0].id;

        // Log inventory transaction line
        await client.query(
          `INSERT INTO inventory_transaction_lines
             (inventory_transaction_id, item_id, uom_id, quantity, unit_cost, total_cost)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [txnId, line.item_id, line.uom_id, qty, unitCostBase, qty * unitCostBase]
        );

      }

      // ── 2. Get Supplier's AP Account ─────────────────────────
      const supplierRes = await client.query(
        `SELECT ap_account_id FROM suppliers WHERE id = $1`,
        [invoice.supplier_id]
      );
      const apAccountId = supplierRes.rows[0]?.ap_account_id;

      // ── 3. Calculate totals in BASE currency ─────────────────
      const netAmountBase = Number(invoice.net_amount) * exchangeRate;
      const taxAmountBase = Number(invoice.tax_amount) * exchangeRate;
      const totalAmountBase = Number(invoice.total_amount) * exchangeRate;

      // ── 4. Create Journal Entry ──────────────────────────────
      const jeNumber = `JE-PINV-${Date.now()}`;
      const description = invoice.currency_is_default
        ? `فاتورة مشتريات: ${invoice.invoice_number}`
        : `فاتورة مشتريات: ${invoice.invoice_number} (${invoice.currency_code} × ${exchangeRate} = ${invoice.base_currency_code})`;

      const jeRes = await client.query(
        `INSERT INTO journal_entries
           (entry_number, entry_date, description, reference_no, reference_type, reference_id,
            branch_id, total_debit, total_credit, created_by, status)
         VALUES ($1,$2,$3,$4,'PurchaseInvoice',$5,$6,$7,$7,$8,'Posted') RETURNING id`,
        [jeNumber, invoice.invoice_date, description, invoice.invoice_number,
         id, invoice.branch_id, netAmountBase, req.user!.userId]
      );
      const jeId = jeRes.rows[0].id;

      // ── 5. Journal Entry Lines ───────────────────────────────

      // a) Debit: Inventory accounts per line
      for (const line of lines) {
        const qty = Number(line.quantity);
        const unitCostBase = Number(line.unit_cost) * exchangeRate;
        const lineTotal = qty * unitCostBase;

        if (line.inventory_account_id && lineTotal > 0) {
          await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description)
             VALUES ($1,$2,$3,0,$4)`,
            [jeId, line.inventory_account_id, lineTotal,
             `بضاعة واردة: ${line.item_name} — ${invoice.invoice_number}`]
          );
        }
      }

      // b) Debit: VAT Input (if any)
      if (taxAmountBase > 0) {
        const vatAccRes = await client.query(
          `SELECT id FROM gl_accounts 
           WHERE company_id = $1 AND account_type = 'Asset'
             AND (name_ar LIKE '%ضريبة مدخلات%' OR name_ar LIKE '%ضريبة القيمة%' OR name_en ILIKE '%input vat%' OR name_en ILIKE '%vat receivable%')
             AND status = 'Active' LIMIT 1`,
          [req.user!.companyId]
        );
        if (vatAccRes.rows.length > 0) {
          await client.query(
            `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description)
             VALUES ($1,$2,$3,0,$4)`,
            [jeId, vatAccRes.rows[0].id, taxAmountBase, `ضريبة مدخلات: ${invoice.invoice_number}`]
          );
        }
      }

      // c) Credit: Accounts Payable (full net amount in base currency)
      if (apAccountId) {
        await client.query(
          `INSERT INTO journal_entry_lines (journal_entry_id, gl_account_id, debit, credit, line_description)
           VALUES ($1,$2,0,$3,$4)`,
          [jeId, apAccountId, netAmountBase, `ذمم مورد: ${invoice.invoice_number}`]
        );
      }

      // ── 6. Update Invoice Status ─────────────────────────────
      await client.query(
        `UPDATE purchase_invoices 
         SET status='Posted', journal_entry_id=$1, approved_by=$2 
         WHERE id=$3`,
        [jeId, req.user!.userId, id]
      );

      // ── 7. Update Supplier Balance (in base currency and independent original currency) ────────
      await client.query(
        `UPDATE suppliers SET balance = balance + $1 WHERE id = $2`,
        [netAmountBase, invoice.supplier_id]
      );
      await client.query(
        `INSERT INTO supplier_currencies (supplier_id, currency_id, balance, opening_balance)
         VALUES ($1, $2, $3, 0)
         ON CONFLICT (supplier_id, currency_id)
         DO UPDATE SET balance = supplier_currencies.balance + $3`,
        [invoice.supplier_id, invoice.currency_id, Number(invoice.net_amount)]
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
      }, 'تم ترحيل فاتورة المشتريات وإنشاء القيود المحاسبية وتحديث المخزون بنجاح');
    });
  } catch (error: any) {
    errorResponse(res, error.message || 'خطأ في ترحيل فاتورة المشتريات', 500);
  }
};

export const voidPurchaseInvoice = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await query(
      `SELECT status, supplier_id, currency_id, net_amount, exchange_rate, journal_entry_id
       FROM purchase_invoices WHERE id = $1 AND branch_id IN (SELECT id FROM branches WHERE company_id = $2)`,
      [id, req.user!.companyId]
    );
    if (existing.rows.length === 0) { errorResponse(res, 'الفاتورة غير موجودة', 404); return; }
    if (existing.rows[0].status === 'Void') { errorResponse(res, 'الفاتورة ملغاة مسبقاً', 400); return; }

    const invoice = existing.rows[0];
    const netAmountBase = Number(invoice.net_amount) * Number(invoice.exchange_rate || 1);

    await transaction(async (client) => {
      if (invoice.status === 'Posted') {
        // Reverse supplier balance & supplier_currencies
        await client.query(`UPDATE suppliers SET balance = balance - $1 WHERE id = $2`, [netAmountBase, invoice.supplier_id]);
        await client.query(
          `UPDATE supplier_currencies SET balance = balance - $1 WHERE supplier_id = $2 AND currency_id = $3`,
          [Number(invoice.net_amount), invoice.supplier_id, invoice.currency_id]
        );
      }

      await client.query(
        `UPDATE purchase_invoices SET status='Void' WHERE id = $1`,
        [id]
      );
    });

    successResponse(res, null, reason ? `تم إلغاء الفاتورة: ${reason}` : 'تم إلغاء الفاتورة بنجاح');
  } catch (error: any) {
    errorResponse(res, 'خطأ في إلغاء الفاتورة', 500, error.message);
  }
};
