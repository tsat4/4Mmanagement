import test from 'node:test';
import assert from 'node:assert/strict';
import { qaApprovalState, qaApproveVerdict, qaRejectReasonValid, qaApproveAssumedText } from '../qaApproval.js';

const done = (o = {}) => ({ status: 'done', approval_status: 'pending', created_by_uid: 'u-insp', ...o });

test('สถานะ: ใบยังไม่ปิด / ใบเก่า (null) ไม่อยู่ในสายอนุมัติ', () => {
  assert.equal(qaApprovalState({ status: 'open', approval_status: 'pending' }), null);
  assert.equal(qaApprovalState({ status: 'done', approval_status: null }), null);
  assert.equal(qaApprovalState(done()), 'pending');
  assert.equal(qaApprovalState(done({ approval_status: 'approved' })), 'approved');
  assert.equal(qaApprovalState(done({ approval_status: 'xx' })), null);
});

test('คนกด: หัวหน้า QA (≥30) อนุมัติใบคนอื่นได้ · QC (20) ไม่ได้', () => {
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-head', myRank: 30, inspectorRank: 20 }).ok, true);
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-qc', myRank: 20, inspectorRank: 20 }).code, 'rank_too_low');
});

test('ห้ามใบตัวเอง · ห้ามบัญชีกลาง · ไม่มีสิทธิ์ · ใบไม่ได้รอ', () => {
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-insp', myRank: 50 }).code, 'self');
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-head', myRank: 50, isShared: true }).code, 'shared');
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: false, myUid: 'u-head', myRank: 50 }).code, 'no_perm');
  assert.equal(qaApproveVerdict({ sheet: done({ approval_status: 'approved' }), canManage: true, myUid: 'u-head', myRank: 50 }).code, 'not_pending');
  assert.equal(qaApproveVerdict({ sheet: done({ approval_status: null }), canManage: true, myUid: 'u-head', myRank: 50 }).code, 'not_pending');
});

test('ต่ำกว่าคนตรวจ = ไม่ได้ · ไม่รู้ตำแหน่ง = ไม่บล็อกแต่บอก', () => {
  assert.equal(qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-eng', myRank: 30, inspectorRank: 50 }).code, 'below_inspector');
  const v = qaApproveVerdict({ sheet: done(), canManage: true, myUid: 'u-x', myRank: null, inspectorRank: null });
  assert.equal(v.ok, true);
  assert.ok(qaApproveAssumedText(v.assumed).includes('ตำแหน่ง'));
});

test('เหตุผลตีกลับต้องยาวพอ', () => {
  assert.equal(qaRejectReasonValid('  ab '), false);
  assert.equal(qaRejectReasonValid('วัดซ้ำไม่ครบ'), true);
});
