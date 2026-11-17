# GradeHub — Google Login และการเชื่อมบัญชีเดิม

GradeHub รองรับ **Google OAuth ในแท็บเบราว์เซอร์เดิม** ผ่าน Supabase Auth โดยยังคง Login ด้วยอีเมล/รหัสผ่าน และ Guest ตามเดิม ไม่ต้องตั้ง Custom SMTP สำหรับ Google OAuth

## 1. ตั้งค่า Google Cloud

1. เปิด https://console.cloud.google.com/ และสร้างหรือเลือก Project (เช่น GradeHub)
2. เข้า Google Auth Platform → Branding ตั้งชื่อแอป GradeHub และอีเมลติดต่อ
3. เข้า Audience เลือก **External** หากทดสอบสถานะ Testing ให้เพิ่มบัญชี Gmail ที่จะทดลองใน Test users
4. เข้า Clients → Create client → OAuth client ID → **Web application**
5. Authorized JavaScript origins: `https://wachi-a.github.io` (ห้ามใส่ /GradeHub/)
6. Authorized redirect URIs: คัดลอก URL ที่ Supabase แสดงใน Authentication → Sign In / Providers → Google ซึ่งลงท้ายด้วย `/auth/v1/callback` (นี่คือ callback ฝั่ง Supabase ไม่ใช่ GitHub Pages)
7. สร้าง Client ID และ Client Secret **ห้ามนำ Client Secret ลง GitHub, โค้ด Frontend หรือแชท**

## 2. ตั้งค่า Supabase

1. Supabase → GradeHub → Authentication → Sign In / Providers → Google → Enable
2. วาง **Google Client ID** และ **Google Client Secret** จาก Google Cloud ในหน้าตั้งค่าผู้ให้บริการ Google ของ Supabase แล้ว Save
3. Authentication → URL Configuration:
   - Site URL: `https://wachi-a.github.io/GradeHub/`
   - Redirect URLs: `https://wachi-a.github.io/GradeHub/`
4. หากต้องการเชื่อม **บัญชีเดิมที่ใช้อีเมลคนละอันกับ Google** ให้เปิด **Allow manual linking** ใน Authentication → General Configuration / Settings (ชื่อเมนูอาจต่างกันตาม UI)

## 3. ทดสอบแบบรักษาข้อมูลเดิม

- **มีบัญชี Email/Password ที่มีคะแนนอยู่แล้ว:** สำรอง JSON ก่อน → Login ด้วย Email/Password เดิม → รอแสดงสถานะ **ซิงก์แล้ว** → กด **เชื่อม Google** ที่แถบบัญชี → เลือก Google → กลับหน้า GradeHub แล้วตรวจปี/เทอม/วิชา/คะแนนเดิม → Logout → ทดลอง Google Login
- **ผู้ใช้ใหม่:** เลือก **เข้าสู่ระบบด้วย Google** จากหน้า Login → เลือกบัญชี Google → กลับเข้า GradeHub และเริ่มใช้งาน
- **Guest:** กด Google Login จากอุปกรณ์ที่มี Guest ระบบย้ายคะแนนเข้าบัญชีตามกลไกเดิม โดยล้าง Guest เฉพาะหลัง Supabase ยืนยันการบันทึกสำเร็จ
- Supabase สามารถเชื่อม Google กับบัญชีที่ใช้อีเมลเดียวกันและยืนยันแล้วโดยอัตโนมัติได้ แต่ **บัญชี Google ต่างอีเมลต้องเชื่อมจากบัญชีเดิมก่อน** มิฉะนั้นอาจกลายเป็น User ID คนละราย ไม่ใช่ข้อมูลคะแนนเดิม
- หากยังอยู่ใน Google Auth Platform Testing ให้เพิ่มอีเมลใน Test users ก่อนทดลอง

## ข้อควรระวัง

- ไม่ต้องแก้ `.env.local` หรือ Repository Variables ของ Supabase สำหรับ Google OAuth เพราะ Google Client Secret อยู่ใน Supabase Provider Settings เท่านั้น
- การ Login ของเว็บบน GitHub Pages เป็น redirect ในแท็บเดิม ไม่ใช่ Popup แต่กรณี APK / WebView ในอนาคตต้องตั้งค่า Native OAuth/Deep Link เพิ่ม
- หาก Supabase แจ้ง `provider is not enabled` ให้ตรวจ Google Provider และ Client ID/Secret; หาก Google แจ้ง `redirect_uri_mismatch` ให้เทียบ Callback URL ที่ Google Cloud กับ Supabase ให้ตรงกันทุกตัวอักษร
