/* ══════════════════════════════════════════════════════════════════════════════
   🧩 useBomChildren — "พาร์ทลูกของ MAT นี้" สำหรับช่องเลือก  (2026-11-16)

   ใช้ที่: ฟอร์มบันทึกงานเสีย `/daily-report` (เลือกพาร์ทลูกที่เสีย — user 16/11)
   จุดเดียวที่โหลด BOM มาทำ "ลิสต์ลูกของพาร์ทหนึ่งตัว" — หน้าใหม่ที่ต้องถามคำถามเดียวกัน
   ให้เรียกตัวนี้ **ห้ามยิง `bom_items` เองในหน้า** (ไม่งั้นแต่ละจอตัดสิน "ใบ" คนละแบบ = ลิสต์ไม่ตรงกัน)
   ⚠️ คนละคำถามกับ `useBomChildOptions` ใน `LinePartCallPanel` — ตัวนั้นถาม "ของที่ **ไลน์นี้** ใช้"
      (แบน ทุกใบของทุกสินค้าในไลน์) ไม่ใช่ "ลูกของพาร์ทตัวนี้"

   กติกาที่ตัวนี้รับประกัน:
   1. ต้นไม้ผ่าน `buildBomIndex` + `bomChildCandidates` เท่านั้น (กฎ CLAUDE.md §ชั้น BOM)
   2. **ยิงเฉพาะใบที่เกี่ยวข้อง** — ใบของ mat เอง (`product_id`) + บรรทัดที่ตั้ง `parent_mat = mat`
      (= "ใบนี้ว่าง ≠ พาร์ทไม่มีลูก") · ไม่โหลด `bom_items` ทั้งตาราง (กฎ egress ข้อ 11)
   3. 🔴 **"ว่าง" กับ "โหลดไม่สำเร็จ" แยกกัน** — `failed` ต้องส่งต่อให้จอเขียนบอก
      (ลิสต์ว่างเฉยๆ ทำให้คนสรุปว่า "พาร์ทนี้ไม่มีลูก" แล้วลงของเสียผิดระดับ)
   4. 🔴 โหลดไม่ได้ / ไม่มีลูก = **ยังต้องลงของเสียระดับ MAT แม่ได้เหมือนเดิม** (fail-open)
      — หน้างานต้องลงของเสียได้ทุกกะ ห้ามบล็อกเพราะ BOM ไม่ครบ

   🔴 ตัวนี้ไม่เกี่ยวกับสูตร OEE เลย (ดู `utils/defectPart.js` §กฎเหล็ก)
   ══════════════════════════════════════════════════════════════════════════════ */
import { useEffect, useMemo, useState } from 'react';
import { supabaseDR } from '../supabaseClient';
import { cachedRows } from './masterCache';
import { loadProductsMaster } from './useProducts';
import { buildBomIndex, bomChildCandidates } from './bomTree';

/** คอลัมน์ที่ลิสต์ลูกต้องใช้ — เพิ่มคอลัมน์ = **ต้อง bump เลขรุ่นในคีย์ cache** ไม่งั้นเครื่องที่มี
 *  cache ค้างได้แถวที่ไม่มีคอลัมน์ใหม่ไปอีก 4 ชม. โดยไม่มี error (บทเรียน `dr_products:picker:v2`) */
export const BOM_CHILD_COLUMNS =
  'id, product_id, mat_no, part_name, part_no, qty_per_unit, uom, parent_mat, op_no, item_no';
const keyOf = (mat) => `bom_items:kids:v1:${mat}`;
const EMPTY = Object.freeze([]);

/**
 * โหลด "บรรทัด BOM ที่เกี่ยวกับ mat นี้" (ยังไม่กางเป็นต้นไม้)
 * @returns {{ rows: Array, matOf: Object, failed: boolean, message: string }}
 *   🔴 ไม่ throw และ **ไม่กลืน error** — คืนธง `failed` ให้จอเขียนบอก
 */
