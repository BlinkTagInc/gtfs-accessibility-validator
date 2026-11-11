import type { Config } from './types.js';

/*
 * Initialize configuration with defaults.
 */
export function setDefaultConfig(initialConfig: Config) {
  const defaults = {
    sqlitePath: ':memory:',
    ignoreDuplicates: false,
    sourceId: 'default',
    downloadTimeout: 30_000,
    logLevel: 'info' as const,
  };

  return {
    ...defaults,
    ...initialConfig,
  };
}
