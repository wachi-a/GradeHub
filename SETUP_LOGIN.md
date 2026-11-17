# GradeHub v1.7 — วิธีเปิด Login + Cloud Sync

โค้ดเวอร์ชันนี้มีระบบ Guest / Login แล้ว แต่ **ต้องเชื่อมต่อ Supabase Project ของตัวเองก่อน จึงจะล็อกอินและซิงก์ข้อมูลได้จริง**. GitHub Pages ให้บริการหน้าเว็บเท่านั้น ไม่ใช่ฐานข้อมูลออนไลน์

## A. สำรองข้อมูลเดิมก่อน

1. เปิด GradeHub v1.6.2 ในเบราว์เซอร์ที่มีคะแนนอยู่
2. กดไอคอนดาวน์โหลด JSON เพื่อสำรองคะแนน
3. เก็บ JSON ไว้นอกโฟลเดอร์ที่อัปโหลดขึ้น GitHub และไม่ส่งไฟล์คะแนนส่วนตัวเข้าที่เก็บโค้ดแบบ Public

## B. สร้าง Supabase Project

1. ไปที่ https://supabase.com/ และลงชื่อเข้าใช้ตามข้อกำหนดของบริการ
2. สร้าง Project ใหม่ เช่น `GradeHub`; ตั้งรหัสผ่านฐานข้อมูลที่ปลอดภัยและเก็บไว้เป็นส่วนตัว
3. ไปที่ **SQL Editor** แล้วเปิดไฟล์ `supabase/schema.sql` ใน ZIP นี้ คัดลอก SQL ทั้งหมดไปรันครั้งเดียว เพื่อสร้างตาราง `public.gradehub_documents` และ RLS
4. ตรวจที่ Database > Tables ว่า `gradehub_documents` มี RLS เปิดอยู่
5. ไปที่ **Authentication > Providers > Email** เปิด Email provider และเลือก Require email confirmation ตามที่ต้องการ (แนะนำให้เปิด)
6. ไปที่ **Authentication > URL Configuration**:
   - Site URL: `https://wachi-a.github.io/GradeHub/`
   - Redirect URLs: เพิ่ม `https://wachi-a.github.io/GradeHub/`
   - สำหรับทดสอบในคอม เพิ่ม `http://127.0.0.1:5173/`

> หากต้องการ Login ด้วย Google ในอนาคต ต้องตั้ง Google OAuth เพิ่มต่างหาก ไม่ได้เปิดให้อัตโนมัติในเวอร์ชันนี้

## C. เชื่อม Supabase บนคอม

1. ใน Supabase Dashboard ไปที่ **Project Settings > API** หรือเมนู API Keys เพื่อคัดลอก **Project URL** และ **publishable key** (`sb_publishable_...`; บางโปรเจกต์มี legacy anon key)
2. คัดลอกไฟล์ `.env.example` เป็น `.env.local` และแทนค่าตัวอย่าง:

   ```dotenv
   VITE_SUPABASE_URL=https://PROJECT_ID.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_KEY
   ```

3. ในโฟลเดอร์โปรเจกต์เรียก `npm install` แล้ว `npm run dev`
4. เปิด `http://127.0.0.1:5173/` และทดสอบสมัครสมาชิก / ยืนยันอีเมล / Login

**อย่าใส่ `service_role` หรือ `secret` key ใน .env.local, โค้ด frontend, GitHub repository หรือ GitHub Pages** ใช้เฉพาะ **publishable key** เท่านั้น เพราะเว็บหน้า Public จะมองเห็นค่านี้ผ่าน JavaScript bundle และความเป็นส่วนตัวขึ้นกับ Row Level Security (RLS)

## D. นำ v1.7 ขึ้น GitHub Pages ที่ wachi-a/GradeHub

1. อัปโหลดหรือ push โปรเจกต์ทั้งหมดจาก ZIP ขึ้น Repository เดิม โดยไม่ต้องอัปโหลด `node_modules`, `dist`, `.env.local`, และไฟล์ JSON คะแนนส่วนตัว
2. ให้อัปโหลดโฟลเดอร์ `.github/workflows/deploy.yml` ที่ให้มาด้วย หรือปรับ workflow เดิมให้มีตัวแปร Environment ที่ขั้น `npm run build` ดังนี้:

   ```yaml
   env:
     VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
     VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
   ```

   Workflow ใน ZIP ใช้ `npm install` เพื่อให้สร้าง dependency `@supabase/supabase-js` ได้ แม้ไฟล์ lock ของเวอร์ชันก่อนยังไม่ถูกอัปเดต แนะนำให้รัน `npm install` บนคอม แล้ว commit `package-lock.json` ที่ได้เพื่อให้ build ทำซ้ำได้สม่ำเสมอ

