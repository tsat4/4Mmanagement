/* ══ 📋 accessReview — "ใบทบทวนสิทธิ์" ของ ESM (ISO 27001 A.5.18 · 2026-11-24 · คำสั่ง user) ══════════════
   ปัญหา: ISO 27001 A.5.18 บังคับให้ "ทบทวนสิทธิ์เป็นรอบ พร้อมหลักฐาน" (ใครตัดสินอะไร เมื่อไร)
   ESM มีวัตถุดิบครบอยู่แล้วแต่กระจาย (กองงานค้าง `userIssues.js` · เวลาเข้าใช้ `accountActivity.js` ·
   ค่าสิทธิ์รายคน `all_units`/`is_dept_admin`/`scope_depth`) ⇒ ไฟล์นี้รวมเป็น "1 แถวต่อบัญชี + ธงความเสี่ยง"
   ให้ export ออกเป็น Excel แล้วผู้ตรวจกรอกผล/ลงชื่อ/วันที่ (user เลือก 24/11: เก็บผลเป็นไฟล์ ไม่สร้างตารางใหม่)

   🔴 ไฟล์นี้ "ติดธง" เท่านั้น **ไม่ตัดสินแทนคน** — ห้ามเอาผลไปแก้ profiles อัตโนมัติ (ENGINEERING-PRINCIPLES §2)
   🔴 ตัวตัดสินแต่ละเรื่องยังเป็นของกลางเดิม — กองงานค้างมาจาก `buildUserIssues().byUser` ·
      สถานะเข้าใช้มาจาก `activityOf()` · **ห้ามเขียนเงื่อนไขซ้ำที่นี่**
   🔴 อ่านไม่ได้ ≠ ไม่มี: `last_sign_in_at === undefined` = "อ่านไม่ได้" (ไม่ใช่ "ไม่เคยเข้า") ·
      สถานะพนักงานที่อ่านไม่ได้ = `null` ⇒ ไม่ติดธงพ้นสภาพ แต่ติดธง "ตรวจสถานะพนักงานไม่ได้"
   🔴 ห้ามเรียก Date.now() ในไฟล์นี้ — รับ `now` เข้ามา (ด่าน "นาฬิกา +400 วัน")
   เพิ่มธงใหม่ = เพิ่ม 1 แถวใน `ACCESS_REVIEW_FLAGS` + เงื่อนไขใน `flagsOf()`
   ════════════════════════════════════════════════════════════════════════════════════════════════ */
import { activityOf, ACT_NEVER, ACT_DORMANT, ACT_UNKNOWN, DORMANT_DAYS } from './accountActivity.js';
import { SEV_FIX } from './userIssues.js';

export const LV_HIGH = 'high';   // สิทธิ์ระดับสูง/บัญชีที่ไม่ควรเปิดอยู่ — ต้องมีเหตุผลทุกครั้ง
export const LV_MID  = 'mid';    // ควรตรวจ
export const LV_INFO = 'info';   // ข้อมูลประกอบ (ไม่บังคับตรวจ)

/** ทะเบียนธง — ลำดับ = ลำดับที่แสดง · `text` = ข้อความในช่อง "ธง" ของใบทบทวน */
export const ACCESS_REVIEW_FLAGS = [
  { key: 'admin',        lv: LV_HIGH, text: 'ผู้ดูแลระบบ (ข้ามทุกด่านสิทธิ์)' },
  { key: 'emp_inactive', lv: LV_HIGH, text: 'พนักงานพ้นสภาพ/ไม่พบในฐานพนักงาน แต่บัญชียังเปิด' },
  { key: 'all_units',    lv: LV_HIGH, text: 'แก้ข้อมูลได้ทุกหน่วย (ใบผ่านข้ามหน่วย)' },
  { key: 'dept_admin',   lv: LV_HIGH, text: 'แอดมินหน่วยงาน' },
  { key: 'never',        lv: LV_MID,  text: 'ไม่เคยเข้าใช้เลย' },
  { key: 'dormant',      lv: LV_MID,  text: `ไม่ได้เข้าใช้เกิน ${DORMANT_DAYS} วัน` },
  { key: 'scope_all',    lv: LV_MID,  text: 'เห็นข้อมูลทั้งโรงงาน' },
  { key: 'issue_fix',    lv: LV_MID,  text: 'มีเรื่องต้องแก้ในหน้าจัดการผู้ใช้' },
  { key: 'shared',       lv: LV_INFO, text: 'บัญชีกลาง (ใช้ร่วม)' },
  { key: 'act_unknown',  lv: LV_INFO, text: 'อ่านเวลาเข้าใช้ไม่ได้' },
  { key: 'emp_unknown',  lv: LV_INFO, text: 'ตรวจสถานะพนักงานไม่ได้' },
];
const FLAG = Object.fromEntries(ACCESS_REVIEW_FLAGS.map((f, i) => [f.key, { ...f, order: i }]));
export const flagDef = (key) => FLAG[key] || null;

/** ตัวเลือกผลการทบทวน — ใช้เป็น dropdown ใน Excel (แก้ที่นี่ที่เดียว) */
export const REVIEW_DECISIONS = ['คงไว้ตามเดิม', 'ปรับสิทธิ์ (ระบุในหมายเหตุ)', 'ปิดบัญชี'];

