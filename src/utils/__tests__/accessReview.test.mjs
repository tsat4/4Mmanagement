import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  flagsOf, employeeState, buildAccessReview, accessReviewSummary, needsAttention, needsReason,
  ACCESS_REVIEW_FLAGS, LV_HIGH, LV_INFO, REVIEW_DECISIONS,
} from '../accessReview.js';
import { buildUserIssues } from '../userIssues.js';

// ⏱️ ตรึงนาฬิกา — ด่าน "+400 วัน" ของ npm test ต้องผ่าน
const NOW = Date.parse('2026-11-24T09:00:00+07:00');
const daysAgo = n => new Date(NOW - n * 86400000).toISOString();
const keys = (fl) => fl.map(f => f.key);
const base = { id: 'u1', full_name: 'ก', role: 'leader', last_sign_in_at: daysAgo(1), account_kind: 'person', employee_id: 'e1' };

test('บัญชีปกติ ไม่มีธง ⇒ ไม่ต้องตรวจละเอียด', () => {
  const fl = flagsOf(base, { empState: 'active', now: NOW });
  assert.deepEqual(fl, []);
  assert.equal(needsAttention(fl), false);
});

test('อ่านเวลาเข้าใช้ไม่ได้ (undefined) ≠ ไม่เคยเข้า (null)', () => {
  const unk = keys(flagsOf({ ...base, last_sign_in_at: undefined }, { empState: 'active', now: NOW }));
  const nev = keys(flagsOf({ ...base, last_sign_in_at: null }, { empState: 'active', now: NOW }));
  assert.deepEqual(unk, ['act_unknown']);
  assert.deepEqual(nev, ['never']);
  // อ่านไม่ได้เป็นแค่ข้อมูลประกอบ — ห้ามบังคับตรวจเพราะไม่รู้
  assert.equal(needsAttention(flagsOf({ ...base, last_sign_in_at: undefined }, { empState: 'active', now: NOW })), false);
});

test('ค้างเกิน 90 วัน = dormant', () => {
  assert.deepEqual(keys(flagsOf({ ...base, last_sign_in_at: daysAgo(120) }, { empState: 'active', now: NOW })), ['dormant']);
});

test('สถานะพนักงาน: พ้นสภาพ/ไม่พบ = high · อ่านไม่ได้ = info (ห้ามเดาว่าพ้นสภาพ)', () => {
  assert.equal(employeeState(null, {}), 'none');
  assert.equal(employeeState('e1', null), 'unknown');
  assert.equal(employeeState('e1', { e1: true }), 'active');
  assert.equal(employeeState('e1', new Map([['e1', false]])), 'inactive');
  assert.equal(employeeState('e1', {}), 'missing');
  const inact = flagsOf(base, { empState: 'inactive', now: NOW });
  assert.deepEqual(keys(inact), ['emp_inactive']);
  assert.equal(needsReason(inact), true);
  const unk = flagsOf(base, { empState: 'unknown', now: NOW });
  assert.deepEqual(keys(unk), ['emp_unknown']);
  assert.equal(unk[0].lv, LV_INFO);
});

test('สิทธิ์ระดับสูงต้องมีเหตุผล · เรียงตามทะเบียน', () => {
  const u = { ...base, role: 'admin', all_units: true, is_dept_admin: true, scope_depth: 'all', account_kind: 'shared' };
  const fl = flagsOf(u, { empState: 'active', now: NOW });
  assert.deepEqual(keys(fl), ['admin', 'all_units', 'dept_admin', 'scope_all', 'shared']);
  assert.equal(needsReason(fl), true);
  const order = ACCESS_REVIEW_FLAGS.map(f => f.key);
  const idx = keys(fl).map(k => order.indexOf(k));
  assert.deepEqual(idx, [...idx].sort((a, b) => a - b));
});

test('กองงานค้างมาจาก buildUserIssues — เอาเฉพาะ "ต้องแก้" ข้อมูลประกอบไม่ติดธง', () => {
  const iss = buildUserIssues({ review: ['u1'], dual: ['u1'] }).byUser;
  const fl = flagsOf(base, { issues: iss.u1, empState: 'active', now: NOW });
  assert.deepEqual(keys(fl), ['issue_fix']);
  assert.match(fl[0].detail, /ทบทวนขอบเขต/);
  const onlyInfo = buildUserIssues({ dual: ['u1'] }).byUser;
  assert.deepEqual(flagsOf(base, { issues: onlyInfo.u1, empState: 'active', now: NOW }), []);
});

test('buildAccessReview: ต้องตรวจขึ้นก่อน · high มากก่อน · สรุปนับถูก', () => {
  const users = [
    { ...base, id: 'a', full_name: 'ข ปกติ' },
    { ...base, id: 'b', full_name: 'ค แอดมิน', role: 'admin', all_units: true },
    { ...base, id: 'c', full_name: 'ง ไม่เคยเข้า', last_sign_in_at: null },
  ];
  const rows = buildAccessReview(users, { empStatus: { e1: true }, now: NOW,
    describe: (u) => ({ roleText: u.role }) });
  assert.deepEqual(rows.map(r => r.id), ['b', 'c', 'a']);
  assert.equal(rows[0].roleText, 'admin');
  assert.equal(rows[0].reasonRequired, true);
  const s = accessReviewSummary(rows);
  assert.equal(s.total, 3);
  assert.equal(s.attention, 2);
  assert.equal(s.reasonRequired, 1);
  assert.equal(s.byFlag.never, 1);
});

test('ทะเบียนธงทุกตัวมีระดับที่รู้จัก + ตัวเลือกผลไม่ว่าง', () => {
  for (const f of ACCESS_REVIEW_FLAGS) assert.ok([LV_HIGH, 'mid', LV_INFO].includes(f.lv), f.key);
  assert.ok(REVIEW_DECISIONS.length >= 3);
  // ตัวเลือก dropdown Excel ห้ามมีจุลภาค (list validation ใช้จุลภาคคั่น)
  for (const d of REVIEW_DECISIONS) assert.ok(!d.includes(','), d);
});
