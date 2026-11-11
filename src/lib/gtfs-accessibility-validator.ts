import { Gtfs } from 'gtfs';
import { compact } from 'lodash-es';
// @ts-ignore
import ColorContrastChecker from 'color-contrast-checker';
import { log, logStats } from './log-utils.js';
import { setDefaultConfig } from './utils.js';
import { formatPercent } from './formatters.js';
import type { Config } from './types.js';

const ccc = new ColorContrastChecker();

// Keep aggregates in SQL rather than loading every trip and stop into memory.
const accessibilityCounts = (gtfs: Gtfs, sourceId: string) =>
  gtfs.database.withKysely({
    callback: async (db) => {
      const trips = db.selectFrom('trips').where('source_id', '=', sourceId);
      const stops = db.selectFrom('stops').where('source_id', '=', sourceId);
      const boardingStops = stops.where((eb) =>
        eb.or([
          eb('location_type', 'is', null),
          eb('location_type', '=', 0),
          eb('location_type', '=', 1),
        ]),
      );
      const totalTrips = await trips
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const accessibleTrips = await trips
        .where('wheelchair_accessible', 'is not', null)
        .where('wheelchair_accessible', '!=', 0)
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const totalStops = await boardingStops
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const accessibleStops = await boardingStops
        .where('wheelchair_boarding', 'is not', null)
        .where('wheelchair_boarding', '!=', 0)
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const allStops = await stops
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const ttsStops = await stops
        .where('tts_stop_name', 'is not', null)
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      return {
        trips: accessibleTrips.count / totalTrips.count,
        stops: accessibleStops.count / totalStops.count,
        tts: ttsStops.count / allStops.count,
      };
    },
  });

