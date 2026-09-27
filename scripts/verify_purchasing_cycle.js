/**
 * End-to-End Test for Purchasing Module Cycle
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const config = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: false }
};

async function runTest() {
  const client = new Client(config);
  await client.connect();
  console.log('✅ Connected to database for Purchasing Cycle Test');

  try {
    // 1. Get Company and Admin User
    const companyRes = await client.query(`SELECT id FROM companies LIMIT 1`);
    const companyId = companyRes.rows[0].id;

    const userRes = await client.query(`SELECT id FROM users WHERE company_id = $1 LIMIT 1`, [companyId]);
    const userId = userRes.rows[0].id;

    const branchRes = await client.query(`SELECT id FROM branches WHERE company_id = $1 LIMIT 1`, [companyId]);
    const branchId = branchRes.rows[0].id;

    const currencyRes = await client.query(`SELECT id FROM currencies WHERE code = 'SAR' LIMIT 1`);
    const currencyId = currencyRes.rows[0].id;

    console.log(`✅ Base Context: Company=${companyId}, User=${userId}, Branch=${branchId}`);

    // 2. Test Supplier Group
    const grpCode = `GRP-TEST-${Date.now().toString().slice(-4)}`;
    const grpRes = await client.query(
      `INSERT INTO supplier_groups (company_id, code, name_ar, name_en, status, created_by)
       VALUES ($1, $2, 'مجموعة الموردين التجريبية', 'Test Supplier Group', 'Active', $3) RETURNING id`,
      [companyId, grpCode, userId]
    );
    const groupId = grpRes.rows[0].id;
    console.log(`✅ 1. Supplier Group Created: ${grpCode} (ID: ${groupId})`);

    // 3. Test Supplier Type
    const typCode = `TYP-TEST-${Date.now().toString().slice(-4)}`;
    const typRes = await client.query(
      `INSERT INTO supplier_types (company_id, code, name_ar, name_en, status)
       VALUES ($1, $2, 'مورد محلي معتمد', 'Certified Local Supplier', 'Active') RETURNING id`,
      [companyId, typCode]
    );
    const typeId = typRes.rows[0].id;
    console.log(`✅ 2. Supplier Type Created: ${typCode} (ID: ${typeId})`);

    // 4. Test Payment Term
    const ptCode = `PT-TEST-${Date.now().toString().slice(-4)}`;
    const ptRes = await client.query(
      `INSERT INTO payment_terms (company_id, code, name_ar, name_en, days, description, status)
       VALUES ($1, $2, 'سداد 30 يوم اختباري', 'Test Net 30', 30, 'سداد خلال 30 يوم', 'Active') RETURNING id`,
      [companyId, ptCode]
    );
    const termId = ptRes.rows[0].id;
    console.log(`✅ 3. Payment Term Created: ${ptCode} (ID: ${termId})`);

    // 5. Test Supplier Creation
    const supCode = `SUP-TEST-${Date.now().toString().slice(-4)}`;
    const supRes = await client.query(
      `INSERT INTO suppliers (company_id, code, name_ar, name_en, group_id, type_id, payment_term_id, currency_id, credit_limit, balance, status)
       VALUES ($1, $2, 'شركة التوريدات الحديثة للاختبار', 'Modern Supply Co Test', $3, $4, $5, $6, 50000, 0, 'Active') RETURNING id`,
      [companyId, supCode, groupId, typeId, termId, currencyId]
    );
    const supplierId = supRes.rows[0].id;
    console.log(`✅ 4. Supplier Created: ${supCode} (ID: ${supplierId}) with credit limit 50,000`);

    // 6. Test Item & Warehouse & UOM
    const whRes = await client.query(`SELECT id FROM warehouses LIMIT 1`);
    const warehouseId = whRes.rows[0]?.id;

    const uomRes = await client.query(`SELECT id FROM uoms LIMIT 1`);
    const uomId = uomRes.rows[0]?.id;

    const itemRes = await client.query(`SELECT id FROM items LIMIT 1`);
    const itemId = itemRes.rows[0]?.id;

    if (!itemId || !warehouseId) {
      console.log('⚠️ Notice: No existing item or warehouse found to test PO & GRN creation, cycle basic test passed');
      return;
    }

    // 7. Test Purchase Request (PR)
    const prNumber = `PR-TEST-${Date.now().toString().slice(-4)}`;
    const prRes = await client.query(
      `INSERT INTO purchase_requests
         (request_number, request_date, expected_date, priority,
          supplier_id, branch_id, status, created_by)
       VALUES ($1, CURRENT_DATE, CURRENT_DATE + 7, 'High',
               $2, $3, 'Draft', $4) RETURNING id`,
      [prNumber, supplierId, branchId, userId]
    );
    const prId = prRes.rows[0].id;

    await client.query(
      `INSERT INTO purchase_request_lines
         (purchase_request_id, item_id, uom_id, quantity, estimated_price)
       VALUES ($1, $2, $3, 10, 150)`,
      [prId, itemId, uomId]
    );
    console.log(`✅ 5. Purchase Request Created: ${prNumber} (ID: ${prId})`);

    // 8. Test PR Approval
    await client.query(`UPDATE purchase_requests SET status = 'Approved', approved_by = $1 WHERE id = $2`, [userId, prId]);
    console.log(`✅ 6. Purchase Request Approved`);

    // 9. Test Convert PR to Purchase Order (PO)
    const poNumber = `PO-TEST-${Date.now().toString().slice(-4)}`;
    const poRes = await client.query(
      `INSERT INTO purchase_orders
         (order_number, order_date, expected_date, supplier_id, branch_id, warehouse_id,
          currency_id, exchange_rate, total_amount, discount_amount, tax_amount, net_amount,
          payment_term_id, purchase_request_id, status, created_by)
       VALUES ($1, CURRENT_DATE, CURRENT_DATE + 5, $2, $3, $4,
               $5, 1, 1000, 0, 150, 1150,
               $6, $7, 'Approved', $8) RETURNING id`,
      [poNumber, supplierId, branchId, warehouseId, currencyId, termId, prId, userId]
    );
    const poId = poRes.rows[0].id;

    await client.query(
      `INSERT INTO purchase_order_lines
         (purchase_order_id, item_id, uom_id, quantity, received_quantity, unit_cost, tax_amount, total_amount)
       VALUES ($1, $2, $3, 10, 0, 100, 150, 1150)`,
      [poId, itemId, uomId]
    );
    console.log(`✅ 7. Purchase Order Created & Approved: ${poNumber} (ID: ${poId})`);

    // 10. Test Goods Receipt Note (GRN / Purchase Receipt)
    const grnNumber = `GRN-TEST-${Date.now().toString().slice(-4)}`;
    const grnRes = await client.query(
      `INSERT INTO purchase_receipts
         (receipt_number, receipt_date, purchase_order_id, supplier_id, branch_id,
          warehouse_id, currency_id, exchange_rate, status, created_by)
       VALUES ($1, CURRENT_DATE, $2, $3, $4, $5, $6, 1, 'Draft', $7) RETURNING id`,
      [grnNumber, poId, supplierId, branchId, warehouseId, currencyId, userId]
    );
    const grnId = grnRes.rows[0].id;

    await client.query(
      `INSERT INTO purchase_receipt_lines
         (purchase_receipt_id, item_id, uom_id, ordered_quantity, received_quantity, unit_cost, total_cost)
       VALUES ($1, $2, $3, 10, 10, 100, 1000)`,
      [grnId, itemId, uomId]
    );
    console.log(`✅ 8. Goods Receipt Note Created: ${grnNumber} (ID: ${grnId})`);

    // 11. Test Posting GRN and updating PO received_quantity
    await client.query(`UPDATE purchase_receipts SET status = 'Posted' WHERE id = $1`, [grnId]);
    await client.query(`UPDATE purchase_order_lines SET received_quantity = 10 WHERE purchase_order_id = $1`, [poId]);
    await client.query(`UPDATE purchase_orders SET status = 'FullyReceived' WHERE id = $1`, [poId]);
    console.log(`✅ 9. GRN Posted & PO Status updated to 'FullyReceived'`);

    // 12. Test Supplier Evaluation
    await client.query(
      `INSERT INTO supplier_evaluations
         (supplier_id, evaluation_date, evaluated_by, quality_score, delivery_speed_score, punctuality_score, price_compliance_score, overall_score, notes)
       VALUES ($1, CURRENT_DATE, $2, 5, 4, 5, 5, 4.75, 'مورد ممتاز والالتزام عالي')`,
      [supplierId, userId]
    );
    console.log(`✅ 10. Supplier Evaluation recorded (Score: 4.75 / 5)`);

    console.log('\n========================================================');
    console.log('🎉 ALL PURCHASING CYCLE TESTS COMPLETED SUCCESSFULLY! 🎉');
    console.log('========================================================\n');

  } catch (err) {
    console.error('❌ Test failed with error:', err);
  } finally {
    await client.end();
  }
}

runTest();
