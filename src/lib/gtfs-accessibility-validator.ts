import { openDb, importGtfs, getAgencies, getFeedInfo } from 'gtfs';
import { compact } from 'lodash-es';
// @ts-ignore
import ColorContrastChecker from 'color-contrast-checker';
import { log, logWarning, logError, logStats } from './log-utils.js';
import { setDefaultConfig } from './utils.js';
import { formatPercent } from './formatters.js';

const ccc = new ColorContrastChecker();

interface Config {
  sqlitePath?: string;
  ignoreDuplicates?: boolean;
  downloadTimeout?: number;
  ignoreErrors?: boolean;
  verbose?: boolean;
  logFunction?: (text: string, overwrite?: boolean) => void;
  gtfsPath?: string;
  gtfsUrl?: string;
  skipImport?: boolean;
}

interface Route {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_color?: string;
  route_text_color?: string;
}

const validateTripsWithaccessibilityInfo = (config: Config) => {
  const db = openDb(config);

  const totalTripCount = db.prepare(`SELECT count(*) FROM trips`).get();
  const wheelchairAccessibleTripCount = db
    .prepare(
      `SELECT count(*) FROM trips WHERE wheelchair_accessible IS NOT NULL AND wheelchair_accessible != 0`,
    )
    .get();
  return wheelchairAccessibleTripCount['count(*)'] / totalTripCount['count(*)'];
};

const validateStopsWithaccessibilityInfo = (config: Config) => {
  const db = openDb(config);

  const totalStopCount = db
    .prepare(
      `SELECT count(*) FROM stops WHERE location_type IS NULL OR location_type = 0 OR location_type = 1`,
    )
    .get();
  const wheelchairAccessibleStopCount = db
    .prepare(
      `SELECT count(*) FROM stops WHERE wheelchair_boarding IS NOT NULL AND wheelchair_boarding != 0 AND (location_type IS NULL OR location_type = 0 OR location_type = 1)`,
    )
    .get();
  return wheelchairAccessibleStopCount['count(*)'] / totalStopCount['count(*)'];
};

const validateStopsWithTTS = (config: Config) => {
  const db = openDb(config);

  const totalStopCount = db.prepare(`SELECT count(*) FROM stops`).get();
  const stopsWithTTSCount = db
    .prepare(`SELECT count(*) FROM stops WHERE tts_stop_name IS NOT NULL`)
    .get();
  return stopsWithTTSCount['count(*)'] / totalStopCount['count(*)'];
};

const validateLevels = (config: Config) => {
  const db = openDb(config);

  const levels = db.prepare(`SELECT * FROM levels`).all();
  return levels.length > 0;
};

const validatePathways = (config: Config) => {
  const db = openDb(config);

  const pathways = db.prepare(`SELECT * FROM pathways`).all();
  return pathways.length > 0;
};

const validateRouteColorContrast = (config: Config) => {
  const db = openDb(config);

  const routes: Route[] = db
    .prepare(
      `SELECT route_id, route_short_name, route_long_name, route_color, route_text_color FROM routes`,
    )
    .all();

  return compact(
    routes.map((route) => {
      if (!route.route_color || !route.route_text_color) {
        return;
      }

      const contrastIsValid = ccc.isLevelAA(
        `#${route.route_text_color}`,
        `#${route.route_color}`,
        19,
      );

      if (contrastIsValid) {
        return;
      }

      return route;
    }),
  );
};

/*
 * Validate GTFS Accessibility
 */
export const gtfsAccessibilityValidator = async (initialConfig: Config) => {
  const config = setDefaultConfig(initialConfig);
  config.log = log(config);
  config.logWarning = logWarning(config);
  config.logError = logError(config);

  try {
    openDb(config);
  } catch (error: any) {
    if (error?.code === 'SQLITE_CANTOPEN') {
      config.logError(
        `Unable to open sqlite database "${config.sqlitePath}" defined as \`sqlitePath\` config.json. Ensure the parent directory exists or remove \`sqlitePath\` from config.json.`,
      );
    }

    throw error;
  }

  if (!config.gtfsPath && !config.gtfsUrl) {
    throw new Error('No gtfsPath or gtfsUrl provided');
  }

  if (!config.skipImport) {
    // Import GTFS
    await importGtfs({
      ...config,
      agencies: [
        {
          path: config.gtfsPath,
          url: config.gtfsUrl,
          exclude: [
            'areas',
            'attributions',
            'booking_rules',
            'calendar_dates',
            'calendar',
            'fare_attributes',
            'fare_leg_rules',
            'fare_media',
            'fare_products',
            'fare_rules',
            'fare_transfer_rules',
            'frequencies',
            'location_group_stops',
            'location_groups',
            'locations',
            'networks',
            'route_networks',
            'shapes',
            'stop_areas',
            'stop_times',
            'timeframes',
            'transfers',
            'translations',
          ],
        },
      ],
    });
  }

  const percentageTripsWithAccessibilityInfo =
    validateTripsWithaccessibilityInfo(config);
  const percentageOfStopsWithaccessibilityInfo =
    validateStopsWithaccessibilityInfo(config);
  const numberOfStopsWithTTS = validateStopsWithTTS(config);
  const hasLevels = validateLevels(config);
  const hasPathways = validatePathways(config);
  const routesWithInvalidContrast = validateRouteColorContrast(config);
  const agencies = getAgencies({}, ['agency_name']);
  const feedInfos = getFeedInfo({}, [
    'feed_start_date',
    'feed_end_date',
    'feed_version',
  ]);

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
};

export default gtfsAccessibilityValidator;
