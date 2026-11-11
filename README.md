# GTFS Accessibility Validator

<p align="center"><img src="docs/images/gtfs-accessibility-validator-logo.svg" alt="GTFS Accessibility Validator logo" width="140"></p>

Reliable accessibility information helps riders with disabilities plan transit trips with confidence; this library helps transit providers identify missing accessibility data and hard-to-read route colors before riders encounter them in trip-planning apps.

Check accessibility information in GTFS Schedule feeds with [node-GTFS](https://github.com/BlinkTagInc/node-gtfs). Use a local ZIP, an extracted directory, a URL, or an existing database. Each source gets an independent report.

Requires Node.js 22.18+, 24, or later supported versions. ESM only.

## Quick start

```sh
npx gtfs-accessibility-validator --input ./gtfs.zip
npx gtfs-accessibility-validator --url https://example.com/gtfs.zip
```

For repeated use, install with `npm install -g gtfs-accessibility-validator`.

## Configuration

Create `config.json` (or copy [config-sample.json](config-sample.json)):

```json
{
  "sources": [{ "schedule": { "path": "./gtfs.zip" } }]
}
```

```sh
gtfs-accessibility-validator --config config.json
gtfs-accessibility-validator --from-database --database ./gtfs.sqlite --source-id transit
gtfs-accessibility-validator --input ./gtfs.zip --json > report.json
```

Relative paths resolve from the working directory. An existing `config.json` is loaded automatically; command-line flags override its settings. `--input` and `--url` replace configured sources. Run `--help` for all flags.

[config-sample-full.json](config-sample-full.json) shows all JSON configuration options, with separate URL and local-file sources because `url` and `path` are mutually exclusive. Replace the example sources with your feed. JavaScript-only `database.client` and `reporting.reporter` cannot be represented in JSON.

Shared options use node-GTFS's structure and types:

| Option                | Behavior                                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database`            | Defaults to an in-memory SQLite database. Set `path` to retain imported data, or pass a caller-owned `client` in JavaScript.                                                                 |
| `sources`             | Required, non-empty array. Each source has `schedule.path` or `schedule.url`. Multiple sources require unique `sourceId` values; a single source defaults to `default`.                      |
| `sources[].schedule`  | Accepts download, CSV, archive, and import settings, including `timeoutMs`, `requestHeaders`, and `import.validation.onDuplicateKey`. Files used by accessibility checks cannot be excluded. |
| `extensions`          | node-GTFS extension selection; defaults to `[]` because these checks use core GTFS fields.                                                                                                   |
| `reporting`           | `level` (`silent`, `error`, `warn`, `info`) and optional JavaScript `reporter`. Library calls are silent without a reporter.                                                                 |
| `accessibility.input` | `schedule` (default) imports before checking. `database` checks existing data and requires a persistent `database.path` or a live `database.client`; sources may contain only `sourceId`.    |

Import behavior follows node-GTFS: validation defaults to `off`, duplicate keys are rejected, and a successful import replaces that source's stored data. Imports include the full schedule unless you configure `excludeFiles`. No report is returned after an unsuccessful import. Caller-owned database clients remain open.

## JavaScript

```sh
npm install gtfs-accessibility-validator
```

```js
import { validateAccessibility } from 'gtfs-accessibility-validator';

const result = await validateAccessibility({
  sources: [{ schedule: { path: './gtfs.zip' } }],
});

for (const source of result.sources) {
  console.log(source.sourceId, source.checks);
}
```

The result contains `success` and `sources`. Each source contains `sourceId`, `success`, `checks`, `agencies`, and `feedInfo` (`version`, `startDate`, `endDate`). A check includes `id`, `name`, `value`, and `status`: `pass`, `fail`, or `not-applicable`. The contrast check also lists affected routes using GTFS field names. Missing metadata stays `null`; empty trip/stop percentages are `n/a` with `not-applicable` status.

Operational errors reject the promise. Failed accessibility checks return `success: false`. CLI exit codes are **0** for passing checks, **2** for failed checks, and **1** for configuration/import errors. Results go to stdout; progress and errors go to stderr. `--log-level silent` suppresses progress, including with `--json`.

TypeScript types `AccessibilityConfig`, `AccessibilityResult`, `AccessibilitySourceResult`, and `AccessibilityCheck` are exported.

## Checks

These accessibility guidelines are taken from the [California Transit Data Guidelines](https://dot.ca.gov/cal-itp/california-transit-data-guidelines-v3_0#section-checklist) published by Caltrans.

### Trip wheelchair accessibility

Riders who use wheelchairs and other mobility aids need to know whether they can travel on a particular scheduled trip. Publishing `wheelchair_accessible` in `trips.txt` lets trip-planning apps provide this information before a rider leaves home.

The validator reports the percentage of trips with `wheelchair_accessible` equal to `1` or `2` and passes when every trip has this information. Both values provide useful information: `1` indicates wheelchair access is available, while `2` indicates it is unavailable. A value of `0` or an empty field means the information is missing.

### Stop wheelchair boarding

Knowing whether a vehicle is accessible is only part of planning a trip. Riders also need to know where they can board and alight using a wheelchair or other mobility aid. The `wheelchair_boarding` field in `stops.txt` supplies this information to trip-planning apps.

The validator reports the percentage of stops/platforms and stations (`location_type` empty, `0`, or `1`) with an explicit `wheelchair_boarding` value of `1` or `2` and passes at 100%. This check measures explicit field coverage; it does not resolve accessibility inherited from a parent station.

### Text-to-speech stop names

Spoken stop names are an important wayfinding aid for riders with visual impairments. The `tts_stop_name` field in `stops.txt` lets transit providers supply pronunciation-friendly names for stops that text-to-speech systems commonly mispronounce.

The validator checks for at least one nonblank `tts_stop_name`. It does not assess pronunciation or determine which stops need a pronunciation override. Use BlinkTag's [GTFS Text-to-Speech Tester](https://github.com/BlinkTagInc/gtfs-tts) to listen to stop names and identify names that need attention.

### Levels and pathways

Riders need information about accessible paths between the street, station entrances, and boarding areas. Together, `stops.txt`, `levels.txt`, and `pathways.txt` describe station layouts and connections, including details such as pathway modes and stairs that help trip-planning apps guide riders through a facility.

The validator checks `levels.txt` and `pathways.txt` separately, passing each check when its table contains at least one row. These checks establish that data is present; they do not assess whether the pathway network is complete or provides an accessible route to every boarding area.

### Route color contrast

Trip-planning apps often display a route's short name in `route_text_color` against a `route_color` background. Sufficient contrast helps riders read route labels, especially riders with low vision.

The validator checks for WCAG AA large-text contrast of at least 3:1 and lists routes that fail. Missing background and text colors use the GTFS defaults of white and black, respectively; malformed colors fail the check.

These checks assess data coverage and route color contrast, not physical accessibility. See the [GTFS reference](https://gtfs.org/documentation/schedule/reference/) for field semantics.
