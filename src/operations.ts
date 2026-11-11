import { Gtfs } from 'gtfs';
import { validateConfig } from './config/options.ts';
import { checkSource } from './validation/checks.ts';
import type { AccessibilityConfig } from './types/config.ts';
import type {
  AccessibilityResult,
  AccessibilitySourceResult,
} from './types/result.ts';

/** Validate each configured source independently. Owned connections always close. */
export async function validateAccessibility(
  config: AccessibilityConfig,
): Promise<AccessibilityResult> {
  validateConfig(config);
  const results: AccessibilitySourceResult[] = [];
  // One instance keeps an in-memory import alive across all source reports.
  const gtfs = new Gtfs({
    database: config.database ?? { path: ':memory:' },
    sources: config.sources.map((source) =>
      source.schedule
        ? { ...source, schedule: source.schedule }
        : { sourceId: source.sourceId ?? 'default' },
    ),
    extensions: config.extensions ?? [],
    ...(config.reporting === undefined ? {} : { reporting: config.reporting }),
  });
  try {
    if (config.accessibility?.input !== 'database') {
      const result = await gtfs.import();
      if (
        !result.success ||
        result.errors.length > 0 ||
        result.sources.length !== config.sources.length ||
        result.sources.some((source) => !source.success)
      ) {
        throw new Error(
          'GTFS import failed; accessibility results were not generated',
          { cause: result },
        );
      }
    }
    await gtfs.database.withKysely({
      callback: async (client) => {
        for (const source of config.sources) {
          const sourceId = source.sourceId ?? 'default';
          // Repository queries are explicitly scoped as well as SQL aggregates.
          const scoped = new Gtfs({
            database: { client },
            sources: [{ sourceId }],
            extensions: config.extensions ?? [],
          });
          try {
            if ((await scoped.schedule.agency.count()) === 0) {
              throw new Error(
                `No imported agency data found for source ${sourceId}`,
              );
            }
            results.push(await checkSource(scoped, sourceId));
          } finally {
            await scoped.close();
          }
        }
      },
    });
    return {
      success: results.every((result) => result.success),
      sources: results,
    };
  } finally {
    await gtfs.close();
  }
}
