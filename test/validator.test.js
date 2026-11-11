import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Gtfs } from 'gtfs';
import validate from '../dist/index.js';

const fixture = resolve('test/fixtures/accessibility');
const expected = JSON.parse(
  await readFile('test/fixtures/expected-v4.json', 'utf8'),
);
const options = { gtfsPath: fixture, logLevel: 'silent' };

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'accessibility-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function variant(t) {
  const directory = await temporary(t);
  const feed = join(directory, 'feed');
  await cp(fixture, feed, { recursive: true });
  return { directory, feed };
}

test('in-memory report exactly matches the captured v4 result', async () => {
  assert.deepEqual(await validate(options), expected);
});

test('persistent import, close, and reopen preserve the report', async (t) => {
  const sqlitePath = join(await temporary(t), 'v5.sqlite');
  assert.deepEqual(await validate({ ...options, sqlitePath }), expected);
  assert.deepEqual(
    await validate({ sqlitePath, skipImport: true, logLevel: 'silent' }),
    expected,
  );
});

test('overlapping IDs in a shared database stay source scoped', async (t) => {
  const { directory, feed } = await variant(t);
  const sqlitePath = join(directory, 'v5.sqlite');
  await writeFile(
    join(feed, 'agency.txt'),
    (await readFile(join(feed, 'agency.txt'), 'utf8')).replace(
      'Fixture Transit',
      'Other Transit',
    ),
  );
  await writeFile(
    join(feed, 'trips.txt'),
    'route_id,service_id,trip_id,wheelchair_accessible\n01,d,t1,1\n',
  );
  await validate({ ...options, sqlitePath, sourceId: 'first' });
  const other = await validate({
    ...options,
    gtfsPath: feed,
    sqlitePath,
    sourceId: 'second',
  });
  assert.equal(other.agency, 'Other Transit');
  assert.equal(other.stats[0].value, '100%');
  assert.deepEqual(
    await validate({
      sqlitePath,
      sourceId: 'first',
      skipImport: true,
      logLevel: 'silent',
    }),
    expected,
  );
});

test('concurrent in-memory validations do not share a database', async () => {
  const results = await Promise.all([validate(options), validate(options)]);
  assert.deepEqual(results, [expected, expected]);
});

test('missing optional data and empty denominators keep existing fallbacks', async (t) => {
  const { feed } = await variant(t);
  for (const filename of ['levels.txt', 'pathways.txt', 'feed_info.txt']) {
    await rm(join(feed, filename));
  }
  await writeFile(
    join(feed, 'trips.txt'),
    'route_id,service_id,trip_id,wheelchair_accessible\n',
  );
  await writeFile(
    join(feed, 'stops.txt'),
    'stop_id,stop_name,stop_lat,stop_lon\n',
  );
  const result = await validate({ ...options, gtfsPath: feed });
  assert.deepEqual(
    result.stats.slice(0, 5).map(({ value, status }) => [value, status]),
    [
      ['', 'fail'],
      ['', 'fail'],
      ['no', 'fail'],
      ['no', 'fail'],
      ['no', 'fail'],
    ],
  );
  assert.equal(result.feed_version, '');
  assert.equal(result.feed_start_date, '');
  assert.equal(result.feed_end_date, '');
});

test('duplicate policy translates and a failed replacement preserves old data', async (t) => {
  const { directory, feed } = await variant(t);
  const sqlitePath = join(directory, 'v5.sqlite');
  await validate({ ...options, sqlitePath });
  await writeFile(
    join(feed, 'trips.txt'),
    (await readFile(join(feed, 'trips.txt'), 'utf8')) + '01,d,t1,0\n',
  );
  await assert.rejects(validate({ ...options, gtfsPath: feed, sqlitePath }));
  assert.deepEqual(
    await validate({ sqlitePath, skipImport: true, logLevel: 'silent' }),
    expected,
  );
  assert.deepEqual(
    await validate({ ...options, gtfsPath: feed, ignoreDuplicates: true }),
    expected,
  );
});

test('owned instances close on successful and failed operations', async (t) => {
  const originalClose = Gtfs.prototype.close;
  let closes = 0;
  t.mock.method(Gtfs.prototype, 'close', async function () {
    closes += 1;
    return originalClose.call(this);
  });
  await validate(options);
  await assert.rejects(
    validate({ ...options, gtfsPath: '/nonexistent/accessibility-feed.zip' }),
  );
  assert.equal(closes, 2);
});

test('unsuccessful import results never produce accessibility output', async (t) => {
  t.mock.method(Gtfs.prototype, 'import', async () => ({
    success: false,
    errors: [],
    sources: [],
    validation: {},
  }));
  await assert.rejects(validate(options), /import failed/);
});

test('unsupported legacy settings and memory reuse fail clearly', async () => {
  await assert.rejects(
    validate({ ...options, ignoreErrors: true }),
    /no equivalent/,
  );
  await assert.rejects(
    validate({ skipImport: true }),
    /persistent v5 sqlitePath/,
  );
});

test('CLI imports and reopens a named source with the same report', async (t) => {
  const sqlitePath = join(await temporary(t), 'v5.sqlite');
  const cli = 'dist/bin/gtfs-accessibility-validator.js';
  const imported = execFileSync(
    process.execPath,
    [
      cli,
      '--gtfsPath',
      fixture,
      '--sqlitePath',
      sqlitePath,
      '--sourceId',
      'cli',
    ],
    { encoding: 'utf8' },
  );
  const reopened = execFileSync(
    process.execPath,
    [cli, '--skipImport', '--sqlitePath', sqlitePath, '--sourceId', 'cli'],
    { encoding: 'utf8' },
  );
  for (const output of [imported, reopened]) {
    assert.match(output, /50%/);
    assert.match(output, /66\.7%/);
    assert.match(output, /Agency: Fixture Transit/);
    assert.match(output, /Feed Start Date: 20260101/);
  }
});
