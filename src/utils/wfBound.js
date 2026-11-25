/* ═══════════════════════════════════════════════════════════════════════════════
   e-Workflow โหมด "ผูกเอกสาร" (bound) — ของกลางฝั่งจอ (2026-11-25 · คำสั่ง user
   "ทุกเอกสาร issued/checked/approved คุมด้วย e-workflow" + "ความถี่การเซ็นแต่ละเอกสารต่างกัน")

   · การผูก = `flow_schema.binding = { subject, period, perShift }` ในเวอร์ชันของใบ (ตั้งที่ /workflow-designer)
   · 1 ใบ workflow = 1 "รอบ" ของเอกสาร (ไลน์ × ช่วงวัน × กะ) · ระบบเปิดเอง (`wf_bound_ensure` / ตัวสแกนรายวัน)
   🔴 ตรรกะ 2 ฝั่งต้องตรงกัน (มีเทส `wfBound.test.mjs`):
      `BOUND_SUBJECTS` ↔ `wf_bound_subjects()` · `wfPeriodRange()` ↔ `wf_period_range()` (migration 20261125b)
   Pure — ไม่แตะ supabase
   ═══════════════════════════════════════════════════════════════════════════════ */

/** เอกสารที่ผูกได้ — โปรแกรมเมอร์ลงทะเบียน (ต้องมีตัวล็อก/ตัวสแกนฝั่ง DB ด้วย) */
export const BOUND_SUBJECTS = Object.freeze([
  { subject: 'pokayoke', label: 'Poka-Yoke Check', recordPerm: 'pokayoke:record', link: '/daily-checker?tab=pokayoke' },
]);

export const PERIODS = Object.freeze([
  { period: 'day',     label: 'รายวัน' },
  { period: 'week',    label: 'รายสัปดาห์ (1-7 / 8-14 / 15-21 / 22-สิ้นเดือน)' },
  { period: 'month',   label: 'รายเดือน' },
  { period: 'quarter', label: 'รายไตรมาส' },
]);
export const PERIOD_LABEL = Object.fromEntries(PERIODS.map(p => [p.period, p.label]));

const pad2 = (n) => String(n).padStart(2, '0');
const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m = 1..12

/** ช่วงวันของรอบ `[from, to]` (YYYY-MM-DD) · แกะไม่ออก/ความถี่ไม่รู้จัก = null */
export function wfPeriodRange(period, dateStr) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr || ''));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], ym = `${y}-${pad2(mo)}`;
  if (period === 'day') return [dateStr, dateStr];
  if (period === 'week') {
    const w = Math.min(4, Math.ceil(d / 7));
    return [`${ym}-${pad2((w - 1) * 7 + 1)}`, `${ym}-${pad2(w === 4 ? dim(y, mo) : w * 7)}`];
  }
  if (period === 'month') return [`${ym}-01`, `${ym}-${pad2(dim(y, mo))}`];
  if (period === 'quarter') {
    const qs = Math.floor((mo - 1) / 3) * 3 + 1, qe = qs + 2;
    return [`${y}-${pad2(qs)}-01`, `${y}-${pad2(qe)}-${pad2(dim(y, qe))}`];
  }
  return null;
}

/** คีย์รอบ — ต้องตรงกับ `subject_key` ที่ `wf_bound_open()` สร้าง (`ไลน์|from|กะ`) */
export function roundKey(line, from, shift) {
  return `${String(line || '').trim()}|${from}|${shift || ''}`;
}

/** ตรวจค่าการผูกในหน้าออกแบบ — คืน [ข้อความ] (ว่าง = ผ่าน) · ตรงกับด่านใน `wf_request_publish` */
export function validateBinding(binding, steps = []) {
  if (!binding) return [];
  const errs = [];
  if (!BOUND_SUBJECTS.some(s => s.subject === binding.subject)) errs.push('ยังไม่ได้เลือกเอกสารที่ผูก');
  if (!PERIOD_LABEL[binding.period]) errs.push('ยังไม่ได้เลือกความถี่การเซ็น');
  steps.forEach((s, i) => {
    const r = s?.assignee?.rule;
    if (r === 'creator' || r === 'creator_head') errs.push(`ขั้นที่ ${i + 1}: ใบรอบเอกสารระบบเปิดเอง ไม่มีผู้เปิดใบ — ใช้ "ตามไลน์"/"ตามส่วนงาน"/"ระบุคน"`);
  });
  return errs;
}

/** สถานะของรอบสำหรับแสดงบนจอ (ไม่มีใบ ≠ ยังไม่เซ็น) */
export function roundState({ instance, ensureStatus, hasData } = {}) {
  if (instance) {
    if (instance.status === 'approved') return 'signed';
    if (instance.status === 'in_progress') return instance.blocked_reason ? 'blocked' : 'waiting';
    return 'closed';                      // rejected / revoked / cancelled — รอบใหม่เปิดได้
  }
  if (ensureStatus === 'period_open') return 'period_open';
  if (ensureStatus === 'not_active') return 'not_active';
  if (hasData === false) return 'no_data';
  return 'unknown';
}
