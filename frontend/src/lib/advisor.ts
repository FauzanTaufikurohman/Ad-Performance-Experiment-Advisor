export const API =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers);
  const token =
    typeof window === "undefined"
      ? null
      : window.localStorage.getItem("advisora_token");

  if (token) headers.set("Authorization", `Bearer ${token}`);

  return fetch(input, { ...init, headers });
}

export type Metrics = {
  total_impressions: number;
  total_clicks: number;
  total_spend: number;
  total_conversions: number;
  total_conversion_value: number;
  ctr: number | null;
  cpa: number | null;
  roas: number | null;
};

export type Finding = {
  code: string;
  severity: string;
  title: string;
  description: string;
};

export type AIExperiment = {
  name: string;
  hypothesis: string;
  variable: string;
  success_metric: string;
  recommended_action: string;
  limitations: string[];
};

export type AIAdvisor = {
  status: string;
  model?: string;
  summary: string;
  insights: string[];
  hypotheses: string[];
  recommended_experiments: AIExperiment[];
  disclaimer: string;
};

export type UploadResult = {
  success: boolean;
  message: string;
  filename?: string;
  rows?: number;
  upload_id?: number;
  metrics?: Metrics;
  findings?: Finding[];
  readiness?: unknown;
  data?: unknown[];
};

export type HistoryItem = {
  id: number;
  filename: string;
  status: string;
  row_count: number;
  created_at: string;
};

export const emptyMetrics: Metrics = {
  total_impressions: 0,
  total_clicks: 0,
  total_spend: 0,
  total_conversions: 0,
  total_conversion_value: 0,
  ctr: null,
  cpa: null,
  roas: null,
};

export function formatNumber(
  value: number | null | undefined,
  digits = 2,
) {
  if (value == null || !Number.isFinite(value)) return "—";

  return value.toLocaleString("id-ID", {
    maximumFractionDigits: digits,
  });
}

export function formatMoney(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
