/* ══ ❓ askConfirm — กล่องยืนยันในแอป แทน `window.confirm` ทั้งระบบ (2026-11-18 · audit กฎ UX: native confirm 58 จุดที่กดถึง / 234 จุดในโค้ด) ═══
   ทำไม: `window.confirm` = หน้าตาเบราว์เซอร์ (ไม่ตามธีม · ไม่หรี่ฉากหลัง · ไม่แปลภาษา · บน iPhone เป็นกล่องเล็กกลางจอ
   ตัดข้อความยาว) และบล็อก thread · กล่องในแอปใช้ม่าน `--scrim` + `.modal` เดียวกับ modal อื่น ⇒ ทั้งระบบดูเป็นชุดเดียว

   ใช้:  const ok = await askConfirm('ลบรายการนี้?');            // ข้อความอย่างเดียว (บรรทัดแรก = หัวเรื่อง)
         const ok = await askConfirm({ title, message, okLabel: 'ลบ', danger: true });
   · คืน Promise<boolean> เสมอ ⇒ ฟังก์ชันที่เรียกต้องเป็น async (codemod 18/11 ใส่ให้แล้ว)
   · ตัววาดจริง = `<ConfirmHost/>` ที่ App root (ตัวเดียว · ของกลาง) — ไม่มี host (เทส/SSR/harness ชิ้นเดี่ยว) = ถอยไป window.confirm
     ไม่มีทั้งคู่ = คืน true (ไม่ขวางงาน เหมือน confirmSign เดิม)
   · ข้อความยืนยัน "เซ็น/อนุมัติ" ยังต้องประกอบผ่าน `signConfirm.js` (บอกครบ 3 อย่าง) — ตัวนี้เป็นแค่ "กล่อง"
   🔴 กฎ: ห้ามเรียก `window.confirm` ตรงๆ ในหน้า/คอมโพเนนต์ (ด่าน `no-native-confirm`) · อยากถามยืนยัน = askConfirm
   ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════ */

let host = null;   // (opts) => Promise<boolean> — ตั้งโดย <ConfirmHost/>

/** ConfirmHost เรียกตอน mount/unmount เท่านั้น */
export function registerConfirmHost(fn) { host = typeof fn === 'function' ? fn : null; return () => { if (host === fn) host = null; }; }

/** มี host ติดตั้งอยู่ไหม (เทส/ตรวจ) */
export const hasConfirmHost = () => !!host;

/** แปลง argument เป็น options มาตรฐาน — บรรทัดแรกของข้อความ = หัวเรื่อง (ข้อความเดิมของระบบเขียนแบบนี้อยู่แล้ว) */
export function normalizeConfirm(arg) {
  const o = (arg && typeof arg === 'object') ? { ...arg } : { message: arg == null ? '' : String(arg) };
  const msg = String(o.message ?? '');
  if (!o.title) {
    const nl = msg.indexOf('\n');
    if (nl > 0 && nl <= 80) { o.title = msg.slice(0, nl).trim(); o.message = msg.slice(nl + 1).replace(/^\n+/, ''); }
    else if (msg.length <= 80) { o.title = msg.trim(); o.message = ''; }
    else o.title = 'ยืนยัน';
  }
  o.okLabel = o.okLabel || 'ตกลง';
  o.cancelLabel = o.cancelLabel || 'ยกเลิก';
  o.danger = !!o.danger || /ลบ|ปลดระวาง|ปิดใช้|ยกเลิก|โมฆะ|ออกจากระบบ/.test(o.title + ' ' + o.okLabel);
  return o;
}

export async function askConfirm(arg) {
  const o = normalizeConfirm(arg);
  if (host) return !!(await host(o));
  if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
    return window.confirm([o.title, o.message].filter(Boolean).join('\n\n'));
  }
  return true;
}
