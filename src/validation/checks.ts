import type { Gtfs } from 'gtfs';
import type {
  AccessibilityCheck,
  AccessibilitySourceResult,
} from '../types/result.ts';
import { hasValidContrast } from './contrast.ts';
import { formatPercent } from '../reporting/format.ts';

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
        .where('wheelchair_accessible', 'in', [1, 2])
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const totalStops = await boardingStops
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const accessibleStops = await boardingStops
        .where('wheelchair_boarding', 'in', [1, 2])
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const allStops = await stops
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      const ttsStops = await stops
        .where('tts_stop_name', 'is not', null)
        .where((eb) => eb(eb.fn<string>('trim', ['tts_stop_name']), '!=', ''))
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .executeTakeFirstOrThrow();
      return {
        trips: accessibleTrips.count / totalTrips.count,
        stops: accessibleStops.count / totalStops.count,
        tts: ttsStops.count / allStops.count,
      };
    },
  });

export async function checkSource(
  gtfs: Gtfs,
  sourceId: string,
): Promise<AccessibilitySourceResult> {
  const counts = await accessibilityCounts(gtfs, sourceId);
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
  const routesWithInvalidContrast = routes.filter((route) => {
    return !hasValidContrast(route.route_color, route.route_text_color);
  });
  const agencies = await gtfs.schedule.agency.select('agency_name').all();
  const feedInfos = await gtfs.schedule.feedInfo
    .select('feed_start_date', 'feed_end_date', 'feed_version')
    .all();
  const checks: AccessibilityCheck[] = [
    {
      id: 'tripsWithWheelchairAccessibility',
      name: 'Percentage of trips with wheelchair accessibility info',
      value: formatPercent(counts.trips),
      status: Number.isNaN(counts.trips)
        ? 'not-applicable'
        : counts.trips === 1
          ? 'pass'
          : 'fail',
    },
    {
      id: 'stopsWithWheelchairBoarding',
      name: 'Percentage of stops with wheelchair boarding info',
      value: formatPercent(counts.stops),
      status: Number.isNaN(counts.stops)
        ? 'not-applicable'
        : counts.stops === 1
          ? 'pass'
          : 'fail',
    },
    {
      id: 'stopsWithTTSStopName',
      name: 'Stops have text-to-speech value',
      value: counts.tts > 0 ? 'yes' : 'no',
      status: counts.tts > 0 ? 'pass' : 'fail',
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

  return {
    sourceId,
    success: checks.every((check) => check.status !== 'fail'),
    checks,
    agencies: agencies.map((agency) => agency.agency_name),
    feedInfo: feedInfos.map((feed) => ({
      version: feed.feed_version,
      startDate: feed.feed_start_date,
      endDate: feed.feed_end_date,
    })),
  };
}
