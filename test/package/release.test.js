import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('packed package contains runnable ESM, CLI, types and public documentation', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'validator-package-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const packOutput = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--ignore-scripts', '--json', '--pack-destination', directory],
      { encoding: 'utf8' },
    ),
  );
  const packed = Array.isArray(packOutput)
    ? packOutput[0]
    : Object.values(packOutput)[0];
  const files = packed.files.map((file) => file.path);
  for (const file of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/bin/gtfs-accessibility-validator.js',
    'README.md',
    'LICENSE.md',
    'CHANGELOG.md',
    'config-sample.json',
    'config-sample-full.json',
  ]) {
    assert.ok(files.includes(file), file);
  }
  assert.ok(
    !files.some((file) => file.startsWith('src/') || file.startsWith('test/')),
  );
  execFileSync('tar', [
    '-xzf',
    join(directory, packed.filename),
    '-C',
    directory,
  ]);
  await symlink(
    resolve('node_modules'),
    join(directory, 'package/node_modules'),
    'dir',
  );
  const validation = spawnSync(
    process.execPath,
    [
      join(directory, 'package/dist/bin/gtfs-accessibility-validator.js'),
      '--input',
      resolve('test/fixtures/accessibility'),
      '--json',
      '--log-level',
      'silent',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(validation.status, 2, validation.stderr);
  assert.equal(
    JSON.parse(validation.stdout).sources[0].agencies[0],
    'Fixture Transit',
  );
});
