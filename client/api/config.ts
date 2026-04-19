// Vercel Serverless Function — served at /api/config for any frontend host.
// Reads service URLs from runtime env vars (Vercel Project → Settings → Environment Variables)
// so you can change them from the dashboard without rebuilding the client.
//
// Supported env var names (first match wins per service):
//   Auth         :  AUTH_URL,        VITE_AUTH_URL
//   Earnings     :  EARNINGS_URL,    VITE_EARNINGS_URL
//   Anomaly      :  ANOMALY_URL,     VITE_ANOMALY_URL
//   Grievance    :  GRIEVANCE_URL,   VITE_GRIEVANCE_URL
//   Analytics    :  ANALYTICS_URL,   VITE_ANALYTICS_URL
//   Certificate  :  CERTIFICATE_URL, VITE_CERTIFICATE_URL

type VercelRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
  end: () => void;
};

function pick(...keys: string[]): string {
  for (const k of keys) {
    const v = process.env[k];
    if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
  }
  return '';
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const body = {
    source: 'api',
    services: {
      auth: pick('AUTH_URL', 'VITE_AUTH_URL'),
      earnings: pick('EARNINGS_URL', 'VITE_EARNINGS_URL'),
      anomaly: pick('ANOMALY_URL', 'VITE_ANOMALY_URL'),
      grievance: pick('GRIEVANCE_URL', 'VITE_GRIEVANCE_URL'),
      analytics: pick('ANALYTICS_URL', 'VITE_ANALYTICS_URL'),
      certificate: pick('CERTIFICATE_URL', 'VITE_CERTIFICATE_URL'),
    },
  };

  res.status(200).json(body);
}
