import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bomPickRows, pickedToItems, templateFromEditor, editorFromTemplate } from '../materialRequest.js'

test('bomPickRows: ตัวเอง + ลูก · จำนวน = ชุด × qtyPerRoot · flatDupe ว่างให้คนกรอก', () => {
  const rows = bomPickRows({ mat_no: 'FG1', part_name: 'FG', uom: 'PC' }, [
    { level: 1, mat_no: 'C1', part_name: 'ลูก1', uom: 'PC', qtyPerRoot: 2 },
    { level: 2, mat_no: 'C2', part_name: 'ลูก2', uom: 'PC', qtyPerRoot: 0.5, flatDupe: true },
  ], 3)
  assert.deepEqual(rows.map(r => r.qty), [3, 6, ''])
  assert.equal(rows[2].unsure, true); assert.ok(rows.every(r => r.use))
  rows[1].use = false
  assert.deepEqual(pickedToItems(rows).map(i => i.mat_no), ['FG1', 'C2'])
})

test('template: ไม่เก็บเลขที่/วันที่ · ใบใหม่ไม่ถูกทับด้วยช่องว่าง', () => {
  const t = templateFromEditor({ doc_no: 'X', request_date: '2026-11-18', detail: 'Test ประจำปี', cost_center: '', move_code: '201' },
    [{ mat_no: 'A', qty: 2, unit: 'PC' }, { mat_no: '', description: '' }], ' ทดสอบประจำเดือน ')
  assert.equal(t.name, 'ทดสอบประจำเดือน'); assert.equal(t.doc_no, undefined); assert.equal(t.items.length, 1)
  const e = editorFromTemplate(t)
  assert.equal(e.req.detail, 'Test ประจำปี'); assert.equal('cost_center' in e.req, false); assert.equal(e.items[0].mat_no, 'A')
})
