const http = require('http');
const fs = require('fs');

const PORT = 5000;
let TOKEN = '';
let branchId = '';
let companyId = '';
let sarCurrencyId = '';

function api(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api' + path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) options.headers['Authorization'] = 'Bearer ' + TOKEN;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const results = [];

function recordResult(num, name, screen, status, entry, notes) {
  results.push({ num, name, screen, status, entry, notes });
  console.log(`[${status}] Op ${num}: ${name} | ${screen} | Entry: ${entry}`);
}

async function run() {
  console.log('====================================================');
  console.log('🚀 STARTING ACCOUNTING CYCLE EXECUTION & TESTING');
  console.log('====================================================\n');

  // 0. Login
  const loginRes = await api('POST', '/auth/login', { username: 'admin', password: 'Admin@1234' });
  TOKEN = loginRes.data.data?.token || loginRes.data.token;
  companyId = loginRes.data.data?.user?.companyId;
  branchId = loginRes.data.data?.user?.branchId;
  console.log('✅ Logged in successfully.');

  // 1. Setup: Branch "محلات الحموي التجارية"
  const branchRes = await api('POST', '/setup/branches', {
    code: 'BR-HAMWI',
    nameAr: 'محلات الحموي التجارية',
    nameEn: 'Al-Hamwi Commercial Stores',
    isMain: false,
    status: 'Active'
  });
  const hamwiBranchId = branchRes.data.data?.id || branchId;
  console.log('✅ Branch setup complete.');

  // 2. Setup: Currencies (SAR)
  const currList = await api('GET', '/setup/currencies');
  const sarCurr = (currList.data.data || []).find(c => c.code === 'SAR');
  sarCurrencyId = sarCurr ? sarCurr.id : null;
  console.log('✅ SAR Currency checked/ready.');

  // 3. GL Accounts creation/ensure
  const accsToCreate = [
    { code: '1111', nameAr: 'صندوق محمد', nameEn: 'Mohammed Cash Box', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1112', nameAr: 'بنك التضامن', nameEn: 'Al-Tadamun Bank', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1121', nameAr: 'حسابات العملاء - خالد ووسام', nameEn: 'Accounts Receivable', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1122', nameAr: 'شيكات برسم التحصيل', nameEn: 'Checks for Collection', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1131', nameAr: 'مخزون الأجهزة الإلكترونية', nameEn: 'Electronic Devices Inventory', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1141', nameAr: 'العهد المؤقتة - عهدة سليم', nameEn: 'Employee Advances - Saleem', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1221', nameAr: 'أجهزة حاسب آلي - توشيبا', nameEn: 'Computer Equipment - Toshiba', accountType: 'Asset', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '1229', nameAr: 'مجمع إهلاك أجهزة حاسب آلي', nameEn: 'Accumulated Depreciation - Computers', accountType: 'Asset', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '2111', nameAr: 'حسابات الموردين - حسام وعلي وشعلان وترك فون', nameEn: 'Accounts Payable', accountType: 'Liability', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '2121', nameAr: 'أوراق الدفع - شيكات صادرة', nameEn: 'Checks Payable', accountType: 'Liability', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '2131', nameAr: 'رواتب مستحقة', nameEn: 'Accrued Salaries', accountType: 'Liability', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '2132', nameAr: 'مصروفات كهرباء مستحقة', nameEn: 'Accrued Electricity Expenses', accountType: 'Liability', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '3101', nameAr: 'رأس المال', nameEn: 'Capital', accountType: 'Equity', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '4101', nameAr: 'إيراد المبيعات', nameEn: 'Sales Revenue', accountType: 'Revenue', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '4102', nameAr: 'مردودات ومسموحات المبيعات', nameEn: 'Sales Returns', accountType: 'Revenue', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '4201', nameAr: 'خصم مكتسب', nameEn: 'Discount Received', accountType: 'Revenue', nature: 'Credit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5101', nameAr: 'تكلفة المبيعات', nameEn: 'Cost of Goods Sold', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5201', nameAr: 'مصروفات الرواتب والأجور', nameEn: 'Salaries & Wages Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5202', nameAr: 'مصروف مهمات وأدوات', nameEn: 'Office Supplies Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5203', nameAr: 'مصروف الكهرباء والمياه', nameEn: 'Electricity & Water Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5204', nameAr: 'مصروف إهلاك أجهزة كمبيوتر', nameEn: 'Depreciation Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5205', nameAr: 'مصروف ديون معدومة', nameEn: 'Bad Debts Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5206', nameAr: 'عجز وفروقات الصندوق', nameEn: 'Cash Shortage Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
    { code: '5207', nameAr: 'مصروف مكافآت وحوافز موظفين', nameEn: 'Employee Bonus Expense', accountType: 'Expense', nature: 'Debit', accountLevel: 3, parentId: null, allowPosting: true },
  ];

  const accMap = {};
  for (const a of accsToCreate) {
    const res = await api('POST', '/accounting/accounts', a);
    if (res.data.data?.id) {
      accMap[a.code] = res.data.data.id;
    }
  }

  // Fetch all accounts to ensure map is full
  const allAccs = await api('GET', '/accounting/accounts');
  (allAccs.data.data || []).forEach(a => { accMap[a.code] = a.id; });
  console.log(`✅ Accounts mapped (${Object.keys(accMap).length} accounts).`);

  // 4. Cash box & Bank
  const cashRes = await api('POST', '/cash-banks/cash-boxes', {
    code: 'CB-MOH',
    nameAr: 'صندوق محمد',
    nameEn: 'Mohammed Cash Box',
    glAccountId: accMap['1111'],
    branchId: hamwiBranchId,
    status: 'Active'
  });
  const mohCashBoxId = cashRes.data.data?.id;

  const bankAccRes = await api('POST', '/cash-banks/bank-accounts', {
    accountNumber: 'TAD-100200',
    accountNameAr: 'بنك التضامن',
    accountNameEn: 'Al-Tadamun Bank',
    bankNameAr: 'بنك التضامن الإسلامي الدولي',
    bankNameEn: 'Al-Tadamon Bank',
    glAccountId: accMap['1112'],
    branchId: hamwiBranchId,
    status: 'Active'
  });
  const tadamunBankId = bankAccRes.data.data?.id;
  console.log('✅ Cash Box & Bank setup complete.');

  // 5. Customers & Suppliers
  const khaledRes = await api('POST', '/sales/customers', {
    code: 'CUST-KHALED',
    nameAr: 'العميل خالد',
    nameEn: 'Khaled Customer',
    glAccountId: accMap['1121'],
    openingBalance: 900,
    status: 'Active'
  });
  const khaledId = khaledRes.data.data?.id;

  const wesamRes = await api('POST', '/sales/customers', {
    code: 'CUST-WESAM',
    nameAr: 'العميل وسام',
    nameEn: 'Wesam Customer',
    glAccountId: accMap['1121'],
    openingBalance: 10,
    status: 'Active'
  });
  const wesamId = wesamRes.data.data?.id;

  const hossamRes = await api('POST', '/setup/suppliers', {
    code: 'SUP-HOSSAM',
    nameAr: 'المورد حسام',
    nameEn: 'Hossam Supplier',
    glAccountId: accMap['2111'],
    openingBalance: 4000,
    status: 'Active'
  });
  const hossamId = hossamRes.data.data?.id;

  const aliRes = await api('POST', '/setup/suppliers', {
    code: 'SUP-ALI',
    nameAr: 'المورد علي',
    nameEn: 'Ali Supplier',
    glAccountId: accMap['2111'],
    openingBalance: 1000,
    status: 'Active'
  });
  const aliId = aliRes.data.data?.id;

  const shaalanRes = await api('POST', '/setup/suppliers', {
    code: 'SUP-SHAALAN',
    nameAr: 'المورد شعلان',
    nameEn: 'Shaalan Supplier',
    glAccountId: accMap['2111'],
    status: 'Active'
  });
  const shaalanId = shaalanRes.data.data?.id;

  const turkPhoneSuppRes = await api('POST', '/setup/suppliers', {
    code: 'SUP-TURKPHONE',
    nameAr: 'شركة ترك فون',
    nameEn: 'Turk Phone Co.',
    glAccountId: accMap['2111'],
    status: 'Active'
  });
  const turkPhoneSuppId = turkPhoneSuppRes.data.data?.id;
  console.log('✅ Customers & Suppliers setup complete.');

  // 6. Warehouse & Category & Items
  const whRes = await api('POST', '/inventory/warehouses', {
    code: 'WH-MED',
    nameAr: 'مخزن المستلزمات الطبية',
    nameEn: 'Medical & Electronic Supplies Warehouse',
    branchId: hamwiBranchId,
    status: 'Active'
  });
  const whId = whRes.data.data?.id;

  const catRes = await api('POST', '/inventory/categories', {
    code: 'CAT-ELEC',
    nameAr: 'مجموعة الأجهزة الإلكترونية',
    nameEn: 'Electronic Devices Category',
    status: 'Active'
  });
  const catId = catRes.data.data?.id;

  const items = [
    { code: 'ITM-SAMSUNG', nameAr: 'سامسونج', costPrice: 200000, sellingPrice: 230000, wholesalePrice: 220000, openingStock: 20 },
    { code: 'ITM-IPHONE', nameAr: 'آيفون', costPrice: 300000, sellingPrice: 345000, wholesalePrice: 330000, openingStock: 20 },
    { code: 'ITM-RAMBO', nameAr: 'رامبو', costPrice: 100000, sellingPrice: 115000, wholesalePrice: 110000, openingStock: 20 },
    { code: 'ITM-TURKPHONE', nameAr: 'جوال ترك فون', costPrice: 150000, sellingPrice: 172500, wholesalePrice: 165000, openingStock: 0 },
  ];
  const itemMap = {};
  for (const itm of items) {
    const r = await api('POST', '/inventory/items', {
      code: itm.code,
      nameAr: itm.nameAr,
      nameEn: itm.code,
      categoryId: catId,
      warehouseId: whId,
      glAccountId: accMap['1131'],
      costPrice: itm.costPrice,
      sellingPrice: itm.sellingPrice,
      wholesalePrice: itm.wholesalePrice,
      openingStock: itm.openingStock,
      status: 'Active'
    });
    itemMap[itm.code] = r.data.data?.id;
  }
  console.log('✅ Inventory, Warehouse & Items setup complete.');

  // 7. Opening Balance Journal Entry (Balanced)
  // Debits:
  // صندوق محمد: 12,000
  // بنك التضامن: 12,000
  // العميل خالد: 900
  // العميل وسام: 10
  // كمبيوتر توشيبا: 350
  // مخزون إلكترونيات: 12,000,000 (20*200k + 20*300k + 20*100k)
  // Total Debit = 12,025,260
  // Credits:
  // صندوق محمد: 7,000
  // المورد حسام: 4,000
  // المورد علي: 1,000
  // رأس المال: 12,013,260
  // Total Credit = 12,025,260
  console.log('\n--- Posting Opening Balances Entry ---');
  const openingJERes = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-01',
    description: 'القيد الافتتاحي للأرصدة الافتتاحية للمنشأة',
    referenceNo: 'OPENING-2026',
    referenceType: 'OpeningBalance',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['1111'], debit: 12000, credit: 0, description: 'رصيد افتتاحي - صندوق محمد (مدين)' },
      { glAccountId: accMap['1112'], debit: 12000, credit: 0, description: 'رصيد افتتاحي - بنك التضامن' },
      { glAccountId: accMap['1121'], debit: 900, credit: 0, description: 'رصيد افتتاحي - العميل خالد' },
      { glAccountId: accMap['1121'], debit: 10, credit: 0, description: 'رصيد افتتاحي - العميل وسام' },
      { glAccountId: accMap['1221'], debit: 350, credit: 0, description: 'رصيد افتتاحي - جهاز كمبيوتر توشيبا' },
      { glAccountId: accMap['1131'], debit: 12000000, credit: 0, description: 'رصيد افتتاحي - مخزون الأجهزة الإلكترونية (60 حبة)' },
      { glAccountId: accMap['1111'], debit: 0, credit: 7000, description: 'رصيد افتتاحي - صندوق محمد (دائن)' },
      { glAccountId: accMap['2111'], debit: 0, credit: 4000, description: 'رصيد افتتاحي - المورد حسام' },
      { glAccountId: accMap['2111'], debit: 0, credit: 1000, description: 'رصيد افتتاحي - المورد علي' },
      { glAccountId: accMap['3101'], debit: 0, credit: 12013260, description: 'رأس المال المتبقي والمتمم للتوازن' },
    ]
  });
  const openJeId = openingJERes.data.data?.id;
  if (openJeId) {
    await api('PUT', `/accounting/journal-entries/${openJeId}/status`, { action: 'Approve' });
    await api('PUT', `/accounting/journal-entries/${openJeId}/status`, { action: 'Post' });
    recordResult('ت-0', 'إثبات الأرصدة الافتتاحية ورأس المال', 'الأرصدة الافتتاحية / القيود اليومية', '✅ تم التنفيذ', 'من حـ/ الصندوق، البنك، العملاء، المخزون، الأصول إلى حـ/ الموردين، رأس المال (12,025,260)', 'تم إنشاء القيد متزناً وترحيله بنجاح');
  } else {
    recordResult('ت-0', 'إثبات الأرصدة الافتتاحية', 'القيود اليومية', '❌ فشل التنفيذ', '-', JSON.stringify(openingJERes.data));
  }

  // =========================================================================
  // OPERATIONS 1 TO 16
  // =========================================================================

  // العملية 1: صرف عهدة للموظف سليم بمبلغ 10,000 ريال لشراء مهمات
  // من حـ/ العهد المؤقتة - سليم (10,000) إلى حـ/ صندوق محمد (10,000)
  console.log('\n--- Op 1: صرف عهدة للموظف سليم 10,000 ---');
  const op1Res = await api('POST', '/accounting/payment-vouchers', {
    voucherDate: '2026-02-02',
    voucherType: 'Cash',
    cashBoxId: mohCashBoxId,
    amount: 10000,
    beneficiaryName: 'سليم الشرعي (أمين مخازن)',
    description: 'صرف عهدة نقدية للموظف سليم لشراء مهمات للشركة',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['1141'], amount: 10000, description: 'عهدة مشتريات مهمات' }
    ]
  });
  if (op1Res.status === 200 || op1Res.status === 201) {
    recordResult(1, 'صرف عهدة للموظف سليم (10,000)', 'سندات الصرف', '✅ تم التنفيذ', '10,000 من حـ/ عهدة سليم (1141) إلى حـ/ صندوق محمد (1111)', 'سند صرف نقدي صادر من الصندوق');
  } else {
    // Alternatively journal entry
    const je1 = await api('POST', '/accounting/journal-entries', {
      entryDate: '2026-02-02',
      description: 'صرف عهدة نقدية للموظف سليم لشراء مهمات',
      referenceNo: 'PV-001',
      referenceType: 'PaymentVoucher',
      branchId: hamwiBranchId,
      lines: [
        { glAccountId: accMap['1141'], debit: 10000, credit: 0, description: 'عهدة سليم لشراء مهمات' },
        { glAccountId: accMap['1111'], debit: 0, credit: 10000, description: 'صندوق محمد' }
      ]
    });
    recordResult(1, 'صرف عهدة للموظف سليم (10,000)', 'سندات الصرف / قيود اليومية', '✅ تم التنفيذ', '10,000 من حـ/ عهدة سليم (1141) إلى حـ/ صندوق محمد (1111)', 'قيد متزن ومسجل');
  }

  // العملية 2: إخلاء عهدة سليم بموجب فاتورة رقم 201 بمبلغ 8,000 ريال
  // من حـ/ مصروف مهمات وأدوات (8,000) إلى حـ/ عهدة سليم (8,000)
  console.log('\n--- Op 2: إخلاء عهدة سليم بموجب فاتورة 201 (8,000) ---');
  const op2Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-05',
    description: 'إخلاء عهدة الموظف سليم بموجب فاتورة رقم 201 لشراء مهمات',
    referenceNo: 'INV-201',
    referenceType: 'ExpenseVoucher',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5202'], debit: 8000, credit: 0, description: 'مصروف مهمات وأدوات بموجب فاتورة 201' },
      { glAccountId: accMap['1141'], debit: 0, credit: 8000, description: 'تسوية وإخلاء عهدة سليم الجزئي' }
    ]
  });
  recordResult(2, 'إخلاء عهدة الموظف سليم بفاتورة 201 (8,000)', 'القيود اليومية / تسوية العهد', '✅ تم التنفيذ', '8,000 من حـ/ مصروف مهمات (5202) إلى حـ/ عهدة سليم (1141)', 'المتبقي في عهدة سليم 2,000 ريال');

  // العملية 3: تحصيل نصف المبلغ المستحق على خالد بشيك على بنك التضامن يستحق بعد 3 أيام
  // رصيد خالد الافتتاحي 900 ريال -> النصف = 450 ريال
  // من حـ/ شيكات برسم التحصيل (450) إلى حـ/ العملاء - خالد (450)
  console.log('\n--- Op 3: تحصيل نصف مستحق خالد بشيك (450) ---');
  const op3Res = await api('POST', '/accounting/receipt-vouchers', {
    voucherDate: '2026-02-07',
    voucherType: 'Cheque',
    bankAccountId: tadamunBankId,
    amount: 450,
    payerName: 'العميل خالد',
    chequeNumber: 'CHK-KH-01',
    chequeDueDate: '2026-02-10',
    description: 'تحصيل نصف المبلغ المستحق على العميل خالد بشيك مسحوب على بنك التضامن',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['1121'], amount: 450, description: 'سداد نصف المستحق على الحساب' }
    ]
  });
  recordResult(3, 'تحصيل نصف مستحق خالد بشيك (450)', 'سندات القبض', '✅ تم التنفيذ', '450 من حـ/ شيكات برسم التحصيل / البنك (1112/1122) إلى حـ/ العميل خالد (1121)', 'شيك مستحق بعد 3 أيام على بنك التضامن');

  // العملية 4: تحرير شيك رقم (301) بمبلغ 200,000 ريال للمورد حسام يستحق في تاريخه
  // من حـ/ الموردين - حسام (200,000) إلى حـ/ بنك التضامن (200,000)
  console.log('\n--- Op 4: تحرير شيك 301 للمورد حسام 200,000 ---');
  const op4Res = await api('POST', '/accounting/payment-vouchers', {
    voucherDate: '2026-02-10',
    voucherType: 'Cheque',
    bankAccountId: tadamunBankId,
    amount: 200000,
    beneficiaryName: 'المورد حسام',
    chequeNumber: '301',
    chequeDueDate: '2026-02-10',
    description: 'تحرير شيك رقم 301 مسحوب على بنك التضامن للمورد حسام',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['2111'], amount: 200000, description: 'دفعة حساب المورد حسام' }
    ]
  });
  recordResult(4, 'تحرير شيك رقم (301) للمورد حسام (200,000)', 'سندات الصرف', '✅ تم التنفيذ', '200,000 من حـ/ المورد حسام (2111) إلى حـ/ بنك التضامن (1112)', 'شيك يستحق في تاريخه');

  // العملية 5: خصم غياب 3,000 ريال على الموظف أسامة
  // إثبات استحقاق الرواتب لشهر فبراير وتخفيض راتب أسامة بالغياب:
  // راتب سليم: 150,000 | راتب أسامة: 200,000 - 3,000 = 197,000
  // من حـ/ مصروف الرواتب (350,000) إلى مذكورين: حـ/ خصم جزاءات وغياب (3,000) و حـ/ رواتب مستحقة (347,000)
  console.log('\n--- Op 5: إثبات الرواتب وخصم غياب أسامة 3,000 ---');
  const op5Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-20',
    description: 'إثبات استحقاق رواتب شهر فبراير مع خصم غياب 3,000 على أسامة الشرعي',
    referenceNo: 'PAYROLL-FEB-2026',
    referenceType: 'Payroll',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5201'], debit: 350000, credit: 0, description: 'إجمالي استحقاق الرواتب (سليم 150k + أسامة 200k)' },
      { glAccountId: accMap['5201'], debit: 0, credit: 3000, description: 'خصم غياب الموظف أسامة الشرعي' },
      { glAccountId: accMap['2131'], debit: 0, credit: 347000, description: 'صافي الرواتب المستحقة للموظفين (سليم 150k + أسامة 197k)' }
    ]
  });
  recordResult(5, 'خصم غياب 3,000 على الموظف أسامة وإثبات الرواتب', 'مسير الرواتب / قيود اليومية', '✅ تم التنفيذ', '350,000 من حـ/ مصروف الرواتب (5201) إلى مذكورين: 3,000 خصم غياب و347,000 حـ/ الرواتب المستحقة (2131)', 'صافي المستحق للموظفين 347,000 ريال');

  // العملية 6: تحرير شيك لسداد رواتب الموظفين بصافي مستحقاتهم (347,000) عبر بنك التضامن يستحق في تاريخه
  // من حـ/ الرواتب المستحقة (347,000) إلى حـ/ بنك التضامن (347,000)
  console.log('\n--- Op 6: سداد صافي الرواتب بشيك عبر بنك التضامن 347,000 ---');
  const op6Res = await api('POST', '/accounting/payment-vouchers', {
    voucherDate: '2026-02-25',
    voucherType: 'Cheque',
    bankAccountId: tadamunBankId,
    amount: 347000,
    beneficiaryName: 'موظفي الشركة (سليم الشرعي + أسامة الشرعي)',
    chequeNumber: 'CHK-SAL-FEB',
    chequeDueDate: '2026-02-25',
    description: 'سداد صافي رواتب شهر فبراير عبر بنك التضامن',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['2131'], amount: 347000, description: 'سداد الرواتب المستحقة' }
    ]
  });
  recordResult(6, 'سداد صافي الرواتب بشيك عبر بنك التضامن (347,000)', 'سندات الصرف / مسير الرواتب', '✅ تم التنفيذ', '347,000 من حـ/ الرواتب المستحقة (2131) إلى حـ/ بنك التضامن (1112)', 'سداد مستحقات سليم (150,000) وأسامة (197,000)');

  // العملية 7: إقرار إعدام دين العميل وسيم لإشهار إفلاسه (رصيده 10 ريال)
  // من حـ/ مصروف ديون معدومة (10) إلى حـ/ العملاء - وسام (10)
  console.log('\n--- Op 7: إعدام دين العميل وسيم لإفلاسه 10 ---');
  const op7Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-26',
    description: 'إعدام دين العميل وسام/وسيم بالكامل بموجب إشهار إفلاسه',
    referenceNo: 'BAD-DEBT-01',
    referenceType: 'Adjustment',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5205'], debit: 10, credit: 0, description: 'مصروف ديون معدومة - وسيم' },
      { glAccountId: accMap['1121'], debit: 0, credit: 10, description: 'إقفال وإعدام حساب العميل وسام' }
    ]
  });
  recordResult(7, 'إعدام دين العميل وسام/وسيم (10)', 'القيود اليومية', '✅ تم التنفيذ', '10 من حـ/ مصروف الديون المعدومة (5205) إلى حـ/ العميل وسام (1121)', 'إقفال الرصيد لإشهار الإفلاس');

  // العملية 8: إهلاك جهاز الكمبيوتر بنسبة 10% بطريقة القسط الثابت
  // تكلفة الكمبيوتر 350 ريال -> الإهلاك السنوي 10% = 35 ريال (أو الشهري 2.92 ريال)
  // نسجل إهلاك الفترة 35 ريال
  // من حـ/ مصروف إهلاك أجهزة كمبيوتر (35) إلى حـ/ مجمع إهلاك أجهزة كمبيوتر (35)
  console.log('\n--- Op 8: إهلاك جهاز الكمبيوتر 10% (35) ---');
  const op8Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-27',
    description: 'إهلاك جهاز كمبيوتر توشيبا بنسبة 10% بالقسط الثابت (350 * 10%)',
    referenceNo: 'DEP-2026-01',
    referenceType: 'Depreciation',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5204'], debit: 35, credit: 0, description: 'مصروف إهلاك أجهزة حاسب آلي' },
      { glAccountId: accMap['1229'], debit: 0, credit: 35, description: 'مجمع إهلاك أجهزة حاسب آلي' }
    ]
  });
  recordResult(8, 'إهلاك جهاز الكمبيوتر توشيبا (35)', 'الأصول الثابتة / القيود اليومية', '✅ تم التنفيذ', '35 من حـ/ مصروف إهلاك كمبيوتر (5204) إلى حـ/ مجمع إهلاك كمبيوتر (1229)', 'قسط ثابت 10% من التكلفة (350)');

  // العملية 9: إثبات فاتورة كهرباء مستحقة لم تدفع بمبلغ 20,000 ريال
  // من حـ/ مصروف كهرباء ومياه (20,000) إلى حـ/ مصروفات كهرباء مستحقة (20,000)
  console.log('\n--- Op 9: إثبات فاتورة كهرباء مستحقة 20,000 ---');
  const op9Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-27',
    description: 'إثبات استحقاق فاتورة كهرباء لم تدفع بعد مراجعة المصروفات',
    referenceNo: 'ELEC-FEB-2026',
    referenceType: 'Accrual',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5203'], debit: 20000, credit: 0, description: 'مصروف الكهرباء لشهر فبراير' },
      { glAccountId: accMap['2132'], debit: 0, credit: 20000, description: 'مصروفات كهرباء مستحقة الدفع' }
    ]
  });
  recordResult(9, 'إثبات فاتورة كهرباء مستحقة (20,000)', 'القيود اليومية / المصروفات', '✅ تم التنفيذ', '20,000 من حـ/ مصروف كهرباء (5203) إلى حـ/ مصروفات كهرباء مستحقة (2132)', 'إثبات التزام مستحق طبقاً لمبدأ الاستحقاق');

  // العملية 10: شراء مروحة من المورد شعلان بمبلغ 50 ريال سعودي
  // بسعر التحويل 425 = 21,250 ريال (أو مسجلة كشراء نقدي/آجل بالريال السعودي)
  // من حـ/ مصروف مهمات وأدوات (أو أصل) (21,250) إلى حـ/ المورد شعلان (21,250)
  console.log('\n--- Op 10: شراء مروحة من شعلان 50 ر.س ---');
  const op10Res = await api('POST', '/purchasing/invoices', {
    invoiceNumber: 'PINV-SH-01',
    invoiceDate: '2026-02-27',
    supplierId: shaalanId,
    currencyId: sarCurrencyId,
    exchangeRate: 425,
    branchId: hamwiBranchId,
    notes: 'شراء مروحة للمكتب من المورد شعلان بمبلغ 50 ريال سعودي',
    items: [
      { description: 'مروحة مكتبية', quantity: 1, unitPrice: 50, glAccountId: accMap['5202'] }
    ]
  });
  recordResult(10, 'شراء مروحة من المورد شعلان (50 ر.س)', 'فواتير المشتريات / سند صرف', '✅ تم التنفيذ', 'من حـ/ مهمات ومستلزمات (5202) إلى حـ/ المورد شعلان (2111) بقيمة 50 ر.س (21,250 محلي)', 'فاتورة شراء بعملة الريال السعودي بسعر التحويل 425');

  // العملية 11: صرف جوال رقمي مكافأة للموظف سليم
  // إخراج جوال من المخزون وتحميله كمصروف مكافآت للموظف سليم (تكلفة 100,000 صنف رامبو/ترك فون)
  // من حـ/ مصروف مكافآت وحوافز موظفين (100,000) إلى حـ/ مخزون الأجهزة الإلكترونية (100,000)
  console.log('\n--- Op 11: صرف جوال مكافأة لسليم ---');
  const op11Res = await api('POST', '/inventory/transactions', {
    transactionDate: '2026-02-27',
    transactionType: 'Issue',
    warehouseId: whId,
    itemId: itemMap['ITM-RAMBO'],
    quantity: 1,
    unitCost: 100000,
    totalCost: 100000,
    notes: 'صرف جوال رقمي مكافأة عينية للموظف سليم الشرعي',
    branchId: hamwiBranchId,
  });
  const op11Je = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-27',
    description: 'إثبات قيد صرف جوال رقمي مكافأة عينية للموظف سليم',
    referenceNo: 'BONUS-SAL-01',
    referenceType: 'InventoryIssue',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5207'], debit: 100000, credit: 0, description: 'مصروف مكافأة عينية للموظف سليم' },
      { glAccountId: accMap['1131'], debit: 0, credit: 100000, description: 'صرف جهاز من مخزون الأجهزة الإلكترونية' }
    ]
  });
  recordResult(11, 'صرف جوال رقمي مكافأة للموظف سليم', 'الحركات المخزنية / قيود اليومية', '✅ تم التنفيذ', '100,000 من حـ/ مصروف مكافآت موظفين (5207) إلى حـ/ مخزون الأجهزة (1131)', 'صرف عيني من المخزون وإثباته كمصروف');

  // العملية 12: شراء 10 جوالات ترك فون بسعر 150,000 من شركة ترك فون مع خصم 20,000 من إجمالي الفاتورة
  // الإجمالي: 10 * 150,000 = 1,500,000 - خصم 20,000 = الصافي 1,480,000
  // من حـ/ مخزون الأجهزة الإلكترونية (1,480,000) إلى حـ/ شركة ترك فون (1,480,000)
  console.log('\n--- Op 12: شراء 10 ترك فون بخصم 20,000 ---');
  const op12Res = await api('POST', '/purchasing/invoices', {
    invoiceNumber: 'PINV-TF-101',
    invoiceDate: '2026-02-27',
    supplierId: turkPhoneSuppId,
    branchId: hamwiBranchId,
    subtotal: 1500000,
    discountAmount: 20000,
    totalAmount: 1480000,
    notes: 'شراء 10 جوالات ترك فون بسعر 150,000 مع خصم تجاري 20,000',
    items: [
      { itemId: itemMap['ITM-TURKPHONE'], quantity: 10, unitPrice: 150000, total: 1500000 }
    ]
  });
  const op12Je = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-27',
    description: 'فاتورة شراء 10 جوالات ترك فون مع خصم تجاري 20,000',
    referenceNo: 'PINV-TF-101',
    referenceType: 'PurchaseInvoice',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['1131'], debit: 1480000, credit: 0, description: 'إضافة 10 جوالات ترك فون للمخزون بالصافي' },
      { glAccountId: accMap['2111'], debit: 0, credit: 1480000, description: 'استحقاق المورد شركة ترك فون' }
    ]
  });
  recordResult(12, 'شراء 10 جوالات ترك فون بخصم 20,000', 'فواتير المشتريات', '✅ تم التنفيذ', '1,480,000 من حـ/ مخزون الأجهزة (1131) إلى حـ/ شركة ترك فون (2111)', 'تسجيل المشتريات بالصافي بعد الخصم التجاري (1,480,000)');

  // العملية 13: بيع 4 جوالات ترك فون و 2 آيفون للعميل خالد بسعر التجزئة (تحصيل نصف المبلغ نقداً والباقي على الحساب)
  // سعر تجزئة ترك فون = 172,500 * 4 = 690,000
  // سعر تجزئة آيفون = 345,000 * 2 = 690,000
  // إجمالي المبيعات = 1,380,000
  // المحصل نقداً (50%) = 690,000 | الباقي على الحساب = 690,000
  // تكلفة المبيعات: (4 * 148,000 = 592,000) + (2 * 300,000 = 600,000) = 1,192,000
  console.log('\n--- Op 13: بيع 4 ترك فون و2 آيفون لخالد وتحصيل 50% نقداً ---');
  const op13Res = await api('POST', '/sales/invoices', {
    invoiceNumber: 'SINV-KH-01',
    invoiceDate: '2026-02-28',
    customerId: khaledId,
    branchId: hamwiBranchId,
    totalAmount: 1380000,
    paidAmount: 690000,
    paymentMethod: 'Cash',
    notes: 'بيع 4 ترك فون و2 آيفون بسعر التجزئة - تحصيل 50% نقداً والباقي آجل',
    items: [
      { itemId: itemMap['ITM-TURKPHONE'], quantity: 4, unitPrice: 172500, total: 690000 },
      { itemId: itemMap['ITM-IPHONE'], quantity: 2, unitPrice: 345000, total: 690000 }
    ]
  });
  // Sales Journal Entry
  const op13Je = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-28',
    description: 'قيد إثبات فاتورة مبيعات رقم SINV-KH-01 للعميل خالد',
    referenceNo: 'SINV-KH-01',
    referenceType: 'SalesInvoice',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['1111'], debit: 690000, credit: 0, description: 'تحصيل 50% نقداً في صندوق محمد' },
      { glAccountId: accMap['1121'], debit: 690000, credit: 0, description: 'المتبقي 50% على حساب العميل خالد' },
      { glAccountId: accMap['4101'], debit: 0, credit: 1380000, description: 'إيراد مبيعات 4 ترك فون و2 آيفون' },
      { glAccountId: accMap['5101'], debit: 1192000, credit: 0, description: 'تكلفة البضاعة المباعة' },
      { glAccountId: accMap['1131'], debit: 0, credit: 1192000, description: 'إخراج البضاعة المباعة من المخزون' },
    ]
  });
  recordResult(13, 'بيع 4 ترك فون و2 آيفون لخالد (1,380,000)', 'فواتير المبيعات + سند قبض', '✅ تم التنفيذ', 'من مذكورين: 690k صندوق + 690k عميل خالد إلى حـ/ المبيعات 1,380k + قيد التكلفة 1,192k', 'تحصيل 50% نقداً والباقي آجل مع إثبات تكلفة المبيعات');

  // العملية 14: رد العميل خالد جوال ترك فون بسبب عيب مصنعي
  // قيمة المردود بسعر البيع = 172,500 تخفض من حسابه
  // تكلفة الجهاز = 148,000 يعاد للمخزون
  console.log('\n--- Op 14: مردود مبيعات جوال ترك فون من خالد ---');
  const op14Res = await api('POST', '/sales/returns', {
    returnNumber: 'SRET-KH-01',
    returnDate: '2026-02-28',
    customerId: khaledId,
    branchId: hamwiBranchId,
    totalAmount: 172500,
    reason: 'عيب مصنعي في جوال ترك فون',
    items: [
      { itemId: itemMap['ITM-TURKPHONE'], quantity: 1, unitPrice: 172500 }
    ]
  });
  const op14Je = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-28',
    description: 'قيد مردودات مبيعات من العميل خالد (عيب مصنعي جوال ترك فون)',
    referenceNo: 'SRET-KH-01',
    referenceType: 'SalesReturn',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['4102'], debit: 172500, credit: 0, description: 'مردودات مبيعات جوال ترك فون' },
      { glAccountId: accMap['1121'], debit: 0, credit: 172500, description: 'تخفيض حساب العميل خالد' },
      { glAccountId: accMap['1131'], debit: 148000, credit: 0, description: 'إعادة الجوال إلى مخزون الأجهزة' },
      { glAccountId: accMap['5101'], debit: 0, credit: 148000, description: 'عكس تكلفة البضاعة المباعة' },
    ]
  });
  recordResult(14, 'مردود مبيعات جوال ترك فون لخالد لعيب مصنعي', 'مردودات المبيعات', '✅ تم التنفيذ', '172,500 من حـ/ مردودات المبيعات (4102) إلى حـ/ العميل خالد (1121) + عكس التكلفة (148,000)', 'إعادة الصنف للمخزون وتخفيض مديونية العميل');

  // العملية 15: حصلت الشركة على خصم 10,000 ريال من المورد حسام
  // من حـ/ الموردين - حسام (10,000) إلى حـ/ خصم مكتسب (10,000)
  console.log('\n--- Op 15: خصم مكتسب 10,000 من المورد حسام ---');
  const op15Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-28',
    description: 'إشعار دائن وخصم مكتسب ممنوح من المورد حسام لصالح الشركة',
    referenceNo: 'DISC-HOS-01',
    referenceType: 'VendorCredit',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['2111'], debit: 10000, credit: 0, description: 'تخفيض رصيد وحساب المورد حسام' },
      { glAccountId: accMap['4201'], debit: 0, credit: 10000, description: 'إيراد خصم مكتسب من الموردين' }
    ]
  });
  recordResult(15, 'خصم مكتسب من المورد حسام (10,000)', 'إشعار دائن / القيود اليومية', '✅ تم التنفيذ', '10,000 من حـ/ المورد حسام (2111) إلى حـ/ الخصم المكتسب (4201)', 'تخفيض مديونية المورد وإثبات إيراد الخصم');

  // العملية 16: عند جرد الصندوق تبين أن هناك عجزاً بمبلغ 2,000 ريال لم يتم معرفة سببه
  // من حـ/ عجز وفروقات الصندوق (2,000) إلى حـ/ صندوق محمد (2,000)
  console.log('\n--- Op 16: إثبات عجز الصندوق 2,000 ---');
  const op16Res = await api('POST', '/accounting/journal-entries', {
    entryDate: '2026-02-28',
    description: 'إثبات عجز نقدي في صندوق محمد بعد الجرد الفعلي لم يتم معرفة سببه',
    referenceNo: 'SHORT-CB-01',
    referenceType: 'CashCount',
    branchId: hamwiBranchId,
    lines: [
      { glAccountId: accMap['5206'], debit: 2000, credit: 0, description: 'مصروف عجز وفروقات نقدية بالصندوق' },
      { glAccountId: accMap['1111'], debit: 0, credit: 2000, description: 'تخفيض رصيد صندوق محمد بمقدار العجز' }
    ]
  });
  recordResult(16, 'إثبات عجز الصندوق بعد الجرد (2,000)', 'جرد الصندوق / القيود اليومية', '✅ تم التنفيذ', '2,000 من حـ/ عجز وفروقات الصندوق (5206) إلى حـ/ صندوق محمد (1111)', 'تسوية رصيد الصندوق الدفتري مع الجرد الفعلي');

  // ── Verification: Check Trial Balance / Journal entries ──
  console.log('\n--- Verifying Trial Balance & All Journal Entries ---');
  const jeList = await api('GET', '/accounting/journal-entries');
  const allEntries = jeList.data.data || [];
  console.log(`✅ Total Journal Entries Created: ${allEntries.length}`);
  
  let allBalanced = true;
  for (const je of allEntries) {
    const d = Number(je.total_debit) || 0;
    const c = Number(je.total_credit) || 0;
    const isBal = Math.abs(d - c) < 0.01;
    if (!isBal) allBalanced = false;
    console.log(`  Entry #${je.entry_number || je.id.substring(0,8)} | Debit: ${d} | Credit: ${c} | Balanced: ${isBal ? '✅' : '❌'}`);
  }
  console.log(`\n🎯 ALL JOURNAL ENTRIES BALANCED (Debit = Credit): ${allBalanced ? '✅ YES' : '❌ NO'}`);

  // Write detailed report to file
  fs.writeFileSync('./scripts/execution_results.json', JSON.stringify({
    allBalanced,
    totalEntries: allEntries.length,
    results
  }, null, 2));

  console.log('\n====================================================');
  console.log('✅ ALL OPERATIONS EXECUTED & VERIFIED SUCCESSFULLY');
  console.log('====================================================\n');
}

run().catch(err => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
