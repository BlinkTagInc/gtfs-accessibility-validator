export interface AccessibilityCheck {
  readonly id: string;
  readonly name: string;
  readonly value: string;
  readonly status: 'pass' | 'fail' | 'not-applicable';
  readonly routes?: readonly {
    readonly route_id: string;
    readonly route_short_name: string | null;
    readonly route_long_name: string | null;
    readonly route_color: string | null;
    readonly route_text_color: string | null;
  }[];
}

export interface AccessibilitySourceResult {
  readonly sourceId: string;
  readonly success: boolean;
  readonly checks: readonly AccessibilityCheck[];
  readonly agencies: readonly (string | null)[];
  readonly feedInfo: readonly {
    readonly version: string | null;
    readonly startDate: number | null;
    readonly endDate: number | null;
  }[];
}

export interface AccessibilityResult {
  readonly success: boolean;
  readonly sources: readonly AccessibilitySourceResult[];
}
