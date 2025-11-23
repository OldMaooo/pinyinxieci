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
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const PROJECT_ROOT = path.resolve(__dirname, '..');

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
    let requestPath = url.parse(req.url).pathname;
    // 解码 URL 编码的路径（处理中文文件名）
    try {
        requestPath = decodeURIComponent(requestPath);
    } catch (e) {
        // 如果解码失败，使用原始路径
    }
    
    // 处理静态文件请求
    if (req.method === 'GET' && !requestPath.startsWith('/api/')) {
        let filePath;
        
        // 如果请求的是根路径，返回 index.html
        if (requestPath === '/') {
            filePath = path.join(PROJECT_ROOT, 'index.html');
        } else {
            // 去掉前导斜杠，然后拼接项目根目录
            const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;
            filePath = path.join(PROJECT_ROOT, relativePath);
        }
        
        // 安全检查：确保文件在项目目录内
        if (!filePath.startsWith(PROJECT_ROOT)) {
            res.writeHead(403, { 'Content-Type': 'text/plain' });
            res.end('Forbidden');
            return;
        }
        
        // 检查文件是否存在
        fs.stat(filePath, (err, stats) => {
            if (err) {
                console.error(`[Static] File not found: ${filePath}`, err.message);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            if (!stats.isFile()) {
                console.error(`[Static] Not a file: ${filePath}`);
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
                return;
            }
            
            // 读取文件
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                    return;
                }
                
                // 设置 MIME 类型
                const ext = path.extname(filePath).toLowerCase();
                const mimeTypes = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.gif': 'image/gif',
                    '.svg': 'image/svg+xml',
                    '.ttf': 'font/ttf',
                    '.woff': 'font/woff',
                    '.woff2': 'font/woff2'
                };
                const contentType = mimeTypes[ext] || 'application/octet-stream';
                
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });
        });
        return;
    }
    
    // 如果是Token获取（GET请求）
    if (requestPath === '/api/oauth/token' && req.method === 'GET') {
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
            if (requestPath === '/api/ocr/handwriting' || requestPath === '/api/baidu-proxy') {
                // 手写识别API代理 - 支持 JSON 和 form-urlencoded 两种格式
                let accessToken, imageBase64;
                
                // 检查 Content-Type
                const contentType = req.headers['content-type'] || '';
                
                if (contentType.includes('application/json')) {
                    // JSON 格式（前端发送的格式）
                    try {
                        const jsonBody = JSON.parse(body);
                        imageBase64 = jsonBody.imageBase64 || jsonBody.image;
                        
                        // 从缓存中获取 token（如果前端没有提供）
                        // 注意：本地代理需要前端先获取 token
                        // 这里假设 token 已经在请求中或需要从缓存获取
                        if (!jsonBody.access_token) {
                            // 尝试从 localStorage 缓存获取（但这是前端的事情）
                            // 实际上，前端应该先调用 /api/oauth/token 获取 token
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: '缺少 access_token，请先获取 token' }));
                            return;
                        }
                        accessToken = jsonBody.access_token;
                    } catch (jsonError) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'JSON 解析失败: ' + jsonError.message }));
                        return;
                    }
                } else {
                    // form-urlencoded 格式（旧格式，保持兼容）
                    const params = new URLSearchParams(body);
                    accessToken = params.get('access_token');
                    imageBase64 = params.get('image');
                }
                
                if (!accessToken || !imageBase64) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: '缺少必要参数: access_token 或 image' }));
                    return;
                }
                
                // 移除 data:image 前缀（如果存在）
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                
                // 构建发送给百度 API 的请求
                const postData = new URLSearchParams({
                    access_token: accessToken,
                    image: base64Data
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
                        'Content-Type': proxyRes.headers['content-type'],
                        'Access-Control-Allow-Origin': '*'
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
    console.log(`✅ 服务器已启动: http://localhost:${PORT}`);
    console.log(`📝 访问应用: http://localhost:${PORT}/`);
    console.log(`🔧 API 代理: http://localhost:${PORT}/api/`);
});

