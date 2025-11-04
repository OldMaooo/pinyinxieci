/**
 * API配置模块
 * 在这里配置识别API的密钥
 */

const Config = {
    // 百度AI配置
    baidu: {
        apiKey: 'I5GgApEgTLLmcqJaPQutcCji',
        apiSecret: 'LKJO42W2bBjJ6N12GrjOsGMZAFUmzAbo'
    },
    
    /**
     * 初始化配置
     */
    init() {
        // 从LocalStorage读取配置（如果用户通过界面修改过）
        const savedConfig = localStorage.getItem('recognition_config');
        if (savedConfig) {
            try {
                const config = JSON.parse(savedConfig);
                this.baidu = { ...this.baidu, ...config.baidu };
            } catch (e) {
                console.warn('读取配置失败，使用默认配置');
            }
        }
        
        // 应用到识别模块
        if (typeof Recognition !== 'undefined') {
            Recognition.setConfig({
                provider: 'baidu',
                apiKey: this.baidu.apiKey,
                apiSecret: this.baidu.apiSecret,
                threshold: 0.75  // 正常阈值（更严格）
            });
        }
    },
    
    /**
     * 保存配置
     */
    save(config) {
        this.baidu = { ...this.baidu, ...config.baidu };
        localStorage.setItem('recognition_config', JSON.stringify({ baidu: this.baidu }));
        
        // 更新识别模块
        if (typeof Recognition !== 'undefined') {
            Recognition.setConfig({
                provider: 'baidu',
                apiKey: this.baidu.apiKey,
                apiSecret: this.baidu.apiSecret,
                threshold: 0.75  // 正常阈值（更严格）
            });
        }
    }
};

// 注意：初始化会在main.js中调用，确保所有模块都已加载
