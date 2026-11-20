/* ═══ ☼ ☾ ไอคอนกะ — เส้นโมโนโครม ไม่ใช่อีโมจิ                        (2026-11-17 · คำสั่ง user)
   ที่มา: หน้างานขอ *"ไอคอน พระจันและพระอาทิต เหมือนเดิม"* เพราะการ์ดกะในแถบซ้ายอ่านไม่ออกว่า
   ใบไหนกะกลางวัน/กลางคืน (ข้อความ 11px สีจาง) — แต่รอบก่อนถอดอีโมจิออกเพื่อความ premium/official
   ⇒ ทางออก: ไอคอน **เส้น SVG สีเดียวกับข้อความ** (`currentColor`) = เป็นส่วนหนึ่งของตัวอักษร
     แยกกะได้ด้วย "รูปทรง" ไม่ใช่ด้วยสี ⇒ ไม่เพิ่มสีใหม่บนจอ ไม่รก

   🔴 กฎ: ลิสต์/การ์ดที่บอก "กะเช้า/กะดึก" ใช้ตัวนี้ **ห้ามพิมพ์อีโมจิ ☀️/🌙 ลงไปเอง**
      (อีโมจิวาดด้วยฟอนต์สีของระบบ = คุมสีไม่ได้ + หน้าตาต่างกันทุก OS)
   · `shift` ที่ไม่รู้จัก = ไม่วาดอะไร (คืน null) — ห้ามเดาว่าเป็นกะเช้า
   · ตัวไอคอนเป็น `aria-hidden` เสมอ เพราะข้างๆ มีคำว่า "กะเช้า/กะดึก" อ่านออกอยู่แล้ว
   📄 docs/UI-CONVENTIONS.md §6.41 */

/** ขนาดเริ่มต้น = เท่าความสูงตัวอักษร 11-12px ของชิปในลิสต์ (กฎฟอนต์ขั้นต่ำ 11px) */
const DEFAULT_SIZE = 13;

export default function ShiftGlyph({ shift, size = DEFAULT_SIZE, style, title }) {
  const isDay = shift === 'day';
  const isNight = shift === 'night';
  if (!isDay && !isNight) return null;           // ไม่รู้จัก = ไม่วาด (ห้ามเดา)
  const common = {
    width: size, height: size, viewBox: '0 0 16 16', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round',
    'aria-hidden': true, focusable: 'false',
    style: { flexShrink: 0, display: 'block', ...style },
  };
  return isDay ? (
    <svg {...common}>
      {title && <title>{title}</title>}
      <circle cx="8" cy="8" r="3.2" />
      <path d="M13.40 8.00L15.20 8.00" />
      <path d="M11.82 11.82L13.09 13.09" />
      <path d="M8.00 13.40L8.00 15.20" />
      <path d="M4.18 11.82L2.91 13.09" />
      <path d="M2.60 8.00L0.80 8.00" />
      <path d="M4.18 4.18L2.91 2.91" />
      <path d="M8.00 2.60L8.00 0.80" />
      <path d="M11.82 4.18L13.09 2.91" />
    </svg>
  ) : (
    <svg {...common}>
      {title && <title>{title}</title>}
      {/* เสี้ยวจันทร์: วงกลมใหญ่ถูกวงกลมเล็กกัดจากขวาบน — เส้นเดียวจบ อ่านออกตั้งแต่ 12px */}
      <path d="M13.2 10.3A5.6 5.6 0 0 1 5.7 2.8a5.6 5.6 0 1 0 7.5 7.5z" />
    </svg>
  );
}
