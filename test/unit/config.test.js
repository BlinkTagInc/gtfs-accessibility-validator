import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateAccessibility } from '../../dist/index.js';

test('invalid configuration is rejected before importing', async () => {
  for (const config of [
    null,
    [],
    {},
    { sources: [] },
    { sources: [null] },
    { sources: [{}] },
    { sources: [{ sourceId: 'x' }, { sourceId: 'x' }] },
    { sources: [{}], accessibility: { input: 'invalid' } },
    { sources: [{}], accessibility: { typo: true } },
    { sources: [{ schedule: { path: 'feed', excludeFiles: ['stops.txt'] } }] },
    { sources: [{ schedule: { path: 'feed' } }], skipImport: true },
  ]) {
    await assert.rejects(validateAccessibility(config));
  }
});
