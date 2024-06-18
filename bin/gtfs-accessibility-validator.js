#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import PrettyError from 'pretty-error';

import { formatError } from '../lib/log-utils.js';
import gtfsAccessibilityValidator from '../index.js';
import { isNil, omitBy } from 'lodash-es';

const pe = new PrettyError();

const { argv } = yargs(hideBin(process.argv))
  .usage('Usage: $0 --gtfsPath /path/to/gtfs.zip')
  .help()
  .option('gtfsPath', {
    describe: 'Path to gtfs (zipped or unzipped)',
    type: 'string',
  })
  .option('gtfsUrl', {
    describe: 'URL of gtfs file',
    type: 'string',
  })
  .option('s', {
    alias: 'skipImport',
    describe: 'Don’t import GTFS file.',
    type: 'boolean',
  })
  .default('skipImport', undefined)
  .option('sqlitePath', {
    describe: 'Path to SQLite database',
    type: 'string',
  })
  .default('sqlitePath', undefined);

const handleError = (error) => {
  const text = error || 'Unknown Error';
  process.stdout.write(`\n${formatError(text)}\n`);
  console.error(pe.render(error));
  process.exit(1);
};

const setupImport = async () => {
  const config = {
    gtfsPath: argv.gtfsPath,
    gtfsUrl: argv.gtfsUrl,
    sqlitePath: argv.sqlitePath,
    skipImport: argv.skipImport,
  };
  await gtfsAccessibilityValidator(omitBy(config, isNil));
  process.exit();
};

setupImport().catch(handleError);
