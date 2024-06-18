import { clearLine, cursorTo } from 'node:readline';
import { noop } from 'lodash-es';
import * as colors from 'yoctocolors';
import Table from 'cli-table';

import { formatPercent } from './formatters.js';

/*
 * Returns a log function based on config settings
 */
export function log(config) {
  if (config.verbose === false) {
    return noop;
  }

  if (config.logFunction) {
    return config.logFunction;
  }

  return (text, overwrite) => {
    if (overwrite === true && process.stdout.isTTY) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
    } else {
      process.stdout.write('\n');
    }

    process.stdout.write(text);
  };
}

/*
 * Returns an warning log function based on config settings
 */
export function logWarning(config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text) => {
    process.stdout.write(`\n${formatWarning(text)}\n`);
  };
}

/*
 * Returns an error log function based on config settings
 */
export function logError(config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text) => {
    process.stdout.write(`\n${formatError(text)}\n`);
  };
}

/*
 * Format console warning text
 */
export function formatWarning(text) {
  const warningMessage = `${colors.underline('Warning')}: ${text}`;
  return colors.yellow(warningMessage);
}

/*
 * Format console error text
 */
export function formatError(error) {
  const messageText = error instanceof Error ? error.message : error;
  const errorMessage = `${colors.underline('Error')}: ${messageText.replace(
    'Error: ',
    '',
  )}`;
  return colors.red(errorMessage);
}

/*
 * Print a table of stats to the console.
 */
export function logStats(stats, config) {
  // Hide stats table from custom log functions
  if (config.logFunction) {
    return;
  }

  const formatStatus = (status) => {
    if (status === 'pass') {
      return colors.green('✔ pass');
    } else if (status === 'fail') {
      return colors.red('✘ fail');
    }

    return '';
  };

  const table = new Table({
    colWidths: [10, 80, 10],
    head: ['Status', 'Item', 'Value'],
  });

  table.push(
    [
      formatStatus(stats.trips_with_wheelchair_accessibility.status),
      'Percentage of trips with wheelchair accessibility info',
      formatPercent(stats.trips_with_wheelchair_accessibility.value),
    ],
    [
      formatStatus(stats.stops_with_wheelchair_boarding.status),
      'Percentage of stops with wheelchair boarding info',
      formatPercent(stats.stops_with_wheelchair_boarding.value),
    ],
    [
      formatStatus(stats.stops_with_tts.status),
      'Stops use tts_stop_name field',
      stats.stops_with_tts.value,
    ],
    [formatStatus(stats.levels.status), 'Has levels.txt', stats.levels.value],
    [
      formatStatus(stats.pathways.status),
      'Has pathways.txt',
      stats.pathways.value,
    ],
    [
      formatStatus(stats.routes_with_invalid_color_contrast.status),
      'Routes with invalid color contrast',
      stats.routes_with_invalid_color_contrast.value,
    ],
  );

  config.log(table.toString());
}
