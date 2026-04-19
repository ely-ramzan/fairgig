// Recharts-compatible data shapes for all charts in the app.

export interface EarningsTrendPoint {
  date:          string; // "2026-01-05"
  net_received:  number;
  /** Present when derived from raw shifts (daily aggregates); omitted for weekly worker trends. */
  gross_earned?: number;
}

export interface CommissionPoint {
  date:            string;
  platform:        string;
  commission_rate: number;
}

export interface ZoneDistributionPoint {
  zone_name:    string;
  p25_net:      number;
  median_net:   number;
  p75_net:      number;
  worker_count: number;
}

export interface VulnerabilityFlag {
  worker_id:     string;
  display_name:  string;
  prev_month_net: number;
  curr_month_net: number;
  drop_pct:      number;
}

export interface PlatformComparisonPoint {
  platform:           string;
  avg_commission_rate: number;
  avg_hourly_rate:    number;
  total_workers:      number;
}