3. ใน GitHub Repository ไปที่ **Settings > Secrets and variables > Actions > Variables** แล้วเพิ่ม **Repository variables**:
   - `VITE_SUPABASE_URL` = URL ของ Supabase Project
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Supabase publishable key
4. ไปที่ **Settings > Pages > Build and deployment** เลือก `GitHub Actions`
5. ไปแท็บ **Actions > Deploy GradeHub > Run workflow > main > Run workflow** หรือ push commit ใหม่
6. เมื่อ Workflow สำเร็จ เปิด https://wachi-a.github.io/GradeHub/ และทดสอบใหม่

> กรอกตัวแปรของ Supabase ใน GitHub ไม่ได้ทำให้ข้อมูลคะแนนไปอยู่ใน GitHub; คะแนนอยู่ในตาราง Supabase ที่มี RLS ส่วน GitHub ยังโฮสต์แค่ไฟล์เว็บ

## E. การบันทึกข้อมูลทำงานอย่างไร (Guest → Login อัตโนมัติ)

| โหมด | จัดเก็บ | การใช้ข้ามเครื่อง |
| --- | --- | --- |
| Guest | LocalStorage ของเบราว์เซอร์เดิม (key `gradehub.mobile.v1`) | ไม่ซิงก์; ย้ายด้วย Export/Import JSON |
| Login | Supabase + สำเนาแยกตาม user ID ในเครื่อง | เว็บและแอปมือถือใช้ข้อมูลออนไลน์ชุดเดียวกัน |

1. ใช้ **Guest** เพิ่มปี/เทอม/วิชา/คะแนนได้ทันทีโดยไม่ต้องสมัครสมาชิก
2. เมื่อกด Login หรือสมัครสมาชิกสำเร็จและยืนยันอีเมล (ถ้าระบบกำหนด) ระบบจะตรวจข้อมูล Guest ในเครื่องนั้น
3. **ถ้ามี Guest** ระบบจะดาวน์โหลดข้อมูลบัญชีเก่าจาก Supabase แล้ว **รวมเข้ากับ Guest โดยอัตโนมัติ** ตามปีและเทอม พร้อมรักษารายวิชาจากทั้งสองที่ไว้ รายวิชาที่มี ID เดียวกันเลือกการแก้ไขจาก Guest และเก็บคะแนนย่อยเก่าที่ไม่ซ้ำไว้ด้วย
4. ระบบส่งข้อมูลที่รวมแล้วขึ้น Supabase และรอผลตอบรับ **สำเร็จจริง** จึงเก็บสำเนา Guest ที่ `gradehub.guest.migrated.backup.<user id>` และล้างเฉพาะข้อมูล Guest ที่กำลังใช้งาน เพื่อไม่ให้ถูกนำเข้าซ้ำตอน Login ครั้งถัดไป
5. จากนั้นระบบเปิด Dashboard แบบ Login ต่อทันที และเมื่อกด Logout จะกลับสู่ Guest ที่ว่าง/ข้อมูล Guest ใหม่ในเครื่องเดิม (ข้อมูลในบัญชียังออนไลน์อยู่)
6. ถ้าเครือข่ายหรือ Supabase ขัดข้องก่อนย้ายสำเร็จ ระบบ **ไม่ล้าง Guest** แต่แสดงข้อผิดพลาด พร้อมปุ่มลองใหม่ และกลับ Guest ได้
7. การแก้ไขในบัญชีออนไลน์จะเก็บสำเนาไว้ในเครื่องอย่างรวดเร็ว จากนั้นพยายามส่ง Supabase อัตโนมัติ สถานะ `ซิงก์แล้ว` หมายถึงบันทึกออนไลน์ได้; `ออฟไลน์` แปลว่ายังมีข้อมูลที่รอซิงก์
8. เพื่อเลี่ยงการเขียนทับจากสองเครื่อง ระบบตรวจ revision ของเอกสารก่อนเขียน และแจ้ง conflict ถ้าออนไลน์มีการแก้ไขจากอีกเครื่อง กรุณาสำรอง JSON ก่อนเลือกรุ่นข้อมูล

