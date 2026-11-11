#!/usr/bin/env node

import { runCli } from '../cli/command.ts';

runCli(process.argv.slice(2)).catch((error: unknown) => {
  process.stderr.write(
    `Error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
