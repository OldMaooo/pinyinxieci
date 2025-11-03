// Vercel Serverless Function: Baidu OCR Proxy with CORS
// Env vars required: BAIDU_API_KEY, BAIDU_SECRET_KEY

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

let cachedToken = null;
let cachedExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry) return cachedToken;

  const apiKey = process.env.BAIDU_API_KEY;
  const secretKey = process.env.BAIDU_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error('Missing BAIDU_API_KEY/BAIDU_SECRET_KEY');
  }

  const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${encodeURIComponent(apiKey)}&client_secret=${encodeURIComponent(secretKey)}`;
  const resp = await fetch(url, { method: 'POST' });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    const msg = data.error_description || data.error || 'token request failed';
    throw new Error(`Baidu token error: ${msg}`);
  }
  cachedToken = data.access_token;
  // expires_in seconds, refresh 1 hour earlier
  cachedExpiry = now + Math.max(0, (data.expires_in - 3600)) * 1000;
  return cachedToken;
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Max-Age', '86400');
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).end();
    return;
  }

  try {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'GET') {
      res.status(200).json({ ok: true, message: 'baidu-proxy ok' });
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method Not Allowed' });
      return;
    }

    const { imageBase64, options } = req.body || {};
    if (!imageBase64) {
      res.status(400).json({ error: 'imageBase64 required' });
      return;
    }

    const token = await getAccessToken();
    const base64Data = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');

    const params = new URLSearchParams({
      image: base64Data,
      language_type: 'CHN_ENG',
      detect_direction: 'false',
      probability: 'true',
      ...Object.fromEntries(Object.entries(options || {}).map(([k, v]) => [k, String(v)])),
    });

    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting?access_token=${encodeURIComponent(token)}`;
    const resp = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const data = await resp.json();
    if (!resp.ok) {
      res.status(resp.status).json(data);
      return;
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};


