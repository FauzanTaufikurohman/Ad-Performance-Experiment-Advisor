import { API, apiFetch, type AIAdvisor, type Finding, type HistoryItem, type Metrics } from "./advisor";

export type AdRecord = {
  date: string;
  campaign: string;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
};

export type ReadinessCheck = {
  code: string;
  status: string;
  message: string;
};

export type ExperimentReadiness = {
  status: string;
  summary: string;
  row_count: number;
  start_date: string;
  end_date: string;
  eligible_for_review: boolean;
  checks: ReadinessCheck[];
  limitations: string[];
};

export type UploadAnalysis = {
  upload: HistoryItem;
  metrics: Metrics;
  findings: Array<Finding & { recommendation?: string }>;
  readiness: ExperimentReadiness;
  records: AdRecord[];
  ai_advisor: AIAdvisor | null;
};

export type DecisionItem = Finding & {
  id: number;
  upload_id: number;
  filename: string;
  recommendation: string;
  created_at: string;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  totalPages: number;
};

type APIResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  pagination?: {
    total?: number;
    total_pages?: number;
  };
};

async function readResponse<T>(response: Response): Promise<APIResponse<T>> {
  let payload: APIResponse<T>;
  try {
    payload = (await response.json()) as APIResponse<T>;
  } catch {
    throw new Error(`Respons backend tidak valid (HTTP ${response.status}).`);
  }

  if (!response.ok || !payload.success) {
    throw new Error(
      payload.message || `Permintaan gagal (HTTP ${response.status}).`,
    );
  }

  return payload;
}

export async function fetchUploads(
  page = 1,
  limit = 100,
): Promise<PageResult<HistoryItem>> {
  const response = await apiFetch(
    `${API}/api/uploads?page=${page}&limit=${limit}`,
    { cache: "no-store" },
  );
  const payload = await readResponse<HistoryItem[]>(response);
  const items = Array.isArray(payload.data) ? payload.data : [];

  return {
    items,
    total: payload.pagination?.total ?? items.length,
    totalPages: payload.pagination?.total_pages ?? 1,
  };
}

export async function fetchUploadAnalysis(
  uploadId: number | string,
): Promise<UploadAnalysis> {
  const response = await apiFetch(
    `${API}/api/uploads/${encodeURIComponent(String(uploadId))}`,
    { cache: "no-store" },
  );
  const payload = await readResponse<UploadAnalysis>(response);

  if (!payload.data?.upload || !payload.data.metrics || !payload.data.readiness) {
    throw new Error("Respons detail upload tidak berisi analisis lengkap.");
  }

  return payload.data;
}

export async function fetchDecisionInbox(
  page = 1,
  limit = 25,
): Promise<PageResult<DecisionItem>> {
  const response = await apiFetch(
    `${API}/api/decisions?page=${page}&limit=${limit}`,
    { cache: "no-store" },
  );
  const payload = await readResponse<DecisionItem[]>(response);
  const items = Array.isArray(payload.data) ? payload.data : [];

  return {
    items,
    total: payload.pagination?.total ?? items.length,
    totalPages: payload.pagination?.total_pages ?? 1,
  };
}

export function aggregateCampaigns(records: AdRecord[]) {
  const campaigns = new Map<
    string,
    {
      name: string;
      impressions: number;
      clicks: number;
      spend: number;
      conversions: number;
      conversionValue: number;
      dailyMetrics: Map<string, { impressions: number; clicks: number }>;
    }
  >();

  for (const record of records) {
    const name = record.campaign.trim();
    const campaign = campaigns.get(name) ?? {
      name,
      impressions: 0,
      clicks: 0,
      spend: 0,
      conversions: 0,
      conversionValue: 0,
      dailyMetrics: new Map(),
    };

    campaign.impressions += record.impressions;
    campaign.clicks += record.clicks;
    campaign.spend += record.spend;
    campaign.conversions += record.conversions;
    campaign.conversionValue += record.conversion_value;

    const day = record.date.slice(0, 10);
    const daily = campaign.dailyMetrics.get(day) ?? {
      impressions: 0,
      clicks: 0,
    };
    daily.impressions += record.impressions;
    daily.clicks += record.clicks;
    campaign.dailyMetrics.set(day, daily);
    campaigns.set(name, campaign);
  }

  return Array.from(campaigns.values())
    .map((campaign) => ({
      ...campaign,
      ctr: campaign.impressions
        ? (campaign.clicks / campaign.impressions) * 100
        : null,
      cpa: campaign.conversions
        ? campaign.spend / campaign.conversions
        : null,
      roas: campaign.spend
        ? campaign.conversionValue / campaign.spend
        : null,
      dailyMetrics: Array.from(campaign.dailyMetrics.entries())
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([date, metrics]) => ({ date, ...metrics })),
    }))
    .sort((left, right) => right.spend - left.spend);
}
