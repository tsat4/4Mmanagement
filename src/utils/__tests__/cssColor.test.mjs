import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssColorToHex, FALLBACK_HEX } from '../cssColor.js';

const VARS = { '--green': '#2fbf63', '--red': ' #e2574b ', '--muted': 'rgb(107, 116, 131)', '--chain': 'var(--green)' };
const read = (n) => VARS[n] || '';

test('🎨 cssColorToHex — var(--token) อ่านค่าจาก :root ได้ hex ไม่ใช่ดำ (บั๊กกล่อง 3D ดำ 18/11)', () => {
  assert.equal(cssColorToHex('var(--green)', read), '#2fbf63');
  assert.equal(cssColorToHex('var(--red)', read), '#e2574b');          // มีช่องว่างรอบค่า
  assert.equal(cssColorToHex('var(--muted)', read), '#6b7483');        // token เป็น rgb()
  assert.equal(cssColorToHex('var(--chain)', read), '#2fbf63');        // var ซ้อน var
});

test('🎨 cssColorToHex — hex/rgb ตรงๆ ผ่านได้ · ของแปลก/ไม่มี token = fallback เทา ไม่ใช่ #000000', () => {
  assert.equal(cssColorToHex('#6b7280', read), '#6b7280');
  assert.equal(cssColorToHex('#ABC', read), '#aabbcc');
  assert.equal(cssColorToHex('#2fbf63cc', read), '#2fbf63');
  assert.equal(cssColorToHex('rgb(255, 0, 128)', read), '#ff0080');
  assert.equal(cssColorToHex('var(--nope)', read), FALLBACK_HEX);
  assert.equal(cssColorToHex('var(--nope, #123456)', read), '#123456');
  assert.equal(cssColorToHex('transparent', read), FALLBACK_HEX);
  assert.equal(cssColorToHex(undefined, read), FALLBACK_HEX);
  assert.notEqual(cssColorToHex('var(--green)', () => ''), '#000000');
});
