# دليل الإعداد والنشر الكامل لتطبيق «مُخطّطي» (SETUP.md)

التطبيق بيشتغل محلياً 100% من غير أي إعدادات خارجية. لو حابب تنشره على الإنترنت أو تفعّل تسجيل الدخول بجوجل والمزامنة السحابية وتقرير الإيميل اليومي، امشي على الخطوات دي بالترتيب:

---

## 1) النشر على Vercel (Static — من غير Build)

1. ارفع فولدر المشروع كامل بجميع فولدراته الفرعية (`css/`, `js/`, `assets/`, `icons/`, ...) على مستودع GitHub خاص بيك.
   > ⚠️ **تنبيه مهم جداً:** رفع الملفات من الموبايل مباشرة على موقع GitHub بيسطّح الفولدرات (بيحط الملفات كلها جنب بعض من غير فولدرات)، وده هيخلي التطبيق ميشتغلش! استخدم `git push` أو اسحب الفولدر كامل من اللاب توب (Drag & Drop).
2. ادخل على [Vercel](https://vercel.com) واعمل **Add New Project** واختار المستودع.
3. في إعدادات المشروع:
   - **Framework Preset:** اختار `Other`
   - **Build Command:** سيبه فاضي
   - **Output Directory:** سيبه فاضي (أو `.`)
4. اضغط **Deploy**. في ثواني هيبقى عندك رابط شغال مثل `https://mukhattati.vercel.app`.

---

## 2) إعداد قاعدة بيانات Supabase

1. اعمل مشروع جديد مجاني على [Supabase](https://supabase.com).
   > 💡 **ملاحظة:** الخطة المجانية في Supabase بتتوقف مؤقتاً (Pause) بعد فترة من عدم الاستخدام (حوالي أسبوع بدون نشاط)، وتقدر تصحّيها بضغطة واحدة من لوحة تحكم Supabase.
2. من القائمة الجانبية افتح **SQL Editor** ← اضغط **New query**.
3. انسخ كل محتوى ملف `supabase/schema.sql` والصقه في المحرر واضغط **Run**.
   - ده هينشئ جدول `public.records` الموحّد، ويفعّل سياسات الحماية **RLS**، والـ Trigger `records_guard`.
4. من **Project Settings** ← **API**:
   - انسخ **Project URL** (لازم يكون الجذر فقط مثل `https://<REF>.supabase.co` من غير `/rest/v1/`).
   - انسخ مفتاح **`anon` `public`** فقط.
   > 🔒 **تحذير أمني:** ممنوع نهائياً تحط مفتاح `service_role` السري في `config.js` أو أي ملف في المتصفح!
5. افتح ملف `config.js` وحط القيمتين:
   ```js
   export const SUPABASE_URL = 'https://<REF>.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJhbGciOi...';
   ```

---

## 3) تفعيل تسجيل الدخول بحساب جوجل (Google OAuth)

1. افتح [Google Cloud Console](https://console.cloud.google.com/) واعمل مشروع جديد.
2. من **APIs & Services** ← **OAuth consent screen**:
   - اضبط اسم التطبيق «مُخطّطي».
   - **مهم:** إما تضغط **Publish App** عشان يشتغل لأي إيميل جوجل، أو لو سبته في وضع Testing لازم تضيف إيميلك في قائمة **Test users**.
3. من **Credentials** ← **Create Credentials** ← **OAuth client ID** (النوع: Web application):
   - في خانة **Authorized redirect URIs** حط الرابط ده بالظبط:
     ```
     https://<REF>.supabase.co/auth/v1/callback
     ```
   - انسخ الـ **Client ID** والـ **Client Secret**.
4. ارجع للوحة تحكم Supabase ← **Authentication** ← **Providers** ← **Google**:
   - فعّل Google وحط الـ Client ID والـ Client Secret واضغط Save.
5. من **Authentication** ← **URL Configuration** في Supabase:
   - اضبط **Site URL** على رابط موقعك في Vercel (مثلاً `https://mukhattati.vercel.app`).
   - في **Redirect URLs** ضيف نفس رابط Vercel (ومعاه `http://localhost:8123` لو بتجرّب محلياً).

---

## 4) إعداد التقرير اليومي بالإيميل (Resend + Edge Function + Cron)

1. اعمل حساب مجاني على [Resend](https://resend.com) وانسخ مفتاح **API Key** (`re_...`).
   > ⚠️ **ملاحظة مهمة بخصوص Resend:** من غير دومين متوثّق (Verified Domain)، حساب Resend المجاني بيبعت إيميلات **لإيميل صاحب حساب Resend نفسه بس**. لو عايز تبعت لأي مستخدم تاني، وثّق دومينك في Resend وحط عنوان الإرسال في متغير `REPORT_FROM`.
2. ثبّت Supabase CLI وسجّل دخولك واربط المشروع، ثم ارفع دالة `daily-report`:
   ```bash
   supabase functions deploy daily-report --no-verify-jwt
   ```
3. اضبط الأسرار الخاصة بالدالة:
   ```bash
   supabase secrets set RESEND_API_KEY=re_xxxxxxxxx CRON_SECRET=my_super_secret_cron_key
   # اختياري لو عندك دومين متوثق:
   supabase secrets set REPORT_FROM="Mukhattati <report@yourdomain.com>"
   ```
4. لتشغيل الإرسال التلقائي كل 10 دقائق، افتح **SQL Editor** في Supabase وشغّل كود `pg_cron` و `pg_net` الموجود في آخر ملف `supabase/schema.sql` بعد استبدال `<PROJECT_REF>` و `<YOUR_CRON_SECRET>`.
