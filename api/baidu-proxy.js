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
    
    // 验证base64数据
    if (!base64Data || base64Data.length < 100) {
      res.status(400).json({ 
        error: 'Invalid image data', 
        details: `Base64 data length: ${base64Data ? base64Data.length : 0}` 
      });
      return;
    }

    // 与本地代理服务器保持一致：只传递最基本的参数
    // 本地代理服务器只传递 access_token 和 image，没有其他参数
    const params = new URLSearchParams({
      access_token: token,
      image: base64Data
    });

    // 使用手写识别接口
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting`;
    const resp = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    const data = await resp.json();
    
    // 如果百度API返回错误，也返回给前端，但添加更多调试信息
    if (!resp.ok || data.error_code) {
      res.status(resp.ok ? 200 : resp.status).json({
        ...data,
        _proxy_info: {
          baidu_response_status: resp.status,
          has_error_code: !!data.error_code,
          error_code: data.error_code,
          error_msg: data.error_msg
        }
      });
      return;
    }
    
    // 成功响应，返回数据
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


