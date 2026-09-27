export interface PermissionDefinition {
  module: string;
  moduleNameAr: string;
  moduleNameEn: string;
  screen: string;
  screenNameAr: string;
  screenNameEn: string;
  description: string;
  availableActions: Array<'view' | 'create' | 'edit' | 'delete' | 'approve' | 'print' | 'export'>;
}

export const ACTION_LABELS_AR: Record<string, string> = {
  view: 'عرض واستعراض',
  create: 'إنشاء وإضافة',
  edit: 'تعديل وتحديث',
  delete: 'حذف',
  approve: 'اعتماد وترحيل',
  print: 'طباعة ومعاينة',
  export: 'تصدير بيانات',
};

export const PERMISSION_REGISTRY: PermissionDefinition[] = [
  // ==========================================
  // 1. المحاسبة والمالية (Accounting & Finance)
  // ==========================================
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'chart_of_accounts',
    screenNameAr: 'دليل الحسابات وشجرة الحسابات',
    screenNameEn: 'Chart of Accounts',
    description: 'إدارة واستعراض الحسابات المالية والأصول والخصوم والمصروفات والإيرادات',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'cost_centers',
    screenNameAr: 'مراكز التكلفة',
    screenNameEn: 'Cost Centers',
    description: 'إدارة مراكز التكلفة وتوزيع النفقات والمشاريع',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'journal_entries',
    screenNameAr: 'القيود اليومية العامة',
    screenNameEn: 'Journal Entries',
    description: 'إنشاء وإدارة وترحيل واعتماد قيود اليومية المحاسبية',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'opening_balances',
    screenNameAr: 'الأرصدة الافتتاحية',
    screenNameEn: 'Opening Balances',
    description: 'إدخال واعتماد الأرصدة الافتتاحية للحسابات',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'trial_balance',
    screenNameAr: 'ميزان المراجعة',
    screenNameEn: 'Trial Balance',
    description: 'استعراض وطباعة ميزان المراجعة بالمجاميع والأرصدة',
    availableActions: ['view', 'print', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'account_details',
    screenNameAr: 'كشف الحساب والتحليلات',
    screenNameEn: 'Account Statement',
    description: 'استعراض حركة وكشوفات الحسابات التفصيلية',
    availableActions: ['view', 'print', 'export'],
  },
  {
    module: 'accounting',
    moduleNameAr: 'المحاسبة المالية',
    moduleNameEn: 'Financial Accounting',
    screen: 'financial_statements',
    screenNameAr: 'القوائم المالية والختامية',
    screenNameEn: 'Financial Statements',
    description: 'قائمة الدخل، المركز المالي، وقوائم الأرباح والخسائر',
    availableActions: ['view', 'print', 'export'],
  },

  // ==========================================
  // 2. سندات القبض والصرف (Vouchers)
  // ==========================================
  {
    module: 'vouchers',
    moduleNameAr: 'سندات القبض والصرف',
    moduleNameEn: 'Vouchers',
    screen: 'receipt_vouchers',
    screenNameAr: 'سندات القبض',
    screenNameEn: 'Receipt Vouchers',
    description: 'إصدار واعتماد وطباعة سندات قبض النقدية والشيكات والتحويلات',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'vouchers',
    moduleNameAr: 'سندات القبض والصرف',
    moduleNameEn: 'Vouchers',
    screen: 'payment_vouchers',
    screenNameAr: 'سندات الصرف',
    screenNameEn: 'Payment Vouchers',
    description: 'إصدار واعتماد وطباعة سندات صرف المصروفات والموردين',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },

  // ==========================================
  // 3. المبيعات والعملاء (Sales & Customers)
  // ==========================================
  {
    module: 'sales',
    moduleNameAr: 'المبيعات والعملاء',
    moduleNameEn: 'Sales & Customers',
    screen: 'sales_dashboard',
    screenNameAr: 'لوحة مؤشرات المبيعات',
    screenNameEn: 'Sales Dashboard',
    description: 'لوحة التحكم والتحليلات البيعية والإحصائيات',
    availableActions: ['view'],
  },
  {
    module: 'sales',
    moduleNameAr: 'المبيعات والعملاء',
    moduleNameEn: 'Sales & Customers',
    screen: 'customers',
    screenNameAr: 'دليل العملاء',
    screenNameEn: 'Customers Directory',
    description: 'إدارة بيانات العملاء وحدود الائتمان وكشوفات حساباتهم',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'sales',
    moduleNameAr: 'المبيعات والعملاء',
    moduleNameEn: 'Sales & Customers',
    screen: 'sales_quotations',
    screenNameAr: 'عروض الأسعار',
    screenNameEn: 'Sales Quotations',
    description: 'إصدار وتعديل وطباعة عروض الأسعار للعملاء',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'sales',
    moduleNameAr: 'المبيعات والعملاء',
    moduleNameEn: 'Sales & Customers',
    screen: 'sales_invoices',
    screenNameAr: 'فواتير المبيعات',
    screenNameEn: 'Sales Invoices',
    description: 'إنشاء واعتماد وترحيل وطباعة فواتير المبيعات الضريبية',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'sales',
    moduleNameAr: 'المبيعات والعملاء',
    moduleNameEn: 'Sales & Customers',
    screen: 'sales_returns',
    screenNameAr: 'مردودات ومبيعات مرتجعة',
    screenNameEn: 'Sales Returns',
    description: 'إصدار إشعارات دائنة ومردودات مبيعات مع التأثير المخزني',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },

  // ==========================================
  // 4. المشتريات والموردون (Purchasing & Suppliers)
  // ==========================================
  {
    module: 'purchasing',
    moduleNameAr: 'المشتريات والموردون',
    moduleNameEn: 'Purchasing & Suppliers',
    screen: 'purchasing_dashboard',
    screenNameAr: 'لوحة مؤشرات المشتريات',
    screenNameEn: 'Purchasing Dashboard',
    description: 'لوحة مؤشرات المشتريات وتحليلات أوامر الشراء والموردين',
    availableActions: ['view'],
  },
  {
    module: 'purchasing',
    moduleNameAr: 'المشتريات والموردون',
    moduleNameEn: 'Purchasing & Suppliers',
    screen: 'suppliers',
    screenNameAr: 'دليل الموردين',
    screenNameEn: 'Suppliers Directory',
    description: 'إدارة الموردين والشركات الموردة ومتابعة أرصدتهم',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'purchasing',
    moduleNameAr: 'المشتريات والموردون',
    moduleNameEn: 'Purchasing & Suppliers',
    screen: 'purchase_orders',
    screenNameAr: 'أوامر الشراء',
    screenNameEn: 'Purchase Orders',
    description: 'إنشاء واعتماد وتتبع أوامر الشراء للموردين',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },
  {
    module: 'purchasing',
    moduleNameAr: 'المشتريات والموردون',
    moduleNameEn: 'Purchasing & Suppliers',
    screen: 'purchase_invoices',
    screenNameAr: 'فواتير المشتريات',
    screenNameEn: 'Purchase Invoices',
    description: 'تسجيل واعتماد وترحيل فواتير المشتريات والمصاريف الإضافية',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },

  // ==========================================
  // 5. المخازن والمستودعات (Inventory & Warehouses)
  // ==========================================
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'warehouses',
    screenNameAr: 'إدارة المستودعات والمخازن',
    screenNameEn: 'Warehouses Management',
    description: 'تهيئة المستودعات والمواقع وأمناء المخازن',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'items',
    screenNameAr: 'الأصناف والمنتجات والخدمات',
    screenNameEn: 'Items & Products',
    description: 'بطاقة الصنف، أسعار التكلفة، البيع، الباركود وحدود الطلب',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'categories',
    screenNameAr: 'تصنيفات ومجموعات الأصناف',
    screenNameEn: 'Item Categories',
    description: 'شجرة وتصنيف المجموعات والأنواع للمخزون',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'uoms',
    screenNameAr: 'وحدات القياس والتحويل',
    screenNameEn: 'Units of Measure',
    description: 'إدارة وحدات القياس ومعاملات التحويل بين الوحدات',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'balances',
    screenNameAr: 'أرصدة وجرد المخزون',
    screenNameEn: 'Stock Balances & Levels',
    description: 'استعراض كميات المخزون وتكلفة المخزون والأرصدة الحالية',
    availableActions: ['view', 'export'],
  },
  {
    module: 'inventory',
    moduleNameAr: 'المخازن والمستودعات',
    moduleNameEn: 'Inventory & Warehouses',
    screen: 'transactions',
    screenNameAr: 'الحركات المخزنية (استلام مشتريات، صرف، تحويل، تسوية)',
    screenNameEn: 'Inventory Movements',
    description: 'تنفيذ واستعراض حركات استلام المشتريات، صرف المخزون، التحويل بين المستودعات، وتسويات المخزون',
    availableActions: ['view', 'create', 'edit', 'delete', 'approve', 'print', 'export'],
  },

  // ==========================================
  // 6. الموارد البشرية والرواتب (HR & Payroll)
  // ==========================================
  {
    module: 'hr',
    moduleNameAr: 'الموارد البشرية',
    moduleNameEn: 'Human Resources',
    screen: 'hr_dashboard',
    screenNameAr: 'لوحة مؤشرات الموارد البشرية',
    screenNameEn: 'HR Dashboard',
    description: 'إحصائيات الموظفين، الحضور، الإجازات ومعدل الدوران',
    availableActions: ['view'],
  },
  {
    module: 'hr',
    moduleNameAr: 'الموارد البشرية',
    moduleNameEn: 'Human Resources',
    screen: 'employees',
    screenNameAr: 'ملفات وبيانات الموظفين',
    screenNameEn: 'Employee Directory',
    description: 'إدارة بيانات الموظفين والعقود والرواتب والمستندات',
    availableActions: ['view', 'create', 'edit', 'delete', 'export'],
  },
  {
    module: 'hr',
    moduleNameAr: 'الموارد البشرية',
    moduleNameEn: 'Human Resources',
    screen: 'attendance',
    screenNameAr: 'سجل الحضور والغياب والانصراف',
    screenNameEn: 'Attendance Register',
    description: 'تسجيل ومتابعة حضور وانصراف الموظفين وساعات التأخير والعمل الإضافي',
    availableActions: ['view', 'create', 'edit', 'export'],
  },
  {
    module: 'hr',
    moduleNameAr: 'الموارد البشرية',
    moduleNameEn: 'Human Resources',
    screen: 'leave_management',
    screenNameAr: 'إدارة طلبات الإجازات',
    screenNameEn: 'Leave Management',
    description: 'تقديم واعتماد ومتابعة أرصدة وإجازات الموظفين',
    availableActions: ['view', 'create', 'edit', 'approve'],
  },
  {
    module: 'payroll',
    moduleNameAr: 'الرواتب والأجور',
    moduleNameEn: 'Payroll',
    screen: 'payroll_sheet',
    screenNameAr: 'مسيرات وكشوف الرواتب',
    screenNameEn: 'Payroll Sheet',
    description: 'إعداد واحتساب واعتماد مسيرات الرواتب الشهرية والخصومات والتأمينات',
    availableActions: ['view', 'create', 'edit', 'approve', 'print', 'export'],
  },
  {
    module: 'payroll',
    moduleNameAr: 'الرواتب والأجور',
    moduleNameEn: 'Payroll',
    screen: 'allowances_deductions',
    screenNameAr: 'البدلات والاستقطاعات والمكافآت',
    screenNameEn: 'Allowances & Deductions',
    description: 'تهيئة وإدارة بنود البدلات والحوافز والاستقطاعات',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },

  // ==========================================
  // 7. تهيئة وإدارة النظام (System Administration)
  // ==========================================
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'company_profile',
    screenNameAr: 'الملف التعريفي والبيانات الأساسية للمنشأة',
    screenNameEn: 'Company Profile',
    description: 'إعداد اسم المنشأة، الرقم الضريبي، الشعار، والسنوات المالية',
    availableActions: ['view', 'edit'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'branches',
    screenNameAr: 'إدارة الفروع والمواقع',
    screenNameEn: 'Branches Management',
    description: 'إضافة وتعديل بيانات الفروع والمقرات التابعة للشركة',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'currencies',
    screenNameAr: 'إدارة العملات',
    screenNameEn: 'Currencies Management',
    description: 'تعريف العملات والعملة الأساسية والكسور',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'exchange_rates',
    screenNameAr: 'أسعار الصرف اليومية',
    screenNameEn: 'Daily Exchange Rates',
    description: 'إدخال وتحديث أسعار صرف العملات الأجنبية مقابل العملة الأساسية',
    availableActions: ['view', 'create', 'edit'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'cash_boxes',
    screenNameAr: 'الصناديق والخزائن النقدية',
    screenNameEn: 'Cash Boxes Management',
    description: 'إدارة وتخصيص الخزائن النقدية والعهد',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'bank_accounts',
    screenNameAr: 'الحسابات البنكية للمنشأة',
    screenNameEn: 'Bank Accounts',
    description: 'إدارة أرقام الآيبان والحسابات البنكية المعتمدة',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'users',
    screenNameAr: 'إدارة مستخدمي النظام وحسابات الدخول',
    screenNameEn: 'User Accounts Management',
    description: 'إنشاء وتعديل وتفعيل وتعطيل حسابات المستخدمين وتعيين الأدوار',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'roles',
    screenNameAr: 'إدارة الأدوار الوظيفية (Roles)',
    screenNameEn: 'Roles Management',
    description: 'إنشاء الأدوار وتعيين الصلاحيات وإدارة مستويات الوصول',
    availableActions: ['view', 'create', 'edit', 'delete'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'permissions',
    screenNameAr: 'مصفوفة الصلاحيات المتقدمة',
    screenNameEn: 'Permissions Matrix',
    description: 'التحكم في تفاصيل الصلاحيات ومصفوفة العمليات لكل دور',
    availableActions: ['view', 'edit'],
  },
  {
    module: 'system',
    moduleNameAr: 'تهيئة وإدارة النظام',
    moduleNameEn: 'System Administration',
    screen: 'settings',
    screenNameAr: 'إعدادات النظام والسياسات العامة',
    screenNameEn: 'General Settings',
    description: 'نسبة الضريبة، منع البيع بالسالب، خيارات الترقيم الآلي',
    availableActions: ['view', 'edit'],
  },

  // ==========================================
  // 8. التقارير والتحليلات (Reports & Analytics)
  // ==========================================
  {
    module: 'reports',
    moduleNameAr: 'التقارير والتحليلات',
    moduleNameEn: 'Reports & Analytics',
    screen: 'reports_dashboard',
    screenNameAr: 'لوحة التقارير العامة والشاملة',
    screenNameEn: 'General Reports Dashboard',
    description: 'تقارير الأداء المالي، المبيعات، المشتريات، حركة الأصناف والضريبة',
    availableActions: ['view', 'print', 'export'],
  },
];

export const getScreenDefinition = (module: string, screen: string): PermissionDefinition | undefined => {
  return PERMISSION_REGISTRY.find(
    (p) => p.module.toLowerCase() === module.toLowerCase() && p.screen.toLowerCase() === screen.toLowerCase()
  );
};
