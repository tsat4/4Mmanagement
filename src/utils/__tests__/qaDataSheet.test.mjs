import { test } from 'node:test'
import assert from 'node:assert/strict'
import { baseBalloon, balloonCompare, fmtStandard, pointType, buildDataSheet, dataSheetCsvRows } from '../qaDataSheet.js'

test('baseBalloon: TL/WL รวมใต้บอลลูนเดียวกัน', () => {
  assert.equal(baseBalloon('H14 (T)'), 'H14'); assert.equal(baseBalloon('H14(W)'), 'H14')
  assert.equal(baseBalloon('Datum B (T)'), 'Datum B'); assert.equal(baseBalloon('A1'), 'A1')
})

test('balloonCompare: Appearance → Datum → H เลขธรรมชาติ → S → T', () => {
  const s = ['T1', 'H10', 'S2', 'Datum B', 'H2', 'A10', 'A2'].sort(balloonCompare)
  assert.deepEqual(s, ['A2', 'A10', 'Datum B', 'H2', 'H10', 'S2', 'T1'])
})

test('fmtStandard: ± / +a-b / ≥ / ≤ / ข้อความ', () => {
  assert.equal(fmtStandard({ item_type: 'variable', nominal: 12, lsl: 11.9, usl: 12.1 }), '12.0 ± 0.10')
  assert.equal(fmtStandard({ item_type: 'variable', nominal: 8.5, lsl: 8.3, usl: 8.6 }), '8.5 (+0.10/-0.20)')
  assert.equal(fmtStandard({ item_type: 'variable', lsl: 1.04 }), '≥ 1.04')
  assert.equal(fmtStandard({ item_type: 'variable', usl: 0.4 }), '≤ 0.4')
  assert.equal(fmtStandard({ item_type: 'attribute', spec_text: 'GO / NOGO' }), 'GO / NOGO')
})

test('pointType: ชื่อจุดก่อน บอลลูนทีหลัง', () => {
  assert.equal(pointType({ characteristic: 'Hole Daimeter', balloon_no: 'H1' }), 'Hole')
  assert.equal(pointType({ characteristic: 'Trim line', balloon_no: 'T3' }), 'Trim line')
  assert.equal(pointType({ characteristic: 'Thickness After formed', balloon_no: 'T3' }), 'Thickness')
  assert.equal(pointType({ characteristic: 'Surface', balloon_no: 'S1' }), 'Surface')
  assert.equal(pointType({ characteristic: 'No Deform', balloon_no: 'A1' }), 'Appearance')
})

test('buildDataSheet: รวมแถวบอลลูนเดียวกัน · ยังไม่ตรวจไม่นับ OK · % P.I.S.T', () => {
  const items = [
    { id: 'p', balloon_no: 'H1', item_type: 'attribute', characteristic: 'Hole Position', spec_text: 'GO / NOGO', sample_size: 3 },
    { id: 'd', balloon_no: 'H1', item_type: 'variable', characteristic: 'Hole Daimeter', nominal: 14, lsl: 13.7, usl: 14.3, sample_size: 3 },
    { id: 'a', balloon_no: 'A1', item_type: 'attribute', characteristic: 'No Deform', sample_size: 3 },
    { id: 'x', balloon_no: 'H2', item_type: 'variable', characteristic: 'Hole Daimeter', nominal: 16, lsl: 15.85, usl: 16.15 },
  ]
  const results = [
    { item_id: 'p', judgement: 'ok', values_json: ['ok', 'ok', 'ok'] },
    { item_id: 'd', judgement: 'ng', values_json: [14.0, 14.5, ''] },
    { item_id: 'a', judgement: 'ok', values_json: ['ok'] },
  ]
  const ds = buildDataSheet({ items, results })
  assert.deepEqual(ds.groups.map(g => g.no), ['A1', 'H1', 'H2'])
  assert.equal(ds.groups[1].rows[0].item, 'Hole Daimeter')   // แบบวัดก่อนแบบนับในบอลลูนเดียวกัน
  const hole = ds.summary.find(s => s.type === 'Hole')
  assert.deepEqual([hole.ok, hole.ng, hole.total], [1, 1, 3])
  assert.equal(ds.totals.unchecked, 1); assert.equal(ds.totals.pist, 50)
  assert.equal(ds.pieceCols, 5)
  const csv = dataSheetCsvRows({ sheet: { part_no: 'P', shift: 'day' }, data: ds })
  assert.equal(csv[0][10], 'No.'); assert.equal(csv.length, 5)
  const h2 = csv.find(r => r[11] === 'H2')
  assert.equal(h2[h2.length - 3], 'ยังไม่ตรวจ'); assert.equal(h2[20], '')
})
