import { parseArgs } from 'node:util';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createConsoleReporter } from 'gtfs';
import { validateAccessibility } from '../operations.ts';
import { formatResult } from '../reporting/format.ts';
import type { AccessibilityConfig } from '../types/config.ts';
import packageJson from '../../package.json' with { type: 'json' };

const help = `Validate accessibility information in GTFS Schedule feeds.

Usage: gtfs-accessibility-validator [options]

  --config, -c <path>       JSON configuration [default: config.json if present]
  --input <path>           GTFS ZIP or directory; replaces configured sources
  --url <url>              GTFS ZIP URL; replaces configured sources
  --database <path>        SQLite database [default: :memory:]
  --source-id <id>         Identity for direct input or database inspection
  --from-database          Inspect previously imported data
  --log-level <level>      silent, error, warn, info [default: info]
  --json                   Write the result as JSON
  --help, -h               Show help
  --version, -v            Show version

Exit codes: 0 checks pass, 1 operation/configuration error, 2 failed checks.
`;

export async function runCli(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      config: { type: 'string', short: 'c' },
      input: { type: 'string' },
      url: { type: 'string' },
      database: { type: 'string' },
      'source-id': { type: 'string' },
      'from-database': { type: 'boolean' },
      'log-level': { type: 'string' },
      json: { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    strict: true,
    allowPositionals: false,
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  if (values.version) {
    process.stdout.write(`${packageJson.version}\n`);
    return;
  }
  if (values.input !== undefined && values.url !== undefined) {
    throw new Error('Use either --input or --url, not both');
  }
  if (
    values['from-database'] &&
    (values.input !== undefined || values.url !== undefined)
  ) {
    throw new Error('--from-database cannot be combined with --input or --url');
  }
  const configPath =
    values.config ?? (existsSync('config.json') ? 'config.json' : undefined);
  const loaded: AccessibilityConfig = configPath
    ? JSON.parse(await readFile(configPath, 'utf8'))
    : {};
  if (!loaded || typeof loaded !== 'object' || Array.isArray(loaded)) {
    throw new Error('Configuration must be an object');
  }
  const level = values['log-level'] ?? loaded.reporting?.level ?? 'info';
  if (!['silent', 'error', 'warn', 'info'].includes(level)) {
    throw new Error('--log-level must be silent, error, warn, or info');
  }
  if (
    values['source-id'] !== undefined &&
    !values.input &&
    !values.url &&
    !values['from-database']
  ) {
    throw new Error('--source-id requires --input, --url, or --from-database');
  }
  const direct = values.input !== undefined || values.url !== undefined;
  const config: AccessibilityConfig = {
    ...loaded,
    ...(values.database === undefined
      ? {}
      : { database: { path: values.database } }),
    sources: direct
      ? [
          {
            sourceId: values['source-id'] ?? 'default',
            schedule:
              values.input !== undefined
                ? { path: values.input }
                : { url: values.url! },
          },
        ]
      : values['from-database'] &&
          (values['source-id'] !== undefined || !loaded.sources)
        ? [{ sourceId: values['source-id'] ?? 'default' }]
        : loaded.sources,
    ...(values['from-database']
      ? { accessibility: { ...loaded.accessibility, input: 'database' } }
      : {}),
    reporting: {
      ...loaded.reporting,
      level: level as 'silent' | 'error' | 'warn' | 'info',
      reporter: createConsoleReporter(),
    },
  };
  const result = await validateAccessibility(config);
  process.stdout.write(
    values.json ? `${JSON.stringify(result, null, 2)}\n` : formatResult(result),
  );
  process.exitCode = result.success ? 0 : 2;
}
