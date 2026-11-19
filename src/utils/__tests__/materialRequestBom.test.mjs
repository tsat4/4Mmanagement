import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bomPickRows, rescalePickRows, pickedToItems, parentPickList, templateFromEditor, editorFromTemplate } from '../materialRequest.js'

test('bomPickRows: ลูกเท่านั้น (ไม่ตัดแม่) · จำนวน = แม่ × qtyPerRoot · flatDupe ว่างให้คนกรอก', () => {
  const rows = bomPickRows({ mat_no: 'FG1' }, [
    { level: 1, mat_no: 'C1', part_name: 'ลูก1', uom: 'PC', qtyPerRoot: 2 },
    { level: 2, mat_no: 'C2', part_name: 'ลูก2', uom: 'PC', qtyPerRoot: 0.5, flatDupe: true },
  ], 3)
  assert.deepEqual(rows.map(r => r.mat_no), ['C1', 'C2'])
  assert.deepEqual(rows.map(r => r.qty), [6, ''])
  assert.equal(rows[1].unsure, true)
  rows[0].use = false
  assert.deepEqual(pickedToItems(rows).map(i => i.mat_no), ['C2'])
  assert.deepEqual(bomPickRows({ mat_no: 'X' }, [], 5), [])
})

test('rescalePickRows: แก้จำนวนแม่ → ลูกคิดใหม่ · แถวที่คนแก้เองไม่ทับ', () => {
  const rows = [{ rate: 2, qty: 2 }, { rate: 3, qty: 99, edited: true }, { rate: null, qty: '' }]
  assert.deepEqual(rescalePickRows(rows, 10).map(r => r.qty), [20, 99, ''])
})

test('parentPickList: กรองตามพื้นที่ · ไม่รู้พื้นที่ = ไม่ซ่อนแต่นับ · มี BOM ขึ้นก่อน', () => {
  const area = { L1: 'P409', L2: 'P401' }
  const r = parentPickList([
    { id: 1, mat_no: 'A', line_name: 'L1' }, { id: 2, mat_no: 'B', line_name: 'L2' },
    { id: 3, mat_no: 'C', line_name: 'LX' }, { id: 4, mat_no: 'D', line_name: 'L1' },
  ], { slocOfLine: l => area[l] || null, sloc: 'p409', bomIds: new Set([4]) })
  assert.deepEqual(r.rows.map(p => p.mat_no), ['D', 'A', 'C'])
  assert.equal(r.hiddenOtherArea, 1); assert.equal(r.noArea, 1)
  assert.equal(parentPickList([{ id: 1, mat_no: 'A', line_name: 'L2' }], { slocOfLine: l => area[l], sloc: '' }).rows.length, 1)
})

test('template: ไม่เก็บเลขที่/วันที่ · ใบใหม่ไม่ถูกทับด้วยช่องว่าง', () => {
  const t = templateFromEditor({ doc_no: 'X', request_date: '2026-11-18', detail: 'Test ประจำปี', cost_center: '', move_code: '201' },
    [{ mat_no: 'A', qty: 2, unit: 'PC' }, { mat_no: '', description: '' }], ' ทดสอบประจำเดือน ')
  assert.equal(t.name, 'ทดสอบประจำเดือน'); assert.equal(t.doc_no, undefined); assert.equal(t.items.length, 1)
  const e = editorFromTemplate(t)
  assert.equal(e.req.detail, 'Test ประจำปี'); assert.equal('cost_center' in e.req, false); assert.equal(e.items[0].mat_no, 'A')
})
