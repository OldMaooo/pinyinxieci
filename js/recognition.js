/**
 * 手写识别模块
 * 调用第三方API进行手写识别
 * 
 * 支持API：
 * 1. 百度AI开放平台
 * 2. 腾讯云OCR
 * 3. 讯飞开放平台
 */

const Recognition = {
    // API配置（需要用户配置）
    apiConfig: {
        provider: 'baidu', // 'baidu' | 'tencent' | 'iflytek'
        apiKey: '',
        apiSecret: '',
        threshold: 0.75 // 置信度阈值（更严格的正常值）
    },
    
    /**
     * 初始化（从设置中读取配置）
     */
    init() {
        const settings = Storage.getSettings();
        if (settings.recognitionConfig) {
            this.apiConfig = { ...this.apiConfig, ...settings.recognitionConfig };
        }
        if (settings.recognitionThreshold) {
            this.apiConfig.threshold = settings.recognitionThreshold;
        }
        
        // 自动检测并配置云端代理（GitHub Pages 环境）
        this.autoConfigureProxy();
    },
    
    /**
     * 自动配置云端代理（仅在 GitHub Pages 环境且未配置时）
     */
    autoConfigureProxy() {
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        
        if (!isGitHubPages) {
            return; // 非 GitHub Pages 环境，使用同源代理
        }
        
        // 检查是否已配置
        const existingProxy = localStorage.getItem('proxyBase');
        if (existingProxy && existingProxy.trim()) {
            return; // 已配置，不覆盖
        }
        
        // 自动设置默认 Vercel 代理
        const defaultProxy = 'https://pinyinxieci.vercel.app';
        localStorage.setItem('proxyBase', defaultProxy);
        console.log('✅ 已自动配置云端识别代理:', defaultProxy);
        if (typeof Debug !== 'undefined') {
            Debug.log('success', `已自动配置云端识别代理: ${defaultProxy}`, 'proxy');
        }
    },
    
    /**
     * 识别手写字
     * @param {string} imageBase64 - Canvas快照的Base64数据
     * @param {string} expectedWord - 期望的字（用于对比）
     * @returns {Promise<{success: boolean, recognized: string, confidence: number, match: boolean}>}
     */
    async recognize(imageBase64, expectedWord) {
        try {
            // 调试日志 - 识别开始
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `识别模块开始 - 提供商: ${this.apiConfig.provider}, 期望字: ${expectedWord}`, 'recognition');
            }
            
            let result;
            
            switch (this.apiConfig.provider) {
                case 'baidu':
                    result = await this.recognizeBaidu(imageBase64);
                    break;
                case 'tencent':
                    result = await this.recognizeTencent(imageBase64);
                    break;
                case 'iflytek':
                    result = await this.recognizeIflytek(imageBase64);
                    break;
                default:
                    throw new Error('未配置识别服务提供商');
            }
            
            // 对比识别结果和期望的字
            // 识别结果可能是词组，需要提取单个字
            let recognizedWord = result.recognized.trim();
            
            // 如果识别结果长度>1，提取第一个汉字
            if (recognizedWord.length > 1) {
                const firstChar = recognizedWord.charAt(0);
                if (/[\u4e00-\u9fa5]/.test(firstChar)) {
                    recognizedWord = firstChar; // 只取第一个字用于对比
                }
            }
            
            // 更宽松的匹配策略
            let match = false;
            if (recognizedWord === expectedWord) {
                match = true; // 完全匹配
            } else if (recognizedWord.length > 0 && recognizedWord.charAt(0) === expectedWord) {
                match = true; // 第一个字匹配
            } else if (recognizedWord.includes(expectedWord)) {
                match = true; // 包含目标字
            }
            
            // 使用更严格的正常阈值（避免草书/多一笔也判对）
            const effectiveThreshold = this.apiConfig.threshold || 0.75; // 建议正常值 0.75
            const minThreshold = Math.max(0.65, effectiveThreshold - 0.1); // 最低容忍度：比标准低 0.1
            
            // 调试日志 - 匹配和阈值判断
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `匹配判断: match=${match}, recognized="${result.recognized}", expected="${expectedWord}"`, 'recognition');
                Debug.log('info', `置信度: ${result.confidence.toFixed(3)}, 阈值: effective=${effectiveThreshold}, min=${minThreshold}`, 'recognition');
            }
            
            // 如果匹配且置信度在最低容忍度以上，就通过
            // 即使置信度略低，只要字匹配就通过（防止字迹不美观但正确的字被判错）
            let passed = false;
            if (match) {
                if (result.confidence >= effectiveThreshold) {
                    passed = true; // 标准通过
                    if (typeof Debug !== 'undefined') {
                        Debug.log('success', `✅ 标准通过: 置信度 ${result.confidence.toFixed(3)} >= ${effectiveThreshold}`, 'recognition');
                    }
                } else if (result.confidence >= minThreshold) {
                    passed = true; // 容错通过（字匹配但置信度略低）
                    if (typeof Debug !== 'undefined') {
                        Debug.log('success', `✅ 容错通过: 置信度 ${result.confidence.toFixed(3)} >= ${minThreshold}`, 'recognition');
                    }
                } else {
                    if (typeof Debug !== 'undefined') {
                        Debug.log('warning', `❌ 置信度过低: ${result.confidence.toFixed(3)} < ${minThreshold}`, 'recognition');
                    }
                }
            } else {
                if (typeof Debug !== 'undefined') {
                    Debug.log('warning', `❌ 字不匹配: recognized="${result.recognized}" !== expected="${expectedWord}"`, 'recognition');
                }
            }
            
            return {
                success: true,
                recognized: result.recognized,
                confidence: result.confidence,
                match: match,
                passed: passed
            };
        } catch (error) {
            console.error('识别失败:', error);
            
            // 详细的调试日志
            if (typeof Debug !== 'undefined') {
                Debug.logError(error, '识别模块异常');
                Debug.log('error', `错误类型: ${error.name}`, 'error');
                Debug.log('error', `错误消息: ${error.message}`, 'error');
                Debug.log('error', `错误堆栈: ${error.stack || '无堆栈信息'}`, 'error');
                Debug.log('error', `错误完整对象: ${JSON.stringify({
                    name: error.name,
                    message: error.message,
                    stack: error.stack
                })}`, 'error');
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    },
    
    /**
     * 百度AI手写识别
     */
    async recognizeBaidu(imageBase64) {
        // 移除data:image/png;base64,前缀（如果存在）
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        
        try {
            // 检测是否在GitHub Pages环境
            const isGitHubPages = window.location.hostname.includes('github.io') || 
                                  window.location.hostname.includes('github.com');
            
            // 优先使用同源 Serverless（Vercel 部署）/api/baidu-proxy；
            // GitHub Pages 环境则尝试使用设置里的代理地址（APP设置或localStorage: proxyBase）
            const configuredBase = (window.APP_CONFIG && window.APP_CONFIG.proxyBase) || localStorage.getItem('proxyBase') || '';
            const sameOriginUrl = '/api/baidu-proxy';
            const proxyUrl = isGitHubPages
                ? (configuredBase ? `${configuredBase.replace(/\/$/, '')}/api/baidu-proxy` : '')
                : sameOriginUrl;
            
            // 注意：使用 Vercel 代理时，不需要前端获取 token（Vercel 函数内部已处理）
            // 只有在本地代理服务器环境下才需要获取 token
            let accessToken = null;
            if (!isGitHubPages && !window.location.hostname.includes('vercel.app')) {
                // 本地环境，需要获取 token
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', '本地环境，需要获取 Baidu Access Token', 'recognition');
                }
                accessToken = await this.getBaiduAccessToken();
            } else {
                // Vercel 代理环境，跳过 token 获取
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', '使用 Vercel 代理，跳过前端 token 获取（服务端已处理）', 'recognition');
                }
            }
            
            // 调试日志
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `识别请求 - 环境: ${isGitHubPages ? 'GitHub Pages' : '本地/Vercel'}`, 'recognition');
                Debug.log('info', `代理配置: ${configuredBase || '(未配置)'}`, 'proxy');
                Debug.log('info', `请求URL: ${proxyUrl || '(未配置)'}`, 'network');
                Debug.logNetworkRequest(proxyUrl || 'NO_URL', 'POST', { 
                    body: { imageBase64: imageBase64.substring(0, 50) + '...', options: {} }
                });
            }
            
            let response;
            try {
                if (!proxyUrl) {
                    const err = new Error('NO_PROXY_CONFIG');
                    if (typeof Debug !== 'undefined') {
                        Debug.logError(err, '代理URL未配置');
                        Debug.log('error', `代理配置为空！isGitHubPages=${isGitHubPages}, configuredBase=${configuredBase}`, 'proxy');
                    }
                    throw err;
                }
                
                const startTime = Date.now();
                const requestBody = { imageBase64: imageBase64, options: {} };
                const bodySize = JSON.stringify(requestBody).length;
                
            // 调试日志 - 请求前
            if (typeof Debug !== 'undefined') {
                Debug.setLastImage(imageBase64); // 保存图片供查看
                Debug.log('info', `准备发送POST请求，请求体大小: ${(bodySize / 1024).toFixed(2)}KB`, 'network');
                Debug.log('info', `图片数据检查:`, 'network');
                Debug.log('info', `- 原始数据长度: ${imageBase64.length}`, 'network');
                Debug.log('info', `- 是否有data:前缀: ${imageBase64.startsWith('data:')}`, 'network');
                const base64Only = imageBase64.replace(/^data:image\/\w+;base64,/, '');
                Debug.log('info', `- Base64数据长度: ${base64Only.length}`, 'network');
                Debug.log('info', `- Base64前50字符: ${base64Only.substring(0, 50)}...`, 'network');
            }
                
                try {
                    response = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody),
                        mode: 'cors'
                    });
                } catch (fetchErr) {
                    // 捕获 fetch 本身的错误（网络错误、CORS等）
                    if (typeof Debug !== 'undefined') {
                        Debug.logError(fetchErr, 'Fetch请求失败');
                        Debug.log('error', `错误类型: ${fetchErr.name}, 消息: ${fetchErr.message}`, 'network');
                        Debug.log('error', `错误堆栈: ${fetchErr.stack || '无堆栈信息'}`, 'network');
                        Debug.log('error', `请求URL: ${proxyUrl}`, 'network');
                        Debug.log('error', `请求方法: POST, 模式: cors`, 'network');
                    }
                    throw fetchErr;
                }
                
                const endTime = Date.now();
                
                // 调试日志 - 响应后
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', `请求耗时: ${endTime - startTime}ms`, 'network');
                    Debug.log('info', `响应状态: ${response.status} ${response.statusText}`, 'network');
                    Debug.log('info', `响应头: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`, 'network');
                }
                
                // 检查是否是网络错误
                if (!response.ok && response.status === 0) {
                    throw new Error('NETWORK_ERROR - 响应状态为0');
                }
            } catch (fetchError) {
                // 调试日志 - 捕获所有错误
                if (typeof Debug !== 'undefined') {
                    Debug.logError(fetchError, '识别请求异常');
                    Debug.log('error', `错误名称: ${fetchError.name}`, 'error');
                    Debug.log('error', `错误消息: ${fetchError.message}`, 'error');
                    Debug.log('error', `是否网络错误: ${fetchError.message.includes('fetch') || fetchError.message.includes('Failed') || fetchError.message.includes('Network')}`, 'error');
                }
                
                // 代理服务器不可用
                if (isGitHubPages) {
                    const errorMsg = fetchError.message.includes('Failed to fetch') || fetchError.message.includes('load failed')
                        ? `网络连接失败: ${fetchError.message}\n\n请检查:\n1. 代理地址是否正确: ${configuredBase || '未配置'}\n2. 网络是否正常\n3. Vercel 服务是否可用`
                        : 'GitHub Pages需使用云端代理。请在设置中配置 proxyBase 为你的 Vercel 域名，例如：https://你的项目.vercel.app';
                    throw new Error(errorMsg);
                } else {
                    throw new Error('代理服务器未运行！请先运行: node proxy-server.js\n\n如果是在GitHub Pages，识别功能需要本地环境或支持Serverless的平台。');
                }
            }
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            let data;
            try {
                data = await response.json();
            } catch (jsonError) {
                // 如果JSON解析失败，尝试读取原始文本
                const text = await response.text();
                if (typeof Debug !== 'undefined') {
                    Debug.log('error', `JSON解析失败，原始响应: ${text.substring(0, 1000)}`, 'error');
                }
                throw new Error(`响应解析失败: ${jsonError.message}\n原始响应: ${text.substring(0, 200)}`);
            }
            
            // 调试日志 - 记录完整响应（不截断）
            if (typeof Debug !== 'undefined') {
                const fullResponse = JSON.stringify(data, null, 2);
                Debug.log('info', `百度API完整响应:`, 'network');
                Debug.log('info', fullResponse, 'network');
                Debug.log('info', `响应结构分析:`, 'network');
                Debug.log('info', `- error_code: ${data.error_code || 'null'}`, 'network');
                Debug.log('info', `- error_msg: ${data.error_msg || 'null'}`, 'network');
                Debug.log('info', `- words_result: ${data.words_result ? `${data.words_result.length}个结果` : 'null/undefined'}`, 'network');
                if (data.words_result && data.words_result.length > 0) {
                    Debug.log('info', `- 第一个结果: ${JSON.stringify(data.words_result[0])}`, 'network');
                }
            }
            
            // 检查是否有错误代码（包括代理返回的调试信息）
            if (data.error_code || data._proxy_info?.has_error_code) {
                const errorCode = data.error_code || data._proxy_info?.error_code;
                const errorMsg = data.error_msg || data._proxy_info?.error_msg || '未知错误';
                const fullErrorMsg = `百度API错误 [${errorCode}]: ${errorMsg}`;
                if (typeof Debug !== 'undefined') {
                    Debug.log('error', fullErrorMsg, 'error');
                    if (data._proxy_info) {
                        Debug.log('error', `代理调试信息: ${JSON.stringify(data._proxy_info)}`, 'error');
                    }
                }
                throw new Error(fullErrorMsg);
            }
            
            // 检查是否有其他错误字段
            if (data.error) {
                if (typeof Debug !== 'undefined') {
                    Debug.log('error', `Vercel代理错误: ${data.error}`, 'error');
                    if (data.details) {
                        Debug.log('error', `详细信息: ${data.details}`, 'error');
                    }
                }
                throw new Error(`代理错误: ${data.error}`);
            }
            
            // 解析结果
            if (data.words_result && data.words_result.length > 0) {
                let word = data.words_result[0].words.trim();
                
                // 调试日志
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', `识别到的文字: "${word}"`, 'recognition');
                }
                
            // 如果识别结果是词组，提取第一个字
            // 因为题目要求写单个字，识别可能返回词组
            // 但先保留原结果，让对比逻辑来处理
            // word保持原样，在对比时处理
                
                const confidence = data.words_result[0].probability?.average || 0.8;
                
                // 调试日志
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', `置信度: ${confidence}`, 'recognition');
                }
                
                return {
                    recognized: word,
                    confidence: confidence
                };
            }
            
            // 没有识别结果
            if (typeof Debug !== 'undefined') {
                Debug.log('warning', `百度API返回空结果。完整响应: ${JSON.stringify(data)}`, 'recognition');
            }
            
            return {
                recognized: '',
                confidence: 0
            };
        } catch (error) {
            // 处理网络错误
            if (error.message.includes('Failed to fetch') || error.message.includes('CORS') || error.message === 'NETWORK_ERROR') {
                const isGitHubPages = window.location.hostname.includes('github.io') || 
                                     window.location.hostname.includes('github.com');
                if (isGitHubPages) {
                    throw new Error('⚠️ GitHub Pages限制：无法运行代理服务器，识别功能不可用。\n\n解决方案：\n1. 在本地使用（运行 node proxy-server.js）\n2. 使用 Vercel 部署（支持 Serverless Functions）\n3. 或访问本地版本');
                } else {
                    throw new Error('代理服务器未运行！请先运行: node proxy-server.js');
                }
            }
            throw error;
        }
    },
    
    /**
     * 获取百度Access Token
     */
    async getBaiduAccessToken() {
        // 从缓存中获取（token有效期为30天）
        const cachedToken = localStorage.getItem('baidu_access_token');
        const cachedExpiry = localStorage.getItem('baidu_token_expiry');
        
        if (cachedToken && cachedExpiry && Date.now() < parseInt(cachedExpiry)) {
            return cachedToken;
        }
        
        // 获取新token
        if (!this.apiConfig.apiKey || !this.apiConfig.apiSecret) {
            throw new Error('请先配置百度API Key和Secret');
        }
        
        try {
            // 使用本地代理服务器获取Token
            const proxyUrl = `http://localhost:3001/api/oauth/token?client_id=${this.apiConfig.apiKey}&client_secret=${this.apiConfig.apiSecret}`;
            
            const response = await fetch(proxyUrl, { mode: 'cors' });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: 获取Token失败`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(`获取Token失败: ${data.error_description}`);
            }
            
            // 缓存token
            const expiry = Date.now() + (data.expires_in - 3600) * 1000; // 提前1小时刷新
            localStorage.setItem('baidu_access_token', data.access_token);
            localStorage.setItem('baidu_token_expiry', expiry.toString());
            
            return data.access_token;
        } catch (error) {
            // 处理网络错误
            if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                throw new Error('获取Token失败：请先启动代理服务器（运行: node proxy-server.js）');
            }
            throw error;
        }
    },
    
    /**
     * 腾讯云OCR识别（占位）
     */
    async recognizeTencent(imageBase64) {
        // TODO: 实现腾讯云OCR
        throw new Error('腾讯云OCR暂未实现');
    },
    
    /**
     * 讯飞识别（占位）
     */
    async recognizeIflytek(imageBase64) {
        // TODO: 实现讯飞识别
        throw new Error('讯飞识别暂未实现');
    },
    
    /**
     * 设置API配置
     */
    setConfig(config) {
        this.apiConfig = { ...this.apiConfig, ...config };
        
        // 保存到设置
        const settings = Storage.getSettings();
        settings.recognitionConfig = this.apiConfig;
        Storage.saveSettings(settings);
    }
};

// 初始化
Recognition.init();