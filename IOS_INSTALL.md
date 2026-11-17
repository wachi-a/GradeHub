# ติดตั้ง Gradeculator บน iPhone และ iPad

Gradeculator เป็น Web App (PWA) ที่เพิ่มลงหน้าจอโฮมได้ ไม่ใช่แอป App Store และไม่ต้องติดตั้ง .ipa

## iPhone (Safari)

1. เปิด Safari บน iPhone (ไม่ใช่หน้าดูเว็บในแอปอื่น)
2. เข้า https://wachi-a.github.io/GradeHub/
3. แตะปุ่มแชร์ (สี่เหลี่ยมมีลูกศรขึ้น) หรือเมนูหน้าเว็บ > Share
4. เลือก **Add to Home Screen / เพิ่มไปยังหน้าจอโฮม**
5. หากมีตัวเลือก **Open as Web App / เปิดเป็นเว็บแอป** ให้เปิด แล้วกด **Add / เพิ่ม**
6. กลับหน้าโฮมแล้วแตะไอคอน Gradeculator เพื่อใช้งาน

## iPad

เปิดเว็บไซต์ใน Safari บน iPad → Share → Add to Home Screen แล้วเพิ่ม Gradeculator ได้เหมือนกัน

## ข้อควรทราบเกี่ยวกับคะแนนเดิม

- การติดตั้งเป็น Web App **ไม่ย้าย LocalStorage จาก Safari โดยอัตโนมัติ** ข้อมูล Guest ใน Safari และในเว็บแอปที่ติดตั้งอาจเป็นคนละชุด
- หากมีข้อมูลคะแนน Guest เดิม ให้ **Export JSON** สำรองไว้ก่อน และควร Login กับบัญชี Supabase ที่ซิงก์คะแนนแล้วเมื่อเปิดเว็บแอปบน iPhone
- หากจะใช้ Guest อย่างเดียว สามารถ Import JSON กลับในเว็บแอปที่ติดตั้งได้
- การใช้งานและการซิงก์ออนไลน์ต้องมีอินเทอร์เน็ตตามปกติ ไม่มีการรับประกันว่าเว็บไซต์ทั้งหมดใช้งานออฟไลน์ได้
- Login with Google บน iOS อาจสลับไปหน้า Safari/Google เพื่อยืนยันตัวตน หากเกิดปัญหาการกลับเข้าแอป ให้ Login จาก Safari ก่อนและตรวจการตั้งค่า OAuth Redirect ของ Supabase
- ฟอร์ม Login ใน Gradeculator ล้างอีเมลและรหัสผ่านเมื่อปิดและเปิดใหม่ พร้อมลดการกรอกอัตโนมัติ แต่ Chrome, Safari และ Password Manager สามารถจัดการข้อมูลเข้าสู่ระบบที่เคยบันทึกไว้เองได้ และอาจไม่เคารพ `autocomplete="off"` ต้องไปลบข้อมูลล็อกอินที่บันทึกในเบราว์เซอร์หากไม่ต้องการให้เสนอกรอกข้อมูลอีก

## สำหรับผู้พัฒนา

- `public/manifest.webmanifest` มี `display: standalone` และ `start_url: /GradeHub/`
- `index.html` ตั้งค่า `apple-touch-icon`, `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, `apple-mobile-web-app-status-bar-style`
- ใช้โลโก้ Gradeculator เดิมเป็นไอคอน iOS
