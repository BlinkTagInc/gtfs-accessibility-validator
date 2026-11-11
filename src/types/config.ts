import type { GtfsInstanceOptions, GtfsScheduleSourceConfig } from 'gtfs';

/** Shared settings use the node-GTFS v5 configuration structure. */
export interface AccessibilityConfig {
  readonly database?: GtfsInstanceOptions['database'];
  readonly reporting?: GtfsInstanceOptions['reporting'];
  readonly extensions?: GtfsInstanceOptions['extensions'];
  readonly sources: readonly {
    readonly sourceId?: string;
    readonly schedule?: GtfsScheduleSourceConfig;
  }[];
  readonly accessibility?: {
    /** Import schedules (default), or inspect previously imported data. */
    readonly input?: 'schedule' | 'database';
  };
}
