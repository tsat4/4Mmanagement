import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { wfPeriodRange, roundKey, validateBinding, roundState, BOUND_SUBJECTS } from '../wfBound.js';
import { lpaPeriodRange } from '../lpaPlanStatus.js';

test('wfPeriodRange — ตรงกับ wf_period_range() ฝั่ง DB (ผลจำลองบนฐานจริง 25/11)', () => {
  assert.deepEqual(wfPeriodRange('week', '2026-11-25'), ['2026-11-22', '2026-11-30']);
  assert.deepEqual(wfPeriodRange('week', '2026-02-23'), ['2026-02-22', '2026-02-28']);
  assert.deepEqual(wfPeriodRange('week', '2026-11-20'), ['2026-11-15', '2026-11-21']);
  assert.deepEqual(wfPeriodRange('day', '2026-11-24'), ['2026-11-24', '2026-11-24']);
  assert.deepEqual(wfPeriodRange('quarter', '2026-11-24'), ['2026-10-01', '2026-12-31']);
  assert.equal(wfPeriodRange('x', '2026-11-24'), null);
});

test('บล็อกสัปดาห์ตรงกับ LPA (ใบโรงงานชุดเดียวกัน)', () => {
  for (const d of ['2026-11-01', '2026-11-08', '2026-11-21', '2026-11-30', '2026-02-28'])
    assert.deepEqual(wfPeriodRange('week', d), lpaPeriodRange('supervisor', d));
});

test('roundKey = รูปแบบเดียวกับ subject_key ฝั่ง DB', () => {
  assert.equal(roundKey(' Line 60 ', '2026-11-24', 'day'), 'Line 60|2026-11-24|day');
  assert.equal(roundKey('Line 60', '2026-11-22', null), 'Line 60|2026-11-22|');
});

test('validateBinding — ใบรอบห้ามกฎผู้เปิดใบ · ต้องเลือกเอกสาร+ความถี่', () => {
  assert.deepEqual(validateBinding(null), []);
  assert.equal(validateBinding({ subject: 'pokayoke', period: 'week' }, [{ assignee: { rule: 'perm_in_line' } }]).length, 0);
  assert.equal(validateBinding({ subject: 'x', period: 'y' }).length, 2);
  assert.equal(validateBinding({ subject: 'pokayoke', period: 'day' }, [{ assignee: { rule: 'creator_head' } }]).length, 1);
});

test('roundState — ไม่มีใบ ≠ ยังไม่เซ็น', () => {
  assert.equal(roundState({ instance: { status: 'approved' } }), 'signed');
  assert.equal(roundState({ instance: { status: 'in_progress' } }), 'waiting');
  assert.equal(roundState({ instance: { status: 'in_progress', blocked_reason: 'x' } }), 'blocked');
  assert.equal(roundState({ ensureStatus: 'period_open' }), 'period_open');
  assert.equal(roundState({ hasData: false }), 'no_data');
  assert.equal(roundState({}), 'unknown');
});

test('BOUND_SUBJECTS ตรงกับ wf_bound_subjects() ใน migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20261125b_e_workflow_bound_main.sql'), 'utf8');
  for (const s of BOUND_SUBJECTS) {
    assert.ok(sql.includes(`"${s.subject}": {"label": "${s.label}", "record_perm": "${s.recordPerm}"`), `migration ต้องลงทะเบียน ${s.subject}`);
  }
});
