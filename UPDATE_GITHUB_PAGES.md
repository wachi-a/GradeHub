# อัปเดต Gradeculator v1.8 บน GitHub Pages

ใช้ Repository: `https://github.com/wachi-a/GradeHub` (Branch `main`)

## ก่อนอัปเดต

1. เปิดเว็บไซต์ Gradeculator เดิมใน Chrome ปกติ แล้วกด **Export JSON** สำรองเกรดไว้ในเครื่องก่อน
2. ถ้าตั้งค่า Login/Supabase ไว้แล้ว ควรตรวจว่าไม่มีข้อความซิงก์ค้างหรือ Offline ก่อนเปลี่ยนเวอร์ชัน
3. อย่าอัปโหลดไฟล์ JSON คะแนนส่วนตัว, `.env`, รหัสลับ หรือ `node_modules` ขึ้น GitHub

## วิธีอัปเดต

1. แตกไฟล์ `Gradeculator-Mobile-v1.8-Calculator.zip`
2. เข้าโฟลเดอร์ `Gradeculator-Mobile` ภายใน ZIP
3. นำไฟล์ใหม่เข้า Repository GitHub **ที่ระดับราก** โดยให้ `src` เป็นโฟลเดอร์ที่อยู่ข้าง `index.html` และ `package.json` (ไม่ซ้อน `Gradeculator-Mobile` อีกชั้น)
4. ถ้าใช้อัปโหลดผ่านหน้าเว็บ GitHub ให้ `Add file > Upload files` แล้วลากเนื้อหาในโฟลเดอร์เข้ามา / Commit changes; หรือใช้ GitHub Desktop Push ได้
5. ไปแท็บ **Actions** ดู `Deploy Gradeculator` ให้ขึ้นเครื่องหมายถูกสีเขียว (ไฟล์ workflow มีอยู่แล้ว ไม่ต้องสร้างใหม่)
6. เปิด `https://wachi-a.github.io/GradeHub/` แล้วกด `Ctrl+Shift+R` ถ้าเห็น UI เก่าจากแคช
7. ตรวจเมนูด้านบนว่าเป็น **Calculator** และที่ท้ายเว็บขึ้น `v1.8.0`

## ทดสอบ Calculator

1. กรอก `Calculus` 3 หน่วยกิต คะแนน `80` ได้เกรด A (4.0)
2. เพิ่มวิชา `OOP` 3 หน่วยกิต คะแนน `75` ได้เกรด B+ (3.5)
3. GPA ทดลองควรเป็น `(3×4.0 + 3×3.5) / 6 = 3.75`
4. เปลี่ยนหน้าแล้วกลับมา Calculator ข้อมูลสองวิชาต้องยังอยู่
5. รีเฟรชหน้าเว็บแล้วข้อมูลยังอยู่
6. กดล้างข้อมูล แล้วรายการทดลองจะกลับไปว่าง แต่ Dashboard/Courses ต้องไม่เปลี่ยน
7. ถ้าเปิด Login/Supabase ไว้ ให้ตรวจว่าแสดงสถานะซิงก์สำเร็จก่อนทดลอง Login อีกเครื่อง

## เรื่อง Login / Cloud

- โค้ด `v1.8` รองรับบัญชีจาก `v1.7` เหมือนเดิม
- ถ้ายังไม่ได้ตั้งค่า Supabase ระบบ Guest จะทำงานได้ทันที แต่ **ยังไม่มีระบบซิงก์ข้ามเครื่องจนกว่าจะตั้ง Supabase**
- หากใช้ `.github/workflows/deploy.yml` ที่แนบมา ให้ตั้ง Repository Variables `VITE_SUPABASE_URL` และ `VITE_SUPABASE_PUBLISHABLE_KEY` ก่อน Deploy เพื่อเปิด Login จริง (รายละเอียดอยู่ใน `SETUP_LOGIN.md`)

## การกู้คืน

ถ้าเกิดปัญหา ใช้ปุ่ม Import JSON เพื่อนำข้อมูลสำรองจากก่อนอัปเดตกลับมา โดยโปรดอ่านคำเตือนการเขียนทับข้อมูลก่อนกดยืนยัน
