/*
 * Initialize configuration with defaults.
 */
export function setDefaultConfig(initialConfig) {
  const defaults = {
    sqlitePath: ':memory:',
    ignoreDuplicates: false,
  };

  return {
    ...defaults,
    ...initialConfig,
  };
}
