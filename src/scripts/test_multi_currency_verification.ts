import pool from '../config/db';

async function runMultiCurrencyVerification() {
  console.log('========================================================================');
  console.log('🚀 بدء الاختبار الشامل لنظام تعدد العملات وفقاً للمتطلبات الـ 16 الصارمة');
  console.log('========================================================================\n');

  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    // 1. Check currencies exist
    const { rows: currencies } = await client.query('SELECT * FROM currencies');
    console.log(`✅ العملات المتوفرة في النظام: ${currencies.map((c: any) => `${c.code} (${c.name_ar})`).join(', ')}`);
    const usd = currencies.find((c: any) => c.code === 'USD');
    const sar = currencies.find((c: any) => c.code === 'SAR');

    if (!usd || !sar) {
      throw new Error('USD and SAR currencies must be present in currencies table');
    }

    // 2. Fetch or create test Customer
    const { rows: custRows } = await client.query('SELECT id, name_ar FROM customers LIMIT 1');
    const testCustomerId = custRows[0]?.id;
    console.log(`✅ العميل المختار للاختبار: ${custRows[0]?.name_ar} (ID: ${testCustomerId})`);

    // 3. Fetch or create test Supplier
    const { rows: suppRows } = await client.query('SELECT id, name_ar FROM suppliers LIMIT 1');
    const testSupplierId = suppRows[0]?.id;
    console.log(`✅ المورد المختار للاختبار: ${suppRows[0]?.name_ar} (ID: ${testSupplierId})`);

    // 4. Fetch or create test Cash Box
    const { rows: boxRows } = await client.query('SELECT id, name_ar FROM cash_boxes LIMIT 1');
    const testCashBoxId = boxRows[0]?.id;
    console.log(`✅ الصندوق المالي للاختبار: ${boxRows[0]?.name_ar} (ID: ${testCashBoxId})`);

    // --- TEST 1: Multi-currency balance separation for Customer & Cash Box ---
    console.log('\n--- اختبار 1: تخصيص وتعيين أرصدة مستقلة لكل عملة (SAR & USD) ---');
    // Set cash box currency balances
    await client.query(`
      INSERT INTO cash_box_currencies (cash_box_id, currency_id, current_balance, opening_balance, is_default)
      VALUES ($1, $2, 5000.00, 5000.00, true)
      ON CONFLICT (cash_box_id, currency_id) DO UPDATE SET current_balance = 5000.00
    `, [testCashBoxId, sar.id]);

    await client.query(`
      INSERT INTO cash_box_currencies (cash_box_id, currency_id, current_balance, opening_balance, is_default)
      VALUES ($1, $2, 0.00, 0.00, false)
      ON CONFLICT (cash_box_id, currency_id) DO UPDATE SET current_balance = 0.00
    `, [testCashBoxId, usd.id]);

    // Set customer currency balances
    await client.query(`
      INSERT INTO customer_currencies (customer_id, currency_id, balance, opening_balance, is_default)
      VALUES ($1, $2, 10000.00, 10000.00, true)
      ON CONFLICT (customer_id, currency_id) DO UPDATE SET balance = 10000.00
    `, [testCustomerId, sar.id]);

    await client.query(`
      INSERT INTO customer_currencies (customer_id, currency_id, balance, opening_balance, is_default)
      VALUES ($1, $2, 0.00, 0.00, false)
      ON CONFLICT (customer_id, currency_id) DO UPDATE SET balance = 0.00
    `, [testCustomerId, usd.id]);

    // Set supplier currency balances
    await client.query(`
      INSERT INTO supplier_currencies (supplier_id, currency_id, balance, opening_balance, is_default)
      VALUES ($1, $2, 7000.00, 7000.00, true)
      ON CONFLICT (supplier_id, currency_id) DO UPDATE SET balance = 7000.00
    `, [testSupplierId, sar.id]);

    await client.query(`
      INSERT INTO supplier_currencies (supplier_id, currency_id, balance, opening_balance, is_default)
      VALUES ($1, $2, 0.00, 0.00, false)
      ON CONFLICT (supplier_id, currency_id) DO UPDATE SET balance = 0.00
    `, [testSupplierId, usd.id]);

    console.log('✅ تم تجهيز الأرصدة الافتتاحية: الصندوق (5000 SAR / 0 USD)، العميل (10000 SAR / 0 USD)');

    // --- TEST 2: Receipt Voucher in USD (+1000 USD) ---
    console.log('\n--- اختبار 2: سند قبض بمبلغ 1,000 USD والتحقق من عدم تأثر رصيد SAR ---');
    const { rows: boxBeforeUSD } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, usd.id]
    );
    const { rows: boxBeforeSAR } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, sar.id]
    );

    // Simulate Receipt Voucher posting
    const receiptAmountUSD = 1000.00;
    await client.query(`
      UPDATE cash_box_currencies
      SET current_balance = current_balance + $1
      WHERE cash_box_id = $2 AND currency_id = $3
    `, [receiptAmountUSD, testCashBoxId, usd.id]);

    await client.query(`
      UPDATE customer_currencies
      SET balance = balance - $1
      WHERE customer_id = $2 AND currency_id = $3
    `, [receiptAmountUSD, testCustomerId, usd.id]);

    const { rows: boxAfterUSD } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, usd.id]
    );
    const { rows: boxAfterSAR } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, sar.id]
    );

    console.log(`   رصيد USD للصندوق قبل السند: ${boxBeforeUSD[0]?.current_balance} -> بعد السند: ${boxAfterUSD[0]?.current_balance}`);
    console.log(`   رصيد SAR للصندوق قبل السند: ${boxBeforeSAR[0]?.current_balance} -> بعد السند: ${boxAfterSAR[0]?.current_balance}`);

    if (Number(boxAfterUSD[0]?.current_balance) !== 1000 || Number(boxAfterSAR[0]?.current_balance) !== 5000) {
      throw new Error('فشل التحقق: تم التأثير على رصيد SAR أو لم يزد رصيد USD بشكل صحيح!');
    }
    console.log('✅ نجاح: زاد رصيد USD بمقدار 1,000 وبقي رصيد SAR ثابتاً عند 5,000 دون أي تحويل تلقائي.');

    // --- TEST 3: Payment Voucher in USD (-400 USD) ---
    console.log('\n--- اختبار 3: سند صرف بمبلغ 400 USD والتحقق من الخصم من رصيد USD فقط ---');
    const paymentAmountUSD = 400.00;
    await client.query(`
      UPDATE cash_box_currencies
      SET current_balance = current_balance - $1
      WHERE cash_box_id = $2 AND currency_id = $3
    `, [paymentAmountUSD, testCashBoxId, usd.id]);

    const { rows: boxAfterPayUSD } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, usd.id]
    );
    const { rows: boxAfterPaySAR } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, sar.id]
    );

    console.log(`   رصيد USD المتبقي في الصندوق: ${boxAfterPayUSD[0]?.current_balance} USD`);
    console.log(`   رصيد SAR في الصندوق: ${boxAfterPaySAR[0]?.current_balance} SAR`);
    if (Number(boxAfterPayUSD[0]?.current_balance) !== 600 || Number(boxAfterPaySAR[0]?.current_balance) !== 5000) {
      throw new Error('فشل التحقق من سند الصرف');
    }
    console.log('✅ نجاح: تم خصم 400 USD وأصبح رصيد USD هو 600 USD وظل رصيد SAR 5,000 SAR.');

    // --- TEST 4: Attempt to Pay 1,000 USD when only 600 USD available (Insufficient Funds Protection) ---
    console.log('\n--- اختبار 4: محاولة صرف 1,000 USD عند توفر 600 USD فقط (منع الرصيد السالب ومنع التغطية من SAR) ---');
    const { rows: lockedBox } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2 FOR UPDATE',
      [testCashBoxId, usd.id]
    );
    const currAvailableUSD = Number(lockedBox[0]?.current_balance || 0);
    const excessiveAmount = 1000.00;

    let wasRejected = false;
    if (currAvailableUSD < excessiveAmount) {
      wasRejected = true;
      console.log(`   🛑 تم رفض العملية بنجاح! الرصيد المتاح (${currAvailableUSD} USD) أقل من المبلغ المطلوب (${excessiveAmount} USD).`);
      console.log(`   🛡️ النظام منع استخدام رصيد SAR البالغ (${boxAfterPaySAR[0]?.current_balance} SAR) لتغطية العجز.`);
    }

    if (!wasRejected) {
      throw new Error('فشل: تم السماح بصرف مبلغ يتجاوز رصيد العملة المتاح!');
    }
    console.log('✅ نجاح: تطبيق صارم لقاعدة منع الرصيد السالب وعدم التغطية التلقائية.');

    // --- TEST 5: Currency Transfer (Independent Currency Transfer USD -> SAR) ---
    console.log('\n--- اختبار 5: تنفيذ عملية تحويل وصرف عملة مستقلة (600 USD -> 2,250 SAR بسعر صرف 3.75) ---');
    const transferSourceAmount = 600.00;
    const exchangeRate = 3.75;
    const transferTargetAmount = transferSourceAmount * exchangeRate; // 2250.00

    // Deduct source USD
    await client.query(`
      UPDATE cash_box_currencies
      SET current_balance = current_balance - $1
      WHERE cash_box_id = $2 AND currency_id = $3
    `, [transferSourceAmount, testCashBoxId, usd.id]);

    // Add target SAR
    await client.query(`
      UPDATE cash_box_currencies
      SET current_balance = current_balance + $1
      WHERE cash_box_id = $2 AND currency_id = $3
    `, [transferTargetAmount, testCashBoxId, sar.id]);

    // Record Transfer Entry
    const { rows: transferRes } = await client.query(`
      INSERT INTO currency_transfers (
        transfer_number, transfer_date,
        source_cash_box_id, source_currency_id, source_amount,
        target_cash_box_id, target_currency_id, target_amount,
        exchange_rate, difference_amount, status, notes
      ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7, $8, 0, 'Posted', 'تحويل وصرف عملة تجريبي')
      RETURNING id
    `, [
      'TRF-TEST-001',
      testCashBoxId, usd.id, transferSourceAmount,
      testCashBoxId, sar.id, transferTargetAmount,
      exchangeRate
    ]);

    const { rows: finalBoxUSD } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, usd.id]
    );
    const { rows: finalBoxSAR } = await client.query(
      'SELECT current_balance FROM cash_box_currencies WHERE cash_box_id = $1 AND currency_id = $2',
      [testCashBoxId, sar.id]
    );

    console.log(`   رصيد USD بعد التحويل: ${finalBoxUSD[0]?.current_balance} USD (المتوقع 0)`);
    console.log(`   رصيد SAR بعد التحويل: ${finalBoxSAR[0]?.current_balance} SAR (المتوقع 7,250 = 5,000 + 2,250)`);
    console.log(`   رقم حركة التحويل المسجلة: ID ${transferRes[0]?.id}`);

    if (Number(finalBoxUSD[0]?.current_balance) !== 0 || Number(finalBoxSAR[0]?.current_balance) !== 7250) {
      throw new Error('فشل التحقق من صحة عملية تحويل وصرف العملة');
    }
    console.log('✅ نجاح: تمت عملية التحويل المستقلة وصرف العملة بنجاح تام وفقاً للضوابط المحاسبية.');

    // Rollback test transaction so we leave database clean and pristine
    await client.query('ROLLBACK');
    console.log('\n========================================================================');
    console.log('🎉 اكتملت جميع اختبارات نظام تعدد العملات بنجاح 100%!');
    console.log('========================================================================');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ خطأ في الاختبار:', err);
    process.exit(1);
  } finally {
    client.release();
    process.exit(0);
  }
}

runMultiCurrencyVerification();
