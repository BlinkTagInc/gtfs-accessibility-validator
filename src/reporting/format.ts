import { styleText } from 'node:util';
import type {
  AccessibilityCheck,
  AccessibilityResult,
} from '../types/result.ts';

export function formatPercent(ratio: number): string {
  return Number.isFinite(ratio) ? `${Math.round(ratio * 1000) / 10}%` : 'n/a';
}

const labels: Record<string, string> = {
  tripsWithWheelchairAccessibility: 'Trips with wheelchair accessibility info',
  stopsWithWheelchairBoarding: 'Stops with wheelchair boarding info',
  stopsWithTTSStopName: 'Text-to-speech stop names',
  hasLevels: 'Levels information',
  hasPathways: 'Pathways information',
  routeColorContrastIsValid: 'Routes with invalid color contrast',
};

function formatTable(checks: readonly AccessibilityCheck[]): string {
  const rows = checks.map((check) => ({
    status:
      check.status === 'pass'
        ? '✔ pass'
        : check.status === 'fail'
          ? '✘ fail'
          : '− n/a',
    label: labels[check.id] ?? check.name,
    value: check.value,
    color:
      check.status === 'pass'
        ? ('green' as const)
        : check.status === 'fail'
          ? ('red' as const)
          : ('gray' as const),
  }));
  const widths: [number, number, number] = [
    6,
    Math.max(5, ...rows.map((row) => row.label.length)),
    Math.max(5, ...rows.map((row) => row.value.length)),
  ];
  const border = (left: string, middle: string, right: string) =>
    left + widths.map((width) => '─'.repeat(width + 2)).join(middle) + right;
  return [
    border('┌', '┬', '┐'),
    `│ ${'Status'.padEnd(widths[0])} │ ${'Check'.padEnd(widths[1])} │ ${'Value'.padStart(widths[2])} │`,
    border('├', '┼', '┤'),
    ...rows.map((row) => {
      // Pad before styling so ANSI sequences do not affect column alignment.
      const status = styleText(row.color, row.status.padEnd(widths[0]), {
        stream: process.stdout,
      });
      return `│ ${status} │ ${row.label.padEnd(widths[1])} │ ${row.value.padStart(widths[2])} │`;
    }),
    border('└', '┴', '┘'),
  ].join('\n');
}

function formatDate(date: number | null): string {
  if (date === null) {
    return 'unspecified';
  }
  return String(date).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
}

export function formatResult(result: AccessibilityResult): string {
  return (
    '\n' +
    result.sources
      .map((source) => {
        const routes = source.checks.flatMap((check) => check.routes ?? []);
        const heading =
          source.agencies.filter(Boolean).join(', ') || 'Accessibility report';
        return [
          styleText('bold', heading, { stream: process.stdout }),
          `Source: ${source.sourceId}`,
          ...source.feedInfo.flatMap((feed) => [
            ...(feed.version ? [`Feed version: ${feed.version}`] : []),
            ...(feed.startDate !== null || feed.endDate !== null
              ? [
                  `Feed dates: ${formatDate(feed.startDate)} → ${formatDate(feed.endDate)}`,
                ]
              : []),
          ]),
          '',
          formatTable(source.checks),
          ...(routes.length > 0
            ? [
                '',
                'Routes with invalid color contrast:',
                ...routes.map((route) => {
                  const name =
                    route.route_short_name ||
                    route.route_long_name ||
                    route.route_id;
                  return `  • ${name}${name === route.route_id ? '' : ` (${route.route_id})`}`;
                }),
              ]
            : []),
        ].join('\n');
      })
      .join('\n\n') +
    '\n'
  );
}
