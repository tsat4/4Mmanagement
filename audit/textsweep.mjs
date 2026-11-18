/* 📝 textsweep — หา "กำแพงข้อความ" บนจอจริง (UI-CONVENTIONS §6.10 · 2026-11-04 · คำสั่ง user
   "text เขียนอธิบายเยอะๆ ควรเป็น tooltip โชว์ตอนลากไปดู หรืออยากจะดู ไม่ใช่ text เยอะๆ")
   เรนเดอร์ทุกหน้าใน src/pages (+ Home ผ่าน hub.html) ที่ 1500px แล้วลิสต์โหนดข้อความที่ยาว ≥ LEN ตัวอักษร
   ซึ่ง **ไม่ได้** อยู่ใน: ปุ่ม/ช่องกรอก/ตาราง · <NoticeBar> · WarnNote (data-warn) · กล่อง ⓘ ที่กางอยู่ (data-infomore)
   ⇒ ที่เหลือ = คำอธิบายที่ควรย้ายไปหลัง <InfoMore> หรือ title= (tooltip)
   รัน: npx vite --config audit/vite.audit.mjs (ค้างไว้) แล้ว  node audit/textsweep.mjs   · ONLY=DailyReport,Obeya&tab=kpi · LEN=120 */
import { chromium } from 'playwright';
const LEN = Number(process.env.LEN || 120);
const DASH = Number(process.env.DASH || 70);   // กฎ 2: บรรทัด "สถานะ — อธิบาย" ยาว ≥ 70 ตัว (ครึ่งบรรทัด) = อธิบายควรอยู่หลัง <Why>   // 120 ≈ 1 บรรทัดเต็มที่ 1500px (คำอธิบายใต้หัวเพจ ~100 ตัวอักษร ยังผ่าน)
const ONLY = (process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

/* 🔕 หน้าที่ "เนื้อหาคือคำบรรยาย" — ด่านนี้ไม่ใช้ (2026-11-18 · ไล่ของจริงแล้วพบว่าร้องผิดทุกจุด)
   เหตุผลรายตัว — ห้ามใส่เพิ่มเพราะ "แก้ไม่ทัน" ต้องเป็นหน้าที่ข้อความ **คือสิ่งที่คนมาอ่าน** จริงๆ:
     AdoptionOutlook  🔮 ภาพเมื่อข้อมูลเชื่อมกันทั้งองค์กร — "เปิดในห้องประชุมแทนสไลด์" (docs/modules/
                      adoption-outlook.md) · user เคยตีกลับรอบแรกเพราะทำเป็นรายงานตัวเลขแล้ว "ไม่ตรงโจทย์"
                      ⇒ พับข้อความ = ฆ่าหน้านี้ทิ้ง
     __hub · DeptHub  หน้าเมนู/หน้าเลือกส่วนงาน — บรรทัดบรรยายใต้แต่ละหมวดคือ**ตัวช่วยเลือกทาง**
                      ไม่ใช่คำอธิบายที่มาบังของ (ซ่อนแล้วเหลือแต่ชื่อหมวดลอยๆ)
   🔴 ยกเว้นเฉพาะ "กฎ 1 (ข้อความยาว)" — **กฎ 2 (สถานะ — อธิบาย) ยังตรวจอยู่** เพราะบรรทัดสถานะ
      ที่ยาวเกินครึ่งบรรทัดเป็นปัญหาได้ทุกหน้า ไม่ว่าหน้านั้นจะเป็นหน้าอ่านหรือไม่ */
const READING_PAGES = new Set(['AdoptionOutlook', '__hub', 'DeptHub']);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const p0 = await b.newPage(); await p0.goto('http://localhost:5199/audit/index.html'); await p0.waitForTimeout(1200);
const PAGES = ONLY.length ? ONLY : [...await p0.evaluate(() => window.__PAGES), '__hub'];
await p0.close();
let total = 0; let dashTotal = 0;
for (const name of PAGES) {
  const url = name === '__hub' ? 'http://localhost:5199/audit/hub.html?role=admin' : `http://localhost:5199/audit/index.html?p=${name}&role=admin`;
  const pg = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const reading = READING_PAGES.has(name);
  try {
    await pg.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); await pg.waitForTimeout(1200);
    const rows = await pg.evaluate(([LEN, DASH]) => {
      const out = []; const seen = new Set();
      for (const el of document.querySelectorAll('div,span,p,li,small,label')) {
        if (el.children.length > 2) continue;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim(); if (t.length < LEN) continue;
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        if (el.closest('button,select,input,textarea,table,.notice-bar,[data-warn],[data-infomore],[role=status]')) continue;
        if ([...el.children].some(c => (c.innerText || '').trim().length > 60)) continue;
        const key = t.slice(0, 60); if (seen.has(key)) continue; seen.add(key);
        out.push({ len: t.length, y: Math.round(r.top + window.scrollY), text: t.slice(0, 120) });
      }
      /* กฎ 2 (05/11 · user: "text ที่เป็น comment ต้องเป็น tooltip"): บรรทัด "สถานะ — คำอธิบาย/วิธีแก้" ที่ยาว ≥ DASH ตัว
         บนจอ = คำอธิบายควรไปอยู่ใน <Why> (tooltip + กดเปิด) เหลือแค่สถานะ · ข้ามของที่สั้นหรืออยู่ในที่ยกเว้นเดิม */
      for (const el of document.querySelectorAll('div,span,p,li,small,label')) {
        if (el.children.length > 3) continue;
        const t = (el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t.length < DASH || t.length >= LEN || !/ — /.test(t)) continue;
        const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
        if (el.closest('button,select,input,textarea,table,.notice-bar,[data-warn],[data-infomore],[role=status],h1,h2,h3')) continue;
        if ([...el.children].some(c => (c.innerText || '').trim().length > 40)) continue;
        const key = 'd:' + t.slice(0, 60); if (seen.has(key)) continue; seen.add(key);
        out.push({ len: t.length, y: Math.round(r.top + window.scrollY), text: '— ' + t.slice(0, 118) });
      }
      return out.sort((a, b) => a.y - b.y);
    }, [LEN, DASH]);
    /* หน้าอ่าน: นับเฉพาะกฎ 2 (บรรทัด "สถานะ — อธิบาย") · กฎ 1 ข้อความยาวคือเนื้อหาของหน้า */
    const shown = reading ? rows.filter(r => r.text.startsWith('— ')) : rows;
    if (shown.length) {
      console.log(`\n🔴 ${name}: ${shown.length} ก้อน${reading ? '  (หน้าอ่าน — นับเฉพาะกฎ 2)' : ''}`);
      for (const r of shown) console.log(`   y=${r.y} len=${r.len} | ${r.text}`);
      const d = shown.filter(r => r.text.startsWith('— ')).length; dashTotal += d; total += shown.length - d;
    } else console.log(`✅ ${name}${reading ? '  (หน้าอ่าน)' : ''}`);
  } catch (e) { console.log(`⚠️ ${name}: ${e.message.slice(0, 80)}`); }
  await pg.close();
}
await b.close();
console.log(`\nรวม ${total} ก้อนข้อความ ≥ ${LEN} ตัวอักษรที่ยังไม่ได้พับ · กฎ 2: ${dashTotal} บรรทัด "สถานะ — อธิบาย" ≥ ${DASH} ตัว (ย้ายคำอธิบายไป <Why> · ข้อความที่คนกรอกเองไม่นับ)`);
