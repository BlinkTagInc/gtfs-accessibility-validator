import type { GtfsReportingLevel } from 'gtfs';

export interface Config {
  sqlitePath?: string;
  sourceId?: string;
  ignoreDuplicates?: boolean;
  downloadTimeout?: number;
  /** v5 cannot reproduce ignoreErrors: true; it is rejected explicitly. */
  ignoreErrors?: boolean;
  logLevel?: GtfsReportingLevel | 'warning';
  logFunction?: (text: string, overwrite?: boolean) => void;
  gtfsPath?: string;
  gtfsUrl?: string;
  skipImport?: boolean;
}