export const gtfsAccessibilityValidator = async (initialConfig: Config) => {
  const settings = setDefaultConfig(initialConfig);
  const config = { ...settings, log: log(settings) };
  if (config.ignoreErrors) {
    throw new Error(
      'ignoreErrors: true has no equivalent in gtfs v5. Fix the feed before validating.',
    );
  }
  if (!config.skipImport && !config.gtfsPath && !config.gtfsUrl) {
    throw new Error('No gtfsPath or gtfsUrl provided');
  }
  if (config.skipImport && config.sqlitePath === ':memory:') {
    throw new Error('skipImport requires a persistent v5 sqlitePath');
  }

  const gtfs = new Gtfs({
    database: { path: config.sqlitePath },
    sources: [{ sourceId: config.sourceId }],
    // All fields read by this validator, including levels/pathways/TTS, are core GTFS.
    extensions: [],
    reporting: {
      level: config.logLevel === 'warning' ? 'warn' : config.logLevel,
      reporter: (event) => {
        // Optional extensions are intentionally unused by this validator.
        if (
          event.type === 'validation:notice' &&
          event.notice.code === 'GTFS_EXTENSION_DISABLED'
        ) {
          return;
        }
        config.log(event.message);
      },
    },
  });
  try {
    if (!config.skipImport) {
      const result = await gtfs.import({
        sources: [
          {
            sourceId: config.sourceId,
            schedule: {
              ...(config.gtfsPath
                ? { path: config.gtfsPath }
                : {
                    url: config.gtfsUrl!,
                    timeoutMs: config.downloadTimeout,
                  }),
              excludeFiles: [
                'areas.txt',
                'attributions.txt',
                'booking_rules.txt',
                'calendar_dates.txt',
                'calendar.txt',
                'fare_attributes.txt',
                'fare_leg_join_rules.txt',
                'fare_leg_rules.txt',
                'fare_media.txt',
                'fare_products.txt',
                'fare_rules.txt',
                'fare_transfer_rules.txt',
                'frequencies.txt',
                'location_group_stops.txt',
                'location_groups.txt',
                'locations.geojson',
                'networks.txt',
                'rider_categories.txt',
                'route_networks.txt',
                'shapes.txt',
                'stop_areas.txt',
                'stop_times.txt',
                'timeframes.txt',
                'transfers.txt',
                'translations.txt',
              ],
              import: {
                validation: {
                  mode: 'off',
                  onDuplicateKey: config.ignoreDuplicates
                    ? 'keep-first'
                    : 'reject',
                },
              },
            },
          },
        ],
      });
      if (
        !result.success ||
        result.errors.length > 0 ||
        result.sources.length !== 1 ||
        !result.sources[0].success
      ) {
        throw new Error(
          'GTFS import failed; accessibility results were not generated',
          { cause: result },
        );
      }
    }

    const counts = await accessibilityCounts(gtfs, config.sourceId);
    const percentageTripsWithAccessibilityInfo = counts.trips;
    const percentageOfStopsWithaccessibilityInfo = counts.stops;
    const numberOfStopsWithTTS = counts.tts;
    const hasLevels = (await gtfs.schedule.levels.count()) > 0;
    const hasPathways = (await gtfs.schedule.pathways.count()) > 0;
    const routes = await gtfs.schedule.routes
      .select(
        'route_id',
        'route_short_name',
        'route_long_name',
        'route_color',
        'route_text_color',
      )
      .all();
    const routesWithInvalidContrast = compact(
      routes.map((route) => {
        if (!route.route_color || !route.route_text_color) {
          return;
        }
        if (
          ccc.isLevelAA(
            `#${route.route_text_color}`,
            `#${route.route_color}`,
            19,
          )
        ) {
          return;
        }
        return route;
      }),
    );
    const agencies = await gtfs.schedule.agency.select('agency_name').all();
    const feedInfos = await gtfs.schedule.feedInfo
      .select('feed_start_date', 'feed_end_date', 'feed_version')
      .all();
    const stats = [
      {
        id: 'tripsWithWheelchairAccessibility',
        name: 'Percentage of trips with wheelchair accessibility info',
        value: formatPercent(percentageTripsWithAccessibilityInfo),
        status: percentageTripsWithAccessibilityInfo === 1 ? 'pass' : 'fail',
      },
      {
        id: 'stopsWithWheelchairBoarding',
        name: 'Percentage of stops with wheelchair boarding info',
        value: formatPercent(percentageOfStopsWithaccessibilityInfo),
        status: percentageOfStopsWithaccessibilityInfo === 1 ? 'pass' : 'fail',
      },
      {
        id: 'stopsWithTTSStopName',
        name: 'Stops have text-to-speech value',
        value: numberOfStopsWithTTS > 0 ? 'yes' : 'no',
        status: numberOfStopsWithTTS > 0 ? 'pass' : 'fail',
      },
      {
        id: 'hasLevels',
        name: 'Has levels info',
        value: hasLevels ? 'yes' : 'no',
        status: hasLevels ? 'pass' : 'fail',
      },
      {
        id: 'hasPathways',
        name: 'Has pathways info',
        value: hasPathways ? 'yes' : 'no',
        status: hasPathways ? 'pass' : 'fail',
      },
      {
        id: 'routeColorContrastIsValid',
        name: 'Routes with invalid color contrast',
        value: `${routesWithInvalidContrast.length} routes`,
        status: routesWithInvalidContrast.length === 0 ? 'pass' : 'fail',
        routes: routesWithInvalidContrast,
      },
    ];

    logStats(stats, config);

    if (routesWithInvalidContrast.length > 0) {
      config.log(
        `Routes with invalid color contrast: ${routesWithInvalidContrast.map((route) => route.route_short_name ?? route.route_long_name).join(', ')}`,
        true,
      );
      config.log('', true);
    }

    const agencyName = agencies.map((agency) => agency.agency_name).join(', ');
    const feedVersion = feedInfos
      .map((feedInfo) => feedInfo.feed_version)
      .join(', ');
    const feedStartDate = feedInfos
      .map((feedInfo) => feedInfo.feed_start_date)
      .join(', ');
    const feedEndDate = feedInfos
      .map((feedInfo) => feedInfo.feed_end_date)
      .join(', ');

    config.log(`Agency: ${agencyName}`, true);
    config.log(`Feed Version: ${feedVersion}`, true);
    config.log(`Feed Start Date: ${feedStartDate}`, true);
    config.log(`Feed End Date: ${feedEndDate}`, true);
    config.log('', true);

    return {
      stats,
      agency: agencyName,
      feed_version: feedVersion,
      feed_start_date: feedStartDate,
      feed_end_date: feedEndDate,
    };
  } finally {
    await gtfs.close();
  }
};

export default gtfsAccessibilityValidator;
