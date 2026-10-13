import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTRY_CODES, LEVELS, validateFields } from '../supabase/functions/_shared/validation.js';

const sample = { full_name: 'Aïcha Bello', email: 'aicha@example.com', country: 'NG', french_level: 'B1' };
test('normalises before validation without changing plus-addressing', () => {
  const result = validateFields({ ...sample, full_name: '  Aïcha   Bello ', email: ' AICHA+French@Example.COM ', country: ' ng ' });
  assert.equal(result.valid, true);
  assert.deepEqual(result.data, { ...sample, full_name: 'Aïcha Bello', email: 'aicha+french@example.com' });
});
test('all defined levels and 249 country codes are supported', () => {
  assert.equal(new Set(COUNTRY_CODES).size, 249);
  for (const french_level of Object.keys(LEVELS)) assert.equal(validateFields({ ...sample, french_level }).valid, true);
});
test('rejects empty values, unknown levels/countries and malformed email', () => {
  assert.equal(Object.keys(validateFields({}).errors).length, 4);
  for (const email of ['not-email','a..b@example.com','.a@example.com','a.@example.com','a@-example.com','a@example','a@' + 'x'.repeat(64) + '.com','a'.repeat(65)+'@example.com','a@example.com\nBcc:evil']) assert.equal(validateFields({ ...sample, email }).valid, false, email);
  assert.equal(validateFields({ ...sample, french_level: '__proto__' }).valid, false);
  assert.equal(validateFields({ ...sample, country: 'ZZ' }).valid, false);
  assert.equal(validateFields({ ...sample, full_name: 'A\nB' }).valid, false);
});