**หมายเหตุเรื่องข้อมูลซ้ำ:** ระบบจับคู่ปีและเทอมจากตัวเลข ส่วนวิชาจับคู่ด้วย ID หากเคยสร้างวิชาเดียวกัน *แยกจากกันคนละครั้ง* ในเว็บและ Guest อาจมีสองแถวชื่อเหมือนกันเพื่อรักษาข้อมูลทั้งคู่ไว้ ผู้ใช้ลบแถวซ้ำเองได้

**สำคัญ:** GitHub Pages เก็บแค่หน้าเว็บ ไม่ใช่ฐานข้อมูล คะแนนของบัญชีอยู่ใน Supabase ที่ตั้งค่า RLS, ไม่ใช่ใน GitHub Repository และข้อมูล Guest ก็ยังคงอยู่ในเครื่อง/เบราว์เซอร์นั้นเท่านั้น

## F. ข้อจำกัดของรุ่นนี้

- ยังไม่ได้ทดสอบจริงกับ Supabase Project ที่ตั้งค่าครบในเครื่องนี้ จึงต้องทดสอบ signup, confirm email, log in, save, reload และ log out บนเครื่องของคุณ
- ไม่ใช่การนำโค้ดไป Deploy บน Server ส่วนตัว; GitHub Pages ยังคงเป็น Static Hosting
- พัฒนาแอป APK ในภายหลังด้วย Capacitor ได้โดยใช้ Supabase Project เดิม และต้องเพิ่ม Redirect URL สำหรับ Native App หรือ Deep Link หากใช้การยืนยันตัวตนแบบ Redirect
- เพื่อหลีกเลี่ยง conflict ให้ใช้อุปกรณ์หนึ่งแก้ไขในช่วงเวลาเดียวกัน และดูสถานะ `ซิงก์แล้ว` ก่อนย้ายไปอีกเครื่อง

## G. ยืนยันบัญชีด้วย OTP ในแท็บเดิม

เมื่อสมัครสมาชิก GradeHub จะเปิดหน้ากรอกรหัส OTP และสามารถกด **ส่งรหัสอีกครั้ง** ได้ หากต้องการใช้รหัสแทนลิงก์ยืนยัน ต้องตั้งค่า Supabase ให้ส่งรหัสในอีเมลด้วย:

1. Supabase Dashboard → **Authentication → Email Templates → Confirm signup**
2. แก้ **Subject** เป็น `GradeHub - รหัสยืนยันอีเมล`
3. เปลี่ยนเนื้อหา **Body** เป็น HTML ด้านล่างแล้วกด Save (ใช้ `{{ .Token }}` ตามตัวพิมพ์และเว้นวรรคให้ตรง):

```html
<h2>ยืนยันอีเมล GradeHub</h2>
<p>กรอกรหัสนี้ในหน้า GradeHub ที่เปิดค้างไว้:</p>
<h1 style="font-size:32px;letter-spacing:6px">{{ .Token }}</h1>
<p>หากไม่ได้สมัคร GradeHub สามารถเพิกเฉยต่อข้อความนี้ได้</p>
```

4. เปิด GradeHub ที่ `https://wachi-a.github.io/GradeHub/` → สมัครสมาชิกด้วยอีเมลใหม่
5. เปิดอีเมลอ่านรหัสและกลับไปแท็บ GradeHub เดิม → กรอกรหัส → กด **ยืนยันรหัส OTP**
6. เมื่อยืนยันสำเร็จ ระบบ Login/Cloud Sync เดิมจะเริ่มทำงาน และย้าย Guest อัตโนมัติตามขั้นตอน E

**หมายเหตุ:** การเปลี่ยนหน้า HTML ใน GitHub เพียงอย่างเดียวไม่เปลี่ยนเทมเพลตอีเมลของ Supabase ต้องตั้งค่าใน Dashboard ด้วย ไม่จำเป็นต้องสร้างฐานข้อมูลใหม่หรือแก้ SQL ส่วนลืมรหัสผ่านยังใช้ลิงก์เดิม หากไม่มีอีเมลใหม่/อีเมลไม่มาถึง ให้ดู Rate Limits และข้อจำกัดการส่งเมลของ Supabase