export async function loadBomChildRows(mat) {
  const m = String(mat ?? '').trim();
  if (!m) return { rows: EMPTY, matOf: {}, failed: false, message: '' };

  const products = await loadProductsMaster().catch((e) => {
    console.warn('[useBomChildren] โหลด Product Master ไม่สำเร็จ —', e?.message || e);
    return null;
  });
  if (!products) {
    return { rows: EMPTY, matOf: {}, failed: true, message: 'โหลดทะเบียนสินค้าไม่สำเร็จ' };
  }
  /* map `product_id → mat_no` ทั้งทะเบียน (อยู่ในหน่วยความจำอยู่แล้ว ไม่มีคิวรีเพิ่ม) —
     ต้องครบทะเบียน ไม่ใช่แค่ของ mat นี้ เพราะบรรทัดที่ตั้ง `parent_mat` อาจอยู่ในใบของ FG ตัวอื่น */
  const matOf = {};
  for (const p of products) if (p?.id != null && p?.mat_no) matOf[p.id] = p.mat_no;
  const upper = m.toUpperCase();
  const pids = products
    .filter(p => String(p?.mat_no ?? '').trim().toUpperCase() === upper && p?.id != null)
    .map(p => p.id);

  const { data, error } = await cachedRows(keyOf(upper), async () => {
    /* 2 คิวรีแยก แล้วยุบด้วย `id` — ไม่ใช้ `.or()` เพราะ mat_no เป็น text ที่ผู้ใช้กรอก
       (คอมมา/วงเล็บในค่า = ไวยากรณ์ `or` เพี้ยนเงียบๆ) · แต่ละก้อนไม่เกินไม่กี่สิบแถว */
    const out = new Map();
    for (const q of [
      pids.length
        ? supabaseDR.from('bom_items').select(BOM_CHILD_COLUMNS).eq('is_active', true).in('product_id', pids).limit(500)
        : null,
      supabaseDR.from('bom_items').select(BOM_CHILD_COLUMNS).eq('is_active', true).eq('parent_mat', m).limit(500),
    ]) {
      if (!q) continue;
      const r = await q;
      if (r.error) return { data: null, error: r.error };
      for (const row of r.data || []) out.set(row.id, row);
    }
    return { data: [...out.values()], error: null };
  });
  if (error) {
    console.warn('[useBomChildren] โหลด BOM ไม่สำเร็จ —', error.message);
    return { rows: EMPTY, matOf, failed: true, message: `โหลด BOM ไม่สำเร็จ (${error.message})` };
  }
  return { rows: data || EMPTY, matOf, failed: false, message: '' };
}

/**
 * @param {string} mat  MAT แม่ที่กำลังผลิต (ว่าง = ไม่โหลด)
 * @param {{enabled?: boolean}} opt  `enabled:false` = ยังไม่เปิดฟอร์ม ไม่ต้องจ่าย egress
 * @returns {{ rows: Array, sheets: Array, failed: boolean, message: string, loading: boolean }}
 *   `rows` = ผล `bomChildCandidates` (ลูกทุกชั้นของ "ใบเดียว" · ยุบ mat ซ้ำแล้ว)
 */
export default function useBomChildren(mat, { enabled = true } = {}) {
  const m = String(mat ?? '').trim();
  const [st, setSt] = useState({ rows: EMPTY, matOf: {}, failed: false, message: '', loading: false });

  useEffect(() => {
    if (!enabled || !m) {
      setSt({ rows: EMPTY, matOf: {}, failed: false, message: '', loading: false });
      return undefined;
    }
    let alive = true;   // stale-response guard (กฎเหล็ก DB ข้อ 4) — สลับ MAT เร็วๆ ห้ามได้ลิสต์ของตัวก่อน
    setSt(s => ({ ...s, loading: true }));
    loadBomChildRows(m).then((r) => { if (alive) setSt({ ...r, loading: false }); });
    return () => { alive = false; };
  }, [m, enabled]);

  const { rows, sheets } = useMemo(() => {
    if (!m || !st.rows.length) return { rows: EMPTY, sheets: EMPTY };
    const ix = buildBomIndex(st.rows, st.matOf);
    const c = bomChildCandidates(m, ix);
    return { rows: c.rows, sheets: c.sheets };
  }, [m, st.rows, st.matOf]);

  return { rows, sheets, failed: st.failed, message: st.message, loading: st.loading };
}

/**
 * 🌳 "พาร์ทไหนมี BOM บ้าง" — ชุด `product_id` ที่มีบรรทัด BOM ใช้งานอยู่ (2026-11-19 · ใบเบิก FM-STO-003)
 * ใช้ติดป้าย/เรียงในช่องเลือกแม่ (เลือกแม่เพื่อตัดลูก) · ดึงคอลัมน์เดียว (กฎ egress ข้อ 11)
 * @returns {Promise<{ ids: Set<any>|null, failed: boolean, message: string }>}
 *   🔴 อ่านไม่ได้ = `ids:null` + `failed` — จอห้ามสรุปว่า "ไม่มี BOM" (fail-open: ยังเลือกได้ทุกตัว)
 */
export async function loadBomParentIds() {
  const { data, error } = await cachedRows('bom_items:parent_ids:v1', async () => {
    const out = new Set();
    for (let from = 0; from < 20000; from += 1000) {
      const r = await supabaseDR.from('bom_items').select('product_id')
        .eq('is_active', true).order('id').range(from, from + 999);
      if (r.error) return { data: null, error: r.error };
      for (const row of r.data || []) if (row.product_id != null) out.add(row.product_id);
      if ((r.data || []).length < 1000) break;
    }
    return { data: [...out], error: null };
  });
  if (error) return { ids: null, failed: true, message: `อ่านทะเบียน BOM ไม่สำเร็จ (${error.message})` };
  return { ids: new Set(data || []), failed: false, message: '' };
}