/**
 * สถานะพนักงานของบัญชี
 * @param {string|null} employeeId     profiles.employee_id
 * @param {Map|Object|null} empStatus  employee id → is_active (boolean) · `null` = อ่านฐานพนักงานไม่ได้
 * @returns {'none'|'active'|'inactive'|'missing'|'unknown'}
 */
export function employeeState(employeeId, empStatus) {
  if (!employeeId) return 'none';
  if (empStatus == null) return 'unknown';
  const v = empStatus instanceof Map ? empStatus.get(employeeId) : empStatus[employeeId];
  if (v === undefined) return 'missing';
  return v === true ? 'active' : 'inactive';
}

/**
 * ธงของบัญชีหนึ่งใบ (เรียงตามทะเบียน)
 * @param u        แถวบัญชีจากหน้า /add-user (role · is_dept_admin · all_units · scope_depth · account_kind · last_sign_in_at · employee_id)
 * @param opts.issues     รายการเรื่องจาก `buildUserIssues().byUser[u.id]`
 * @param opts.empState   ผลของ `employeeState()`
 * @param opts.now        เวลาอ้างอิง (บังคับ)
 */
export function flagsOf(u, { issues = [], empState = 'none', now } = {}) {
  const out = [];
  const add = (key, detail) => out.push({ ...FLAG[key], detail: detail || null });
  if (u?.role === 'admin') add('admin');
  if (empState === 'inactive' || empState === 'missing') add('emp_inactive', empState === 'missing' ? 'ไม่พบในฐาน' : 'is_active = false');
  if (u?.all_units === true) add('all_units');
  if (u?.is_dept_admin === true) add('dept_admin');
  const act = activityOf(u?.last_sign_in_at, { now });
  if (act.state === ACT_NEVER) add('never');
  if (act.state === ACT_DORMANT) add('dormant', act.text);
  if (u?.scope_depth === 'all') add('scope_all');
  const fixes = (issues || []).filter(i => i.sev === SEV_FIX);
  if (fixes.length) add('issue_fix', fixes.map(i => i.chip).join(' · '));
  if (u?.account_kind === 'shared') add('shared');
  if (act.state === ACT_UNKNOWN) add('act_unknown');
  if (empState === 'unknown') add('emp_unknown');
  return out.sort((a, b) => a.order - b.order);
}

/** ต้องตรวจละเอียดไหม = มีธง high/mid อย่างน้อย 1 ตัว (info ไม่นับ) */
export const needsAttention = (flags) => (flags || []).some(f => f.lv === LV_HIGH || f.lv === LV_MID);
/** ต้องเขียนเหตุผลเมื่อ "คงไว้" ไหม = มีธง high */
export const needsReason = (flags) => (flags || []).some(f => f.lv === LV_HIGH);

/**
 * สร้างแถวใบทบทวน (1 แถวต่อบัญชี) — เรียง: ต้องตรวจก่อน → high มากก่อน → ชื่อ
 * @param users          แถวบัญชี (ตามหน้า /add-user)
 * @param opts.issuesByUser   `buildUserIssues().byUser`
 * @param opts.empStatus      employee id → is_active · null = อ่านไม่ได้
 * @param opts.describe       (u) => { roleText, positionText, unitText, ccText, scopeText, teamText } — ข้อความแสดงผลจากหน้า
 * @param opts.now            เวลาอ้างอิง (บังคับ)
 */
export function buildAccessReview(users, { issuesByUser = {}, empStatus = null, describe = () => ({}), now } = {}) {
  const rows = (users || []).map(u => {
    const empState = employeeState(u.employee_id, empStatus);
    const flags = flagsOf(u, { issues: issuesByUser?.[u.id] || [], empState, now });
    const act = activityOf(u.last_sign_in_at, { now });
    return {
      id: u.id,
      name: u.full_name || '',
      email: u.email && u.email !== '—' ? u.email : '',
      accountKind: u.account_kind === 'shared' ? 'บัญชีกลาง' : u.account_kind === 'person' ? 'บัญชีของคน' : 'ยังไม่ระบุ',
      empState,
      activityText: act.text,
      lastSignInAt: u.last_sign_in_at,
      flags,
      attention: needsAttention(flags),
      reasonRequired: needsReason(flags),
      highCount: flags.filter(f => f.lv === LV_HIGH).length,
      ...describe(u),
    };
  });
  rows.sort((a, b) => (b.attention - a.attention) || (b.highCount - a.highCount) || a.name.localeCompare(b.name, 'th'));
  return rows;
}

/** สรุปตัวเลขหัวใบ */
export function accessReviewSummary(rows) {
  const s = { total: 0, attention: 0, reasonRequired: 0, byFlag: {} };
  for (const r of rows || []) {
    s.total++;
    if (r.attention) s.attention++;
    if (r.reasonRequired) s.reasonRequired++;
    for (const f of r.flags) s.byFlag[f.key] = (s.byFlag[f.key] || 0) + 1;
  }
  return s;
}

/** ข้อความสถานะพนักงานสำหรับช่องในใบ */
export const EMP_STATE_TEXT = {
  none: 'ไม่ผูกพนักงาน', active: 'ยังทำงานอยู่', inactive: 'พ้นสภาพ', missing: 'ไม่พบในฐานพนักงาน', unknown: 'อ่านไม่ได้',
};
