/* 🖼️ ชุดรูปเครื่อง (jig_images) "ของแผนกไหน" — จุดเดียวที่ตัดสิน (26/11 · คำสั่ง user)
 *
 * เครื่อง 1 ตัว = แถว `jigs` แถวเดียวร่วมกันทุกแผนก (เชื่อมกันด้วย id อุปกรณ์) แต่ **รูปเป็นของแต่ละแผนก**
 * (`jig_images.department`) — เดิมรูปใช้ชุดเดียวกัน ⇒ AM (ผลิต) เปลี่ยนรูปแล้วกดบันทึก = ลบรูปของ JIG MTN
 * ⇒ FK `ON DELETE SET NULL` ล้าง image_id จุดตรวจ JIG MTN 1,567 จุด (เหตุการณ์ 19–25/11)
 *
 * เฟรมที่แผนก D เห็น = รูปของ D ∪ รูปที่ไม่รู้เจ้าของ (null · แถวเก่า) ∪ รูปที่จุดตรวจของ D ชี้อยู่
 * (ข้อสุดท้าย: จุดตรวจที่ "คัดลอกข้ามแผนก" ยังชี้รูปต้นทาง — ต้องเห็นรูปที่จุดตัวเองวางอยู่)
 * 🔴 ลบ/แก้ได้เฉพาะรูปของแผนกตัวเอง — `ownsFrame()` · null/ของแผนกอื่น = ห้ามลบ (fail-safe)
 * ไม่ส่ง department = พฤติกรรมเดิม (ทุกรูปของเครื่อง)
 */
import { supabaseDR } from '../supabaseClient'

const COLS = 'id, jig_id, image_path, sort, title, is_spin_frame, department'

/** โหลดเฟรมของเครื่อง (หลายตัวได้) ที่แผนก `department` เห็น · คืน `{ rows, error }` เรียงตาม sort */
export async function loadDeptFrames(jigIds, department) {
  const ids = [...new Set((jigIds ?? []).filter(Boolean))]
  if (!ids.length) return { rows: [], error: null }
  if (!department) {
    const { data, error } = await supabaseDR.from('jig_images').select(COLS).in('jig_id', ids).order('sort')
    return { rows: data ?? [], error }
  }
  const [own, refd] = await Promise.all([
    supabaseDR.from('jig_images').select(COLS).in('jig_id', ids)
      .or(`department.eq.${department},department.is.null`).order('sort'),
    supabaseDR.from('jig_checkpoints').select('image_id, checklists!inner(department)')
      .in('jig_id', ids).eq('checklists.department', department).not('image_id', 'is', null),
  ])
  if (own.error) return { rows: [], error: own.error }
  if (refd.error) return { rows: [], error: refd.error }
  const have = new Set((own.data ?? []).map(r => r.id))
  const extra = [...new Set((refd.data ?? []).map(r => r.image_id))].filter(id => !have.has(id))
  let more = []
  if (extra.length) {
    const r = await supabaseDR.from('jig_images').select(COLS).in('id', extra)
    if (r.error) return { rows: [], error: r.error }
    more = r.data ?? []
  }
  const rows = [...(own.data ?? []), ...more].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
  return { rows, error: null }
}

/** แผนกนี้เป็นเจ้าของรูปนี้ไหม (แก้/ลบได้) — null = ไม่รู้เจ้าของ = ไม่ใช่ */
export const ownsFrame = (row, department) => !!row && !!department && row.department === department
