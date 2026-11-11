import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasValidContrast } from '../../src/validation/contrast.ts';

test('contrast handles defaults, malformed colors and the large-text boundary', () => {
  assert.equal(hasValidContrast(null, null), true);
  assert.equal(hasValidContrast('000000', null), false);
  assert.equal(hasValidContrast(null, 'FFFFFF'), false);
  assert.equal(hasValidContrast('FFFFFF', '949494'), true);
  assert.equal(hasValidContrast('FFFFFF', '959595'), false);
  assert.equal(hasValidContrast('zzzzzz', '000000'), false);
  assert.equal(hasValidContrast('#FFFFFF', '000000'), false);
});
