import { openDb, importGtfs } from 'gtfs';
import { compact } from 'lodash-es';
// @ts-ignore
import ColorContrastChecker from 'color-contrast-checker';
import { log, logWarning, logError, logStats } from './log-utils.js';
import { setDefaultConfig } from './utils.js';

const ccc = new ColorContrastChecker();

interface IConfig {
  sqlitePath?: string;
  gtfsPath?: string;
  gtfsUrl?: string;
  skipImport?: boolean;
  log?: (text: string, overwrite?: boolean) => void;
  logWarning?: (text: string) => void;
  logError?: (text: string) => void;
}

interface IRoute {
  route_id: string;
  route_short_name?: string;
  route_long_name?: string;
  route_color?: string;
  route_text_color?: string;
}

const validateTripsWithaccessibilityInfo = (config: IConfig) => {
  const db = openDb(config);

  const totalTripCount = db.prepare(`SELECT count(*) FROM trips`).get();
  const wheelchairAccessibleTripCount = db
    .prepare(
      `SELECT count(*) FROM trips WHERE wheelchair_accessible IS NOT NULL`,
    )
    .get();
  return wheelchairAccessibleTripCount['count(*)'] / totalTripCount['count(*)'];
};

const validateStopsWithaccessibilityInfo = (config: IConfig) => {
  const db = openDb(config);

  const totalStopCount = db.prepare(`SELECT count(*) FROM stops`).get();
  const wheelchairAccessibleStopCount = db
    .prepare(`SELECT count(*) FROM stops WHERE wheelchair_boarding IS NOT NULL`)
    .get();
  return wheelchairAccessibleStopCount['count(*)'] / totalStopCount['count(*)'];
};

const validateStopsWithTTS = (config: IConfig) => {
  const db = openDb(config);

  const totalStopCount = db.prepare(`SELECT count(*) FROM stops`).get();
  const stopsWithTTSCount = db
    .prepare(`SELECT count(*) FROM stops WHERE tts_stop_name IS NOT NULL`)
    .get();
  return stopsWithTTSCount['count(*)'] / totalStopCount['count(*)'];
};

const validateLevels = (config: IConfig) => {
  const db = openDb(config);

  const levels = db.prepare(`SELECT * FROM levels`).all();
  return levels.length > 0;
};

const validatePathways = (config: IConfig) => {
  const db = openDb(config);

  const pathways = db.prepare(`SELECT * FROM pathways`).all();
  return pathways.length > 0;
};

const validateRouteColorContrast = (config: IConfig) => {
  const db = openDb(config);

  const routes: IRoute[] = db
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
export const gtfsAccessibilityValidator = async (initialConfig: IConfig) => {
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

  const outputStats = {
    trips_with_wheelchair_accessibility: {
      value: percentageTripsWithAccessibilityInfo,
      status: percentageTripsWithAccessibilityInfo === 1 ? 'pass' : 'fail',
    },
    stops_with_wheelchair_boarding: {
      value: percentageOfStopsWithaccessibilityInfo,
      status: percentageOfStopsWithaccessibilityInfo === 1 ? 'pass' : 'fail',
    },
    stops_with_tts: {
      value: numberOfStopsWithTTS > 0 ? '✔' : '✘',
      status: numberOfStopsWithTTS > 0 ? 'pass' : 'fail',
    },
    levels: {
      value: hasLevels ? '✔' : '✘',
      status: hasLevels ? 'pass' : 'fail',
    },
    pathways: {
      value: hasPathways ? '✔' : '✘',
      status: hasPathways ? 'pass' : 'fail',
    },
    routes_with_invalid_color_contrast: {
      value: routesWithInvalidContrast.length,
      status: routesWithInvalidContrast.length === 0 ? 'pass' : 'fail',
      routesWithInvalidContrast,
    },
  };

  logStats(outputStats, config);

  if (routesWithInvalidContrast.length > 0) {
    config.log(
      `Routes with invalid color contrast: ${routesWithInvalidContrast.map((route) => route.route_short_name ?? route.route_long_name).join(', ')}`,
      true,
    );
  }

  config.log('');

  return outputStats;
};

export default gtfsAccessibilityValidator;
