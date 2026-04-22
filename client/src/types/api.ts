// Shared API response types — aligned with backend routes (FastAPI / Express).

export interface Shift {
  id: string;
  worker_id: string;
  worker_name?: string;
  platform_id: string;
  platform_name?: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
  verification_status: 'pending' | 'verified' | 'disputed' | 'unverifiable';
  import_source: 'manual' | 'csv';
  created_at: string | null;
}

export interface ShiftCreatePayload {
  platform_id: string;
  shift_date: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
}

export interface ShiftInput {
  shift_date: string;
  platform_id: string;
  hours_worked: number;
  gross_earned: number;
  platform_deductions: number;
  net_received: number;
}

export interface Platform {
  id: string;
  name: string;
  category: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface WorkerSummary {
  total_gross: number;
  total_deductions: number;
  total_net: number;
  total_hours: number;
  shift_count: number;
  verified_count: number;
  avg_commission_rate: number;
  platform_breakdown: Array<{
    platform: string;
    shifts: number;
    net: number;
    commission_pct: number;
  }>;
}

export interface EarningsTrendRow {
  week: string;
  net_income: number;
  avg_hourly: number;
}

export interface CommissionTrendRow {
  week: string;
  platform_name: string;
  commission_rate: number;
}

export interface CityMedianComparisonRow {
  week: string;
  platform_name: string;
  city_median: number;
  p25_net: number;
  p75_net: number;
}

export interface WorkerTrends {
  earnings_trend: EarningsTrendRow[];
  commission_trend: CommissionTrendRow[];
  city_median_comparison: CityMedianComparisonRow[];
}

export interface ImportRecord {
  id: string;
  original_filename: string;
  file_type: string;
  rows_imported: number;
  rows_errored: number;
  import_status: string;
  uploaded_at: string;
}

export interface CsvImportResponse {
  upload_id: string;
  rows_imported: number;
  rows_errored: number;
  errors: unknown[];
}

export interface ScreenshotMeta {
  id: string;
  shift_log_id: string;
  url: string;
  original_filename: string | null;
  file_size_bytes: number | null;
  width: number | null;
  height: number | null;
  format: string | null;
}

export interface AnomalyResult {
  id: string;
  worker_id: string;
  shift_log_id: string | null;
  anomaly_type:
    | 'unusual_deduction'
    | 'income_drop'
    | 'rate_spike'
    | 'hours_mismatch'
    | 'mom_drop';
  severity: 'low' | 'medium' | 'high';
  metric_name: string | null;
  expected_low: number | null;
  expected_high: number | null;
  actual_value: number | null;
  deviation_score: number | null;
  explanation: string;
  detected_at: string;
}

export interface GrievanceTagRow {
  id: string;
  grievance_id: string;
  tag: string;
}

export interface Grievance {
  id: string;
  worker_id: string | null;
  worker_name?: string;
  platform_id: string;
  platform_name?: string;
  platform?: { name: string };
  category:
    | 'commission_change'
    | 'deactivation'
    | 'payment_delay'
    | 'unfair_rating'
    | 'safety'
    | 'other';
  description: string;
  status: 'open' | 'escalated' | 'resolved';
  is_anonymous: boolean;
  resolution_notes: string | null;
  grievance_tags?: GrievanceTagRow[];
  created_at: string;
  updated_at: string;
}

/** Normalized tags for UI when API returns nested grievance_tags */
export function grievanceTags(g: Grievance): string[] {
  return (g.grievance_tags ?? []).map((t) => t.tag);
}

export interface GrievanceCreatePayload {
  platform_id: string;
  category: Grievance['category'];
  description: string;
  is_anonymous: boolean;
}

export interface GrievanceStatusPayload {
  status: Grievance['status'];
  resolution_notes?: string;
}

export interface VerificationPayload {
  status: 'verified' | 'disputed' | 'unverifiable';
  notes?: string;
  verifier_gross?: number;
  verifier_deductions?: number;
}

export interface AnalyticsDashboardSummary {
  total_active_workers: number;
  total_shifts_logged: number;
  total_verified: number;
  total_disputes: number;
  avg_commission_rate: number;
  vulnerable_workers_count: number;
  open_grievances: number;
  top_complaint_category: string | null;
  platforms_tracked: number;
  /** ISO date string of the latest week in zone_earnings_summary. Null if the view is empty. */
  views_as_of: string | null;
}

export interface CommissionTrendPoint {
  platform_name: string;
  week: string;
  avg_commission_rate: number;
  worker_count: number;
  total_shifts: number;
}

export interface IncomeDistributionPoint {
  zone_name: string;
  p25_net: number;
  p50_net: number;
  p75_net: number;
  avg_net: number;
  worker_count: number;
}

export interface VulnerabilityFlagRow {
  worker_id: string;
  display_name: string;
  city_zone: string;
  mom_drop_pct: number;
  prev_month_net: number;
  curr_month_net: number;
  has_recent_anomalies: boolean;
}

export interface PlatformComparisonRow {
  platform_name: string;
  avg_commission_rate: number;
  complaint_count: number;
  avg_hourly_rate: number;
  worker_count: number;
  deactivation_complaints: number;
  fairness_score: number;
}

export interface GrievanceStats {
  total: number;
  by_status: Array<{ status: string; _count: { id: number } }>;
  by_category: Array<{ category: string; _count: { id: number } }>;
  by_platform: Array<{ platform: string; count: number }>;
  trending_tags: Array<{ tag: string; count: number }>;
}

export interface GrievanceCluster {
  platform_name: string;
  category: string;
  complaint_count: number;
  earliest: string;
  latest: string;
  escalated_count: number;
  common_tags: string[] | null;
  sample_descriptions: string[];
}

export interface CertificatePreview {
  cert_id: string;
  generated_date: string;
  worker_name: string;
  date_from: string;
  date_to: string;
  total_gross: string;
  total_deductions: string;
  total_net: string;
  total_hours: string;
  hourly_rate: string;
  shift_count: number;
  verified_count: number;
  platform_breakdown: Array<Record<string, unknown>>;
}

export interface DetectAnomalyItem {
  type: string;
  severity: string;
  shift_date: string;
  platform: string;
  metric: string;
  expected_range: { low: number; high: number };
  actual_value: number;
  deviation_score: number;
  explanation: string;
}

export interface DetectResponse {
  anomalies_found: number;
  anomalies: DetectAnomalyItem[];
  summary: string;
}
