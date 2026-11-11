import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, cp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Gtfs } from 'gtfs';
import { validateAccessibility } from '../../dist/index.js';

const fixture = resolve('test/fixtures/accessibility');
const cli = resolve('dist/bin/gtfs-accessibility-validator.js');
async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'accessibility-v1-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}
const run = (args, options = {}) =>
  spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', ...options });

test('multiple sources produce isolated reports in one in-memory operation', async (t) => {
  const feed = join(await temporary(t), 'feed');
  await cp(fixture, feed, { recursive: true });
  await writeFile(
    join(feed, 'trips.txt'),
    'route_id,service_id,trip_id,wheelchair_accessible\n01,d,t1,1\n',
  );
  await rm(join(feed, 'pathways.txt'));
  const result = await validateAccessibility({
    sources: [
      { sourceId: 'one', schedule: { path: fixture } },
      { sourceId: 'two', schedule: { path: feed } },
    ],
  });
  assert.equal(result.success, false);
  assert.deepEqual(
    result.sources.map((source) => source.checks[0].value),
    ['50%', '100%'],
  );
  assert.deepEqual(
    result.sources.map((source) => source.checks[4].value),
    ['yes', 'no'],
  );
});

test('invalid wheelchair values and blank TTS names do not pass', async (t) => {
  const feed = join(await temporary(t), 'feed');
  await cp(fixture, feed, { recursive: true });
  await writeFile(
    join(feed, 'trips.txt'),
    'route_id,service_id,trip_id,wheelchair_accessible\n01,d,t1,3\n',
  );
  await writeFile(
    join(feed, 'stops.txt'),
    'stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding,tts_stop_name\ns,Stop,37,-122,9,"   "\n',
  );
  await assert.rejects(
    validateAccessibility({ sources: [{ schedule: { path: feed } }] }),
  );
  await writeFile(
    join(feed, 'trips.txt'),
    'route_id,service_id,trip_id,wheelchair_accessible\n01,d,t1,0\n',
  );
  await writeFile(
    join(feed, 'stops.txt'),
    'stop_id,stop_name,stop_lat,stop_lon,wheelchair_boarding,tts_stop_name\ns,Stop,37,-122,0,"   "\n',
  );
  const result = await validateAccessibility({
    sources: [{ schedule: { path: feed } }],
  });
  assert.deepEqual(
    result.sources[0].checks.slice(0, 3).map(({ value }) => value),
    ['0%', '0%', 'no'],
  );
});

test('unknown database sources reject rather than returning an empty report', async (t) => {
  const path = join(await temporary(t), 'gtfs.sqlite');
  await validateAccessibility({
    database: { path },
    sources: [{ schedule: { path: fixture } }],
  });
  await assert.rejects(
    validateAccessibility({
      database: { path },
      sources: [{ sourceId: 'missing' }],
      accessibility: { input: 'database' },
    }),
    /No imported agency/,
  );
});

test('CLI JSON remains parseable under forced color and failed checks exit 2', () => {
  const result = run(['--input', fixture, '--json'], {
    env: { ...process.env, FORCE_COLOR: '1' },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).sources[0].sourceId, 'default');
  assert.equal(result.stdout.includes(String.fromCharCode(27)), false);
});

test('CLI imports, reopens and uses config overrides with silent diagnostics', async (t) => {
  const directory = await temporary(t);
  const path = join(directory, 'gtfs.sqlite');
  const imported = run([
    '--input',
    fixture,
    '--database',
    path,
    '--source-id',
    'cli',
    '--json',
    '--log-level',
    'silent',
  ]);
  assert.equal(imported.status, 2, imported.stderr);
  assert.equal(imported.stderr, '');
  const reopened = run([
    '--from-database',
    '--database',
    path,
    '--source-id',
    'cli',
    '--json',
    '--log-level',
    'silent',
  ]);
  assert.equal(reopened.status, 2, reopened.stderr);
  assert.deepEqual(JSON.parse(reopened.stdout), JSON.parse(imported.stdout));
  await writeFile(
    join(directory, 'config.json'),
    JSON.stringify({ sources: [{ schedule: { path: '/missing' } }] }),
  );
  const override = run(
    ['--input', fixture, '--json', '--log-level', 'silent'],
    { cwd: directory },
  );
  assert.equal(override.status, 2, override.stderr);
});

test('CLI help/version and invalid arguments have predictable exits', () => {
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--version']).status, 0);
  for (const args of [
    ['--gtfsPath', fixture],
    ['--input', fixture, '--url', 'https://example.com'],
    ['--input', fixture, '--from-database'],
    ['--log-level', 'debug'],
    ['--source-id', 'x'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Error:/);
  }
});

test('borrowed database clients remain usable and reporting respects silent level', async () => {
  const owner = new Gtfs({
    database: { path: ':memory:' },
    sources: [{ schedule: { path: fixture } }],
    extensions: [],
  });
  try {
    await owner.import();
    await owner.database.withKysely({
      callback: async (client) => {
        const events = [];
        const result = await validateAccessibility({
          database: { client },
          sources: [{}],
          accessibility: { input: 'database' },
          reporting: {
            level: 'silent',
            reporter: (event) => events.push(event),
          },
        });
        assert.equal(result.sources[0].agencies[0], 'Fixture Transit');
        assert.deepEqual(events, []);
        assert.ok(
          (await client.selectFrom('trips').selectAll().execute()).length > 0,
        );
      },
    });
    assert.ok((await owner.schedule.trips.count()) > 0);
  } finally {
    await owner.close();
  }
});
