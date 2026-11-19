/* ═══ ✍️ ขั้นอนุมัติใบตรวจ QA — หัวหน้า QA 1 ขั้น (2026-11-19 · คำสั่ง user) ═══════════════
   ที่มา: audit มาตรฐานระบบตรวจ (QA ชิ้นงาน · PM ช่าง · AM พนักงาน) — ใบ QA เป็นระบบเดียวที่ไม่มีคนเซ็นทบทวน
   user เลือก 19/11: "หัวหน้า QA 1 ขั้น" + "ไม่บล็อกอะไร" (ใบปิดตามกฎลำดับชิ้นเหมือนเดิม ผลิตเดินต่อได้)

   🔑 กติกาคนกด = ชุดเดียวกับขั้น 2 ของใบ PM (`pmConfirmVerdict` ใน amApproval.js) — ห้ามเขียนชุดที่ 2
      · ระดับ ≥ 30 (วิศวกร/หัวหน้าแผนกขึ้นไป) · ไม่ต่ำกว่าคนตรวจ · ไม่ใช่ใบที่ตัวเองตรวจ · บัญชีกลางกดไม่ได้
      · ไม่รู้ตำแหน่ง = ไม่บล็อก แต่จอต้องเขียนบอก (`assumed`)
      วัดบัญชีจริง Main 19/11: role qa = QC 15 (ระดับ 20 · กดไม่ได้) · วิศวกร 3 + หัวหน้าแผนก 1 (กดได้)
   🔑 สิทธิ์ปุ่ม = `qa:manage` (manager/admin/qa) — ไม่ seed คีย์ใหม่ · RLS update ของตาราง = `qa:record` เดิม
   🔴 สถานะ `null` = ใบก่อนมีขั้นนี้ ⇒ **ไม่ใช่ "รออนุมัติ"** (ห้ามนับเข้าคิว ห้าม backfill)
   📄 docs/modules/qa-inspection.md §✍️ ขั้นอนุมัติใบตรวจ */
import { pmConfirmVerdict } from './amApproval.js'

export const QA_APPROVAL = Object.freeze({
  pending:  { key: 'pending',  label: 'รอหัวหน้า QA อนุมัติ', short: 'รออนุมัติ', tone: 'warn' },
  approved: { key: 'approved', label: 'หัวหน้า QA อนุมัติแล้ว', short: 'อนุมัติแล้ว', tone: 'ok' },
  rejected: { key: 'rejected', label: 'หัวหน้า QA ตีกลับ',     short: 'ตีกลับ',     tone: 'bad' },
})
export const QA_REJECT_MIN = 5

/** สถานะอนุมัติของใบ — `null` = ไม่อยู่ในสายอนุมัติ (ใบยังไม่ปิด หรือใบก่อนมีขั้นนี้) */
export function qaApprovalState(sheet) {
  if (!sheet || sheet.status !== 'done') return null
  return QA_APPROVAL[sheet.approval_status] ? sheet.approval_status : null
}

/** คนนี้อนุมัติ/ตีกลับใบนี้ได้ไหม
 *  @param {{ sheet:object, canManage:boolean, myUid:string|null, myRank:number|null, inspectorRank:number|null, isShared?:boolean }} p
 *  @returns {{ ok:boolean, code:string, assumed:string[] }} code: ok · no_perm · not_pending · self · shared · rank_too_low · below_inspector */
export function qaApproveVerdict({ sheet, canManage = false, myUid = null, myRank = null, inspectorRank = null, isShared = false } = {}) {
  if (!canManage) return { ok: false, code: 'no_perm', assumed: [] }
  if (qaApprovalState(sheet) !== 'pending') return { ok: false, code: 'not_pending', assumed: [] }
  const isSelf = !!(myUid && sheet.created_by_uid && myUid === sheet.created_by_uid)
  const v = pmConfirmVerdict({ inspectorRank, approverRank: myRank, isSelf, isShared })
  return { ok: v.ok, code: v.code, assumed: v.assumed }
}

/** ข้อความบนจอของ `qaApproveVerdict` */
export function qaApproveText(v) {
  if (!v) return ''
  switch (v.code) {
    case 'no_perm': return 'ไม่มีสิทธิ์อนุมัติใบตรวจ QA'
    case 'not_pending': return 'ใบนี้ไม่ได้รออนุมัติ'
    case 'shared': return 'บัญชีกลางอนุมัติแทนคนไม่ได้ — ให้หัวหน้า QA login ด้วยบัญชีของตัวเอง'
    case 'self': return 'อนุมัติใบที่ตัวเองตรวจไม่ได้ — รอหัวหน้า QA คนอื่น'
    case 'rank_too_low': return 'ขั้นนี้ต้องเป็นหัวหน้า QA — ระดับวิศวกร/หัวหน้าแผนกขึ้นไป'
    case 'below_inspector': return 'ตำแหน่งต่ำกว่าคนตรวจ — อนุมัติใบนี้ไม่ได้'
    default: return ''
  }
}

/** ข้อความเมื่อไม่รู้ตำแหน่ง (ไม่บล็อก แต่ต้องบอกบนจอ) */
export function qaApproveAssumedText(assumed = []) {
  const a = []
  if (assumed.includes('approver')) a.push('ตำแหน่งของคุณ')
  if (assumed.includes('inspector')) a.push('ตำแหน่งคนตรวจ')
  return a.length ? `ไม่รู้${a.join('และ')}ในระบบ — ยังกดได้ แต่ตรวจระดับให้ไม่ได้` : ''
}

export const qaRejectReasonValid = (s) => String(s || '').trim().length >= QA_REJECT_MIN
