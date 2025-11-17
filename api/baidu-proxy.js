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
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  // 调试日志函数
  const debugLog = (message, data = null) => {
    const logData = {
      requestId,
      timestamp: new Date().toISOString(),
      message,
      ...(data && { data })
    };
    console.log(`[Vercel Proxy ${requestId}]`, JSON.stringify(logData, null, 2));
  };

  debugLog('Request received', {
    method: req.method,
    url: req.url,
    headers: {
      origin: req.headers.origin,
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      'content-length': req.headers['content-length']
    }
  });

  if (req.method === 'OPTIONS') {
    debugLog('OPTIONS request handled');
    res.setHeader('Access-Control-Max-Age', '86400');
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));
    res.status(204).end();
    return;
  }

  try {
    Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

    if (req.method === 'GET') {
      debugLog('GET health check');
      res.status(200).json({ 
        ok: true, 
        message: 'baidu-proxy ok',
        requestId,
        timestamp: new Date().toISOString(),
        env: {
          hasApiKey: !!process.env.BAIDU_API_KEY,
          hasSecretKey: !!process.env.BAIDU_SECRET_KEY,
          apiKeyLength: process.env.BAIDU_API_KEY ? process.env.BAIDU_API_KEY.length : 0
        }
      });
      return;
    }

    if (req.method !== 'POST') {
      debugLog('Method not allowed', { method: req.method });
      res.status(405).json({ error: 'Method Not Allowed', requestId });
      return;
    }

    const { imageBase64, options } = req.body || {};
    debugLog('POST request received', {
      hasImageBase64: !!imageBase64,
      imageBase64Length: imageBase64 ? String(imageBase64).length : 0,
      hasOptions: !!options
    });

    if (!imageBase64) {
      debugLog('Missing imageBase64');
      res.status(400).json({ error: 'imageBase64 required', requestId });
      return;
    }

    // 检查环境变量
    debugLog('Checking environment variables');
    const apiKey = process.env.BAIDU_API_KEY;
    const secretKey = process.env.BAIDU_SECRET_KEY;
    if (!apiKey || !secretKey) {
      debugLog('Missing environment variables', {
        hasApiKey: !!apiKey,
        hasSecretKey: !!secretKey
      });
      throw new Error('Missing BAIDU_API_KEY/BAIDU_SECRET_KEY');
    }

    debugLog('Getting access token');
    const tokenStartTime = Date.now();
    const token = await getAccessToken();
    debugLog('Access token obtained', {
      tokenLength: token ? token.length : 0,
      tokenTime: Date.now() - tokenStartTime
    });

    const base64Data = String(imageBase64).replace(/^data:image\/\w+;base64,/, '');
    debugLog('Base64 data processed', {
      originalLength: String(imageBase64).length,
      processedLength: base64Data.length,
      hasDataPrefix: String(imageBase64).startsWith('data:')
    });
    
    // 验证base64数据
    if (!base64Data || base64Data.length < 100) {
      debugLog('Invalid base64 data', {
        base64Length: base64Data ? base64Data.length : 0
      });
      res.status(400).json({ 
        error: 'Invalid image data', 
        details: `Base64 data length: ${base64Data ? base64Data.length : 0}`,
        requestId
      });
      return;
    }

    // 与本地代理服务器保持一致：只传递最基本的参数
    const params = new URLSearchParams({
      access_token: token,
      image: base64Data
    });

    debugLog('Calling Baidu API', {
      url: 'https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting',
      paramsSize: params.toString().length
    });

    const baiduStartTime = Date.now();
    const ocrUrl = `https://aip.baidubce.com/rest/2.0/ocr/v1/handwriting`;
    const resp = await fetch(ocrUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    
    const baiduTime = Date.now() - baiduStartTime;
    debugLog('Baidu API response received', {
      status: resp.status,
      statusText: resp.statusText,
      responseTime: baiduTime
    });
    
    const data = await resp.json();
    debugLog('Baidu API response parsed', {
      hasErrorCode: !!data.error_code,
      errorCode: data.error_code,
      errorMsg: data.error_msg,
      hasWordsResult: !!data.words_result,
      wordsResultCount: data.words_result ? data.words_result.length : 0
    });
    
    // 如果百度API返回错误，也返回给前端，但添加更多调试信息
    if (!resp.ok || data.error_code) {
      debugLog('Baidu API error', {
        httpStatus: resp.status,
        errorCode: data.error_code,
        errorMsg: data.error_msg
      });
      res.status(resp.ok ? 200 : resp.status).json({
        ...data,
        _proxy_info: {
          requestId,
          baidu_response_status: resp.status,
          has_error_code: !!data.error_code,
          error_code: data.error_code,
          error_msg: data.error_msg,
          totalTime: Date.now() - startTime,
          baiduApiTime: baiduTime
        }
      });
      return;
    }
    
    // 成功响应，返回数据
    debugLog('Success response', {
      wordsCount: data.words_result ? data.words_result.length : 0,
      totalTime: Date.now() - startTime
    });
    res.status(200).json({
      ...data,
      _proxy_info: {
        requestId,
        totalTime: Date.now() - startTime,
        baiduApiTime: baiduTime
      }
    });
  } catch (err) {
    const errorTime = Date.now() - startTime;
    debugLog('Error occurred', {
      error: err.message,
      stack: err.stack,
      totalTime: errorTime
    });
    res.status(500).json({ 
      error: String(err.message || err),
      requestId,
      totalTime: errorTime,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
};


