# System ERP - Backend API 🚀

الواجهة الخلفية وخادم الـ API لنظام إدارة الموارد وتخطيط المؤسسات (ERP System Backend) مبني باستخدام:
- **Node.js** + **TypeScript** + **Express**
- **PostgreSQL** (يدعم Supabase / AWS RDS / Local PostgreSQL)
- **JWT** (JSON Web Tokens) مع Refresh Token للمصادقة وتفويض الصلاحيات
- **RBAC Matrix** (Role-Based Access Control)
- **Security Middlewares**: Helmet, CORS, Express Validator, Morgan

---

## 🛠 متطلبات التشغيل
- Node.js 18+ أو 20+
- قاعدة بيانات PostgreSQL (محلياً أو سحابياً عبر Supabase)

---

## ⚙️ التثبيت والتشغيل المحلي

1. **تثبيت التبعيات:**
   ```bash
   npm install
   ```

2. **إعداد المتغيرات البيئية:**
   قم بنسخ ملف `.env.example` إلى `.env`:
   ```bash
   cp .env.example .env
   ```
   وقم بتعبئة بيانات قاعدة البيانات ومفاتيح الـ JWT:
   ```env
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=stitch_erp
   DB_USER=postgres
   DB_PASSWORD=your_db_password
   JWT_SECRET=your_jwt_secret
   FRONTEND_URL=http://localhost:5173
   ```

3. **تهيئة قاعدة البيانات:**
   يمكنك تنفيذ المخطط الموجود في `database/schema.sql` وبيانات التهيئة في `database/seed.sql`:
   ```bash
   node database/init.js
   ```

4. **تشغيل الخادم في وضع التطوير (Hot Reload):**
   ```bash
   npm run dev
   ```
   سيعمل الخادم على: `http://localhost:5000`
   رابط الـ API الأساسي: `http://localhost:5000/api`

5. **بناء النسخة الإنتاجية والتشغيل:**
   ```bash
   npm run build
   npm start
   ```

---

## 📁 بنية المشروع
```
src/
├── config/          # إعداد اتصال قاعدة البيانات db.ts والـ Migrations
├── controllers/     # معالجة منطق الأعمال (Auth, Accounting, Sales, Purchasing...)
├── middleware/      # التحقق من الـ Auth, JWT, Audit Logging, Error Handling
├── routes/          # تعريف وتوجيه مسارات الـ API
├── utils/           # دوال المساعدة وتنسيق الاستجابة القياسية
└── index.ts         # نقطة انطلاق الخادم وتكوين CORS و Helmet
database/            # ملفات SQL للمخططات والـ Migrations و Seed Data
scripts/             # سكربتات فحص الاتصال واختبار العمليات الدورية
```