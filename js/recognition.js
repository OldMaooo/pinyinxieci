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
        threshold: 0.6 // 置信度阈值（降低以提高容错率）
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
    },
    
    /**
     * 识别手写字
     * @param {string} imageBase64 - Canvas快照的Base64数据
     * @param {string} expectedWord - 期望的字（用于对比）
     * @returns {Promise<{success: boolean, recognized: string, confidence: number, match: boolean}>}
     */
    async recognize(imageBase64, expectedWord) {
        try {
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
            
            // 降低阈值，提高容错率（允许字迹不太美观但正确的字通过）
            // 置信度阈值从0.85降至0.6，因为手写识别本身有误差，且孩子字迹可能不够美观
            const effectiveThreshold = Math.min(this.apiConfig.threshold, 0.6);
            const minThreshold = 0.5; // 最低容忍度
            
            // 如果匹配且置信度在最低容忍度以上，就通过
            // 即使置信度略低（0.5-0.6），只要字匹配就通过（防止字迹不美观但正确的字被判错）
            let passed = false;
            if (match) {
                if (result.confidence >= effectiveThreshold) {
                    passed = true; // 标准通过
                } else if (result.confidence >= minThreshold) {
                    passed = true; // 容错通过（字匹配但置信度略低）
                    console.log(`字匹配但置信度较低(${result.confidence.toFixed(2)})，容错通过`);
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
        
        // 获取access_token
        const accessToken = await this.getBaiduAccessToken();
        
        try {
            // 使用本地代理服务器
            const proxyUrl = 'http://localhost:3001/api/ocr/handwriting';
            
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams({
                    access_token: accessToken,
                    image: base64Data
                }),
                mode: 'cors'
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            if (data.error_code) {
                throw new Error(`百度API错误: ${data.error_msg}`);
            }
            
            // 解析结果
            if (data.words_result && data.words_result.length > 0) {
                let word = data.words_result[0].words.trim();
                
            // 如果识别结果是词组，提取第一个字
            // 因为题目要求写单个字，识别可能返回词组
            // 但先保留原结果，让对比逻辑来处理
            // word保持原样，在对比时处理
                
                const confidence = data.words_result[0].probability?.average || 0.8;
                return {
                    recognized: word,
                    confidence: confidence
                };
            }
            
            return {
                recognized: '',
                confidence: 0
            };
        } catch (error) {
            // 处理网络错误
            if (error.message.includes('Failed to fetch') || error.message.includes('CORS')) {
                throw new Error('代理服务器未运行！请先运行: node proxy-server.js');
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