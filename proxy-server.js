#!/usr/bin/env node
/**
 * 本地代理服务器
 * 解决百度API的CORS限制问题
 * 
 * 使用方法：
 * 1. 安装依赖：npm install express cors
 * 2. 运行：node proxy-server.js
 * 3. 服务器会在 http://localhost:3001 启动
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;

const server = http.createServer((req, res) => {
    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 处理GET和POST请求
    if (req.method !== 'POST' && req.method !== 'GET') {
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end('Method Not Allowed');
        return;
    }
    
    // 解析请求路径
    const path = url.parse(req.url).pathname;
    
    // 如果是Token获取（GET请求）
    if (path === '/api/oauth/token' && req.method === 'GET') {
        try {
            const queryParams = url.parse(req.url, true).query;
            const apiKey = queryParams.client_id;
            const apiSecret = queryParams.client_secret;
            
            if (!apiKey || !apiSecret) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: '缺少参数' }));
                return;
            }
            
            const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${apiSecret}`;
            
            https.get(tokenUrl, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': proxyRes.headers['content-type']
                });
                proxyRes.pipe(res);
            }).on('error', (e) => {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: e.message }));
            });
            return;
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
            return;
        }
    }
    
    // 处理POST请求
    // 获取请求体
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });
    
    req.on('end', () => {
        try {
            const params = new URLSearchParams(body);
            
            if (path === '/api/ocr/handwriting') {
                // 手写识别API代理
                const accessToken = params.get('access_token');
                const image = params.get('image');
                
                const postData = new URLSearchParams({
                    access_token: accessToken,
                    image: image
                }).toString();
                
                const options = {
                    hostname: 'aip.baidubce.com',
                    path: '/rest/2.0/ocr/v1/handwriting',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };
                
                const proxyReq = https.request(options, (proxyRes) => {
                    res.writeHead(proxyRes.statusCode, {
                        'Content-Type': proxyRes.headers['content-type']
                    });
                    proxyRes.pipe(res);
                });
                
                proxyReq.on('error', (e) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: e.message }));
                });
                
                proxyReq.write(postData);
                proxyReq.end();
                
            } else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: error.message }));
        }
    });
});

server.listen(PORT, () => {
    console.log(`✅ 代理服务器已启动: http://localhost:${PORT}`);
    console.log(`📝 请确保前端代码指向此代理服务器`);
});

