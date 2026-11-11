import type { AccessibilityConfig } from '../types/config.ts';

export function validateConfig(config: AccessibilityConfig): void {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Configuration must be an object');
  }
  const allowed = [
    'database',
    'sources',
    'reporting',
    'extensions',
    'accessibility',
  ];
  for (const key of Object.keys(config)) {
    if (!allowed.includes(key)) {
      throw new Error(
        `Unknown configuration option: ${key}. See the Configuration section in README.md for supported options.`,
      );
    }
  }
  if (config.accessibility !== undefined) {
    if (
      !config.accessibility ||
      typeof config.accessibility !== 'object' ||
      Array.isArray(config.accessibility)
    ) {
      throw new Error('accessibility must be an object');
    }
    for (const key of Object.keys(config.accessibility)) {
      if (key !== 'input') {
        throw new Error(`Unknown accessibility option: ${key}`);
      }
    }
    if (
      config.accessibility.input !== undefined &&
      !['schedule', 'database'].includes(config.accessibility.input)
    ) {
      throw new Error('accessibility.input must be schedule or database');
    }
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    throw new Error('sources must contain at least one source');
  }
  const ids = new Set<string>();
  for (const source of config.sources) {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new Error('Each source must be an object');
    }
    for (const key of Object.keys(source)) {
      if (!['sourceId', 'schedule'].includes(key)) {
        throw new Error(`Unknown source option: ${key}`);
      }
    }
    const id = source.sourceId ?? 'default';
    if (
      typeof id !== 'string' ||
      !id.trim() ||
      (config.sources.length > 1 && !source.sourceId) ||
      ids.has(id)
    ) {
      throw new Error(
        'Each source needs a unique, non-empty sourceId when using multiple sources',
      );
    }
    ids.add(id);
    if (config.accessibility?.input !== 'database' && !source.schedule) {
      throw new Error(`Source ${id} requires schedule.path or schedule.url`);
    }
    const required = [
      'agency.txt',
      'stops.txt',
      'trips.txt',
      'routes.txt',
      'levels.txt',
      'pathways.txt',
      'feed_info.txt',
    ];
    if (
      source.schedule?.excludeFiles?.some((file: string) =>
        required.includes(file),
      )
    ) {
      throw new Error('Cannot exclude files used by accessibility checks');
    }
  }
  if (
    config.accessibility?.input === 'database' &&
    !config.database?.client &&
    (!config.database?.path || config.database.path === ':memory:')
  ) {
    throw new Error(
      'Database input requires a persistent database.path or database.client',
    );
  }
}
