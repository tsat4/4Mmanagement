import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstWarnLevel, firstWarnings } from '../qaFmeLineWarn.js'

const NOW = Date.parse('2026-11-16T02:00:00Z')
const ob = (o) => ({ stage: 'first', status: 'pending', due_at: '2026-11-16T02:30:00Z', ...o })

test('firstWarnLevel: ไม่ผ่าน = ng · เลยกำหนด = late · รอ = wait · ผ่าน/ยกเลิก/สเตจอื่น = null', () => {
  assert.equal(firstWarnLevel(ob({ status: 'done_ng' }), NOW), 'ng')
  assert.equal(firstWarnLevel(ob({ due_at: '2026-11-16T01:50:00Z' }), NOW), 'late')
  assert.equal(firstWarnLevel(ob({ status: 'acked' }), NOW), 'wait')
  assert.equal(firstWarnLevel(ob({ status: 'done_ok' }), NOW), null)
  assert.equal(firstWarnLevel(ob({ status: 'cancelled' }), NOW), null)
  assert.equal(firstWarnLevel(ob({ stage: 'end' }), NOW), null)
  assert.equal(firstWarnLevel(ob({ due_at: null }), NOW), 'wait')
})

test('firstWarnings: เรียงหนักก่อน + นาทีที่เลย', () => {
  const w = firstWarnings([
    ob({ id: 'a', triggered_at: '2026-11-16T01:00:00Z' }),
    ob({ id: 'b', due_at: '2026-11-16T01:45:00Z' }),
    ob({ id: 'c', status: 'done_ng' }),
    ob({ id: 'd', status: 'done_ok' }),
  ], NOW)
  assert.deepEqual(w.map(x => x.id), ['c', 'b', 'a'])
  assert.equal(w[1].lateMin, 15)
  assert.deepEqual(firstWarnings(null, NOW), [])
})
