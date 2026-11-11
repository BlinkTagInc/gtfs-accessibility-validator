import type { Config } from './types.js';

import { clearLine, cursorTo } from 'node:readline';
import { noop } from 'lodash-es';
import * as colors from 'yoctocolors';
import Table from 'cli-table';

/*
 * Returns a log function based on config settings
 */
export function log(config: Config) {
  if (config.logLevel === 'silent') {
    return noop;
  }

  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string, overwrite?: boolean) => {
    if (overwrite === true && process.stdout.isTTY) {
      clearLine(process.stdout, 0);
      cursorTo(process.stdout, 0);
    }

    process.stdout.write(`${text}\n`);
  };
}

/*
 * Returns an warning log function based on config settings
 */
export function logWarning(config: Config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string) => {
    process.stdout.write(`\n${formatWarning(text)}\n`);
  };
}

/*
 * Returns an error log function based on config settings
 */
export function logError(config: Config) {
  if (config.logFunction) {
    return config.logFunction;
  }

  return (text: string) => {
    process.stdout.write(`\n${formatError(text)}\n`);
  };
}

/*
 * Format console warning text
 */
export function formatWarning(text: string) {
  const warningMessage = `${colors.underline('Warning')}: ${text}`;
  return colors.yellow(warningMessage);
}

/*
 * Format console error text
 */
export function formatError(error: string | Error) {
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
export function logStats(
  stats: { status: string; name: string; value: string }[],
  config: Config & { log: (text: string) => void },
) {
  // Hide stats table from custom log functions
  if (config.logFunction) {
    return;
  }

  const formatStatus = (status: string) => {
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

  for (const stat of stats) {
    table.push([formatStatus(stat.status), stat.name, stat.value]);
  }

  config.log(`\n${table.toString()}`);
}
