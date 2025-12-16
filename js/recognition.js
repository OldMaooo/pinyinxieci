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
     * 诊断函数 - 输出完整的调试信息
     * 可在浏览器控制台调用：Recognition.diagnose()
     * 或通过浏览器 MCP 工具调用
     */
    async diagnose() {
        const diagnosis = {
            timestamp: new Date().toISOString(),
            environment: {
                hostname: window.location.hostname,
                origin: window.location.origin,
                isGitHubPages: window.location.hostname.includes('github.io') || window.location.hostname.includes('github.com'),
                isLocal: window.location.hostname.includes('localhost'),
                isVercel: window.location.hostname.includes('vercel.app'),
                userAgent: navigator.userAgent
            },
            proxy: {
                hasAppConfig: !!window.APP_CONFIG,
                appConfigProxy: window.APP_CONFIG?.proxyBase || null,
                localStorageProxy: localStorage.getItem('proxyBase') || null,
                configuredBase: (window.APP_CONFIG && window.APP_CONFIG.proxyBase) || localStorage.getItem('proxyBase') || '(未配置)'
            },
            apiConfig: {
                hasConfig: !!this.apiConfig,
                provider: this.apiConfig?.provider || null,
                hasApiKey: !!(this.apiConfig?.apiKey),
                hasApiSecret: !!(this.apiConfig?.apiSecret)
            },
            testResults: {}
        };
        
        // 测试代理连接
        const proxyBase = diagnosis.proxy.configuredBase;
        if (proxyBase && proxyBase !== '(未配置)') {
            try {
                const testUrl = `${proxyBase.replace(/\/$/, '')}/api/baidu-proxy`;
                console.log(`[Diagnosis] 测试代理连接: ${testUrl}`);
                const startTime = Date.now();
                const response = await fetch(testUrl, { 
                    method: 'GET', 
                    cache: 'no-cache',
                    signal: AbortSignal.timeout(5000)
                });
                const responseTime = Date.now() - startTime;
                const data = await response.json();
                
                diagnosis.testResults.proxy = {
                    success: response.ok,
                    status: response.status,
                    responseTime: `${responseTime}ms`,
                    response: data,
                    hasEnvVars: data.env || null
                };
            } catch (error) {
                diagnosis.testResults.proxy = {
                    success: false,
                    error: error.message,
                    errorName: error.name
                };
            }
        } else {
            diagnosis.testResults.proxy = {
                success: false,
                error: '代理未配置'
            };
        }
        
        // 输出诊断结果
        console.group('🔍 Recognition 诊断报告');
        console.log('完整诊断数据:', diagnosis);
        console.log('JSON格式:', JSON.stringify(diagnosis, null, 2));
        console.groupEnd();
        
        // 返回诊断结果（方便 MCP 工具获取）
        return diagnosis;
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
    async autoConfigureProxy() {
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        
        if (!isGitHubPages) {
            return; // 非 GitHub Pages 环境，使用同源代理
        }
        
        // 检查是否已配置
        const existingProxy = localStorage.getItem('proxyBase');
        if (existingProxy && existingProxy.trim()) {
            // 已配置，验证是否可用（异步验证，不阻塞）
            const testUrl = `${existingProxy.replace(/\/$/, '')}/api/baidu-proxy`;
            fetch(testUrl, { method: 'GET', cache: 'no-cache' })
                .then(response => {
                    if (response.ok) {
                        if (typeof Debug !== 'undefined') {
                            Debug.log('info', `代理地址已验证可用: ${existingProxy}`, 'proxy');
                        }
                    } else {
                        // 代理不可用，使用默认值
                        this._setDefaultProxy();
                    }
                })
                .catch(() => {
                    // 代理不可用，使用默认值
                    this._setDefaultProxy();
                });
            return;
        }
        
        // 未配置，自动设置默认 Vercel 代理
        this._setDefaultProxy();
    },
    
    /**
     * 设置默认代理地址
     */
    _setDefaultProxy() {
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
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/4e26bd29-6c91-4533-882c-1b2ef6d05ba3',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'js/recognition.js:recognize',message:'recognize entry',data:{provider:this.apiConfig.provider,expectedWord,imageBase64Length:imageBase64?.length},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
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
        const requestId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const startTime = Date.now();
        
        // 统一的 console 日志函数，方便浏览器 MCP 工具查看
        const consoleLog = (level, message, data = null) => {
            const logEntry = {
                requestId,
                timestamp: new Date().toISOString(),
                level,
                message,
                ...(data && { data })
            };
            const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
            logMethod(`[Recognition ${requestId}]`, message, data || '');
            // 同时输出结构化数据，方便 MCP 工具解析
            logMethod(`[Recognition ${requestId} JSON]`, JSON.stringify(logEntry, null, 2));
        };
        
        // 移除data:image/png;base64,前缀（如果存在）
        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        
        consoleLog('info', '开始识别请求', {
            imageBase64Length: imageBase64.length,
            base64DataLength: base64Data.length,
            hasDataPrefix: imageBase64.startsWith('data:')
        });
        
        try {
            // 检测是否在GitHub Pages环境
            const isGitHubPages = window.location.hostname.includes('github.io') || 
                                  window.location.hostname.includes('github.com');
            
            consoleLog('info', '环境检测', {
                hostname: window.location.hostname,
                isGitHubPages,
                isLocal: window.location.hostname.includes('localhost'),
                isVercel: window.location.hostname.includes('vercel.app')
            });
            
            // 优先使用同源 Serverless（Vercel 部署）/api/baidu-proxy；
            // GitHub Pages 环境则尝试使用设置里的代理地址（APP设置或localStorage: proxyBase）
            // 本地环境使用本地代理服务器
            let configuredBase = (window.APP_CONFIG && window.APP_CONFIG.proxyBase) || localStorage.getItem('proxyBase') || '';
            
            consoleLog('info', '代理配置检查', {
                hasAppConfig: !!window.APP_CONFIG,
                appConfigProxy: window.APP_CONFIG?.proxyBase || null,
                localStorageProxy: localStorage.getItem('proxyBase') || null,
                configuredBase: configuredBase || '(未配置)'
            });
            
            // 如果 GitHub Pages 环境且未配置，尝试自动配置
            if (isGitHubPages && !configuredBase) {
                const defaultProxy = 'https://pinyinxieci.vercel.app';
                configuredBase = defaultProxy;
                localStorage.setItem('proxyBase', defaultProxy);
                consoleLog('warn', '自动配置代理地址', { defaultProxy });
                if (typeof Debug !== 'undefined') {
                    Debug.log('warning', `GitHub Pages环境未配置代理，已自动设置为: ${defaultProxy}`, 'proxy');
                }
            }
            
            const isLocal = !isGitHubPages && !window.location.hostname.includes('vercel.app') && window.location.hostname.includes('localhost');
            const sameOriginUrl = '/api/baidu-proxy';
            const localProxyUrl = 'http://localhost:3001/api/baidu-proxy';
            const proxyUrl = isGitHubPages
                ? (configuredBase ? `${configuredBase.replace(/\/$/, '')}/api/baidu-proxy` : '')
                : (isLocal ? localProxyUrl : sameOriginUrl);
            
            consoleLog('info', '代理URL确定', {
                isLocal,
                isGitHubPages,
                sameOriginUrl,
                localProxyUrl,
                configuredBase: configuredBase || '(未配置)',
                finalProxyUrl: proxyUrl || '(未配置)'
            });
            
            // 注意：使用 Vercel 代理时，不需要前端获取 token（Vercel 函数内部已处理）
            // 只有在本地代理服务器环境下才需要获取 token
            let accessToken = null;
            if (isLocal) {
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
                    consoleLog('error', '代理URL未配置', {
                        isGitHubPages,
                        configuredBase: configuredBase || '(未配置)',
                        error: err.message
                    });
                    if (typeof Debug !== 'undefined') {
                        Debug.logError(err, '代理URL未配置');
                        Debug.log('error', `代理配置为空！isGitHubPages=${isGitHubPages}, configuredBase=${configuredBase}`, 'proxy');
                    }
                    throw err;
                }
                
                const fetchStartTime = Date.now();
                // 本地环境需要传递 token，Vercel 环境不需要
                const requestBody = isLocal && accessToken
                    ? { imageBase64: imageBase64, access_token: accessToken, options: {} }
                    : { imageBase64: imageBase64, options: {} };
                const bodySize = JSON.stringify(requestBody).length;
                
                consoleLog('info', '准备发送请求', {
                    url: proxyUrl,
                    method: 'POST',
                    bodySize: `${(bodySize / 1024).toFixed(2)}KB`,
                    hasAccessToken: !!(isLocal && accessToken),
                    isLocal,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
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
                    consoleLog('info', '开始 fetch 请求', { url: proxyUrl });
                    response = await fetch(proxyUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody),
                        mode: 'cors'
                    });
                    const fetchTime = Date.now() - fetchStartTime;
                    consoleLog('info', 'Fetch 请求完成', {
                        status: response.status,
                        statusText: response.statusText,
                        fetchTime: `${fetchTime}ms`,
                        headers: Object.fromEntries(response.headers.entries())
                    });
                } catch (fetchErr) {
                    const fetchTime = Date.now() - fetchStartTime;
                    // 捕获 fetch 本身的错误（网络错误、CORS等）
                    consoleLog('error', 'Fetch 请求失败', {
                        errorName: fetchErr.name,
                        errorMessage: fetchErr.message,
                        errorStack: fetchErr.stack,
                        url: proxyUrl,
                        method: 'POST',
                        mode: 'cors',
                        fetchTime: `${fetchTime}ms`
                    });
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
                const totalTime = endTime - startTime;
                
                consoleLog('info', '响应接收完成', {
                    status: response.status,
                    statusText: response.statusText,
                    totalTime: `${totalTime}ms`,
                    fetchTime: `${Date.now() - fetchStartTime}ms`
                });
                
                // 调试日志 - 响应后
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', `请求耗时: ${endTime - fetchStartTime}ms`, 'network');
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
                    // 提供更详细的错误信息和解决方案
                    let errorMsg = '';
                    if (fetchError.message.includes('Failed to fetch') || fetchError.message.includes('load failed') || fetchError.name === 'TypeError') {
                        errorMsg = `❌ 无法连接到识别代理服务器\n\n` +
                            `当前配置的代理地址: ${configuredBase || '未配置'}\n\n` +
                            `可能的原因：\n` +
                            `1. Vercel代理服务已失效或未部署\n` +
                            `2. 代理地址配置错误\n` +
                            `3. 网络连接问题\n\n` +
                            `解决方案：\n` +
                            `1. 检查Vercel项目是否正常运行（访问 https://你的项目.vercel.app/api/baidu-proxy）\n` +
                            `2. 在"设置"→"识别服务配置"中更新代理地址\n` +
                            `3. 如果Vercel项目已失效，需要重新部署（参考 docs/Vercel代理部署说明.md）`;
                    } else {
                        errorMsg = `❌ 识别服务错误: ${fetchError.message}\n\n` +
                            `当前代理地址: ${configuredBase || '未配置'}\n\n` +
                            `请检查代理服务是否正常运行。`;
                    }
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
                const responseText = await response.text();
                consoleLog('info', '响应文本接收', {
                    textLength: responseText.length,
                    preview: responseText.substring(0, 200)
                });
                data = JSON.parse(responseText);
                consoleLog('info', '响应JSON解析成功', {
                    hasErrorCode: !!data.error_code,
                    errorCode: data.error_code || null,
                    errorMsg: data.error_msg || null,
                    hasWordsResult: !!data.words_result,
                    wordsResultCount: data.words_result ? data.words_result.length : 0,
                    hasProxyInfo: !!data._proxy_info,
                    proxyInfo: data._proxy_info || null
                });
            } catch (jsonError) {
                // 如果JSON解析失败，尝试读取原始文本
                const text = await response.text();
                consoleLog('error', 'JSON解析失败', {
                    error: jsonError.message,
                    responseText: text.substring(0, 500),
                    status: response.status
                });
                if (typeof Debug !== 'undefined') {
                    Debug.log('error', `JSON解析失败，原始响应: ${text.substring(0, 1000)}`, 'error');
                }
                throw new Error(`响应解析失败: ${jsonError.message}\n原始响应: ${text.substring(0, 200)}`);
            }
            
            // 调试日志 - 记录完整响应（不截断）
            consoleLog('info', '响应数据分析', {
                errorCode: data.error_code || null,
                errorMsg: data.error_msg || null,
                wordsResultCount: data.words_result ? data.words_result.length : 0,
                firstWord: data.words_result && data.words_result.length > 0 ? data.words_result[0].words : null,
                proxyInfo: data._proxy_info || null
            });
            
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
                
                // 百度API常见错误码的友好提示
                const errorMessages = {
                    17: {
                        title: '📊 API每日请求限制已到达',
                        message: '今日的识别次数已用完',
                        solution: '请等待明天（北京时间0点）重置，或升级百度AI套餐以增加每日配额。\n\n免费版每日有500次调用限制。',
                        isQuotaError: true
                    },
                    18: {
                        title: '⚠️ API调用频率超限',
                        message: '请求过于频繁，请稍后再试',
                        solution: '请等待几秒后重试，或降低使用频率。',
                        isQuotaError: false
                    },
                    19: {
                        title: '❌ API配额不足',
                        message: '账户配额已用完',
                        solution: '请前往百度AI开放平台充值或升级套餐。',
                        isQuotaError: true
                    },
                    100: {
                        title: '❌ 参数错误',
                        message: '请求参数不正确',
                        solution: '请检查图片数据是否正确。如果问题持续，请联系技术支持。',
                        isQuotaError: false
                    },
                    110: {
                        title: '🔑 Access Token无效',
                        message: 'API密钥验证失败',
                        solution: '请检查Vercel环境变量中的BAIDU_API_KEY和BAIDU_SECRET_KEY是否正确配置。',
                        isQuotaError: false
                    },
                    111: {
                        title: '🔑 Access Token过期',
                        message: 'API密钥已过期',
                        solution: '系统会自动刷新，请稍后重试。如果问题持续，请检查Vercel环境变量配置。',
                        isQuotaError: false
                    }
                };
                
                const errorInfo = errorMessages[errorCode] || {
                    title: `❌ 百度API错误 [${errorCode}]`,
                    message: errorMsg,
                    solution: '请查看控制台日志获取详细信息，或联系技术支持。',
                    isQuotaError: false
                };
                
                // 构建友好的错误消息
                const fullErrorMsg = errorInfo.isQuotaError
                    ? `${errorInfo.title}\n\n${errorInfo.message}\n\n${errorInfo.solution}`
                    : `${errorInfo.title}\n\n${errorInfo.message}\n\n解决方案：\n${errorInfo.solution}`;
                
                consoleLog('error', '百度API错误', {
                    errorCode,
                    errorMsg,
                    errorInfo,
                    proxyInfo: data._proxy_info
                });
                
                if (typeof Debug !== 'undefined') {
                    Debug.log('error', `百度API错误 [${errorCode}]: ${errorMsg}`, 'error');
                    Debug.log('error', `错误详情: ${errorInfo.title}`, 'error');
                    if (data._proxy_info) {
                        Debug.log('error', `代理调试信息: ${JSON.stringify(data._proxy_info)}`, 'error');
                    }
                }
                
                // 创建错误对象，包含更多信息
                const error = new Error(fullErrorMsg);
                error.errorCode = errorCode;
                error.errorInfo = errorInfo;
                error.isQuotaError = errorInfo.isQuotaError;
                throw error;
            }
            
            // 检查是否有其他错误字段
            if (data.error) {
                consoleLog('error', 'Vercel代理错误', {
                    error: data.error,
                    details: data.details,
                    requestId: data.requestId
                });
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
                const confidence = data.words_result[0].probability?.average || 0.8;
                
                consoleLog('info', '识别成功', {
                    recognized: word,
                    confidence,
                    totalTime: `${Date.now() - startTime}ms`,
                    proxyInfo: data._proxy_info
                });
                
                // 调试日志
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', `识别到的文字: "${word}"`, 'recognition');
                    Debug.log('info', `置信度: ${confidence}`, 'recognition');
                }
                
                return {
                    recognized: word,
                    confidence: confidence
                };
            }
            
            // 没有识别结果
            consoleLog('warn', '识别结果为空', {
                responseData: data,
                totalTime: `${Date.now() - startTime}ms`
            });
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