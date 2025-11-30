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
    
    // Supabase 配置（单用户模式）
    supabase: {
        url: 'https://sbibgxbdutqrfengbwyc.supabase.co', // XIEZI 项目 URL
        anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNiaWJneGJkdXRxcmZlbmdid3ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1MDc5MDAsImV4cCI6MjA4MDA4MzkwMH0.fsQQgn0aVwcvlv7bNLP2ilgDB7YplTnxQIcxhGGERKU' // XIEZI 项目 anonKey
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
        
        // 从LocalStorage读取Supabase配置（优先使用localStorage中的配置）
        const savedSupabaseConfig = localStorage.getItem('supabase_config');
        if (savedSupabaseConfig) {
            try {
                const supabaseConfig = JSON.parse(savedSupabaseConfig);
                if (supabaseConfig.url && supabaseConfig.anonKey) {
                    this.supabase = { ...this.supabase, ...supabaseConfig };
                    console.log('[Config] 从 localStorage 加载 Supabase 配置');
                }
            } catch (e) {
                console.warn('[Config] 读取 Supabase 配置失败，使用默认配置');
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
    },
    
    /**
     * 保存 Supabase 配置
     */
    saveSupabase(config) {
        this.supabase = { ...this.supabase, ...config };
        localStorage.setItem('supabase_config', JSON.stringify(this.supabase));
        console.log('[Config] Supabase 配置已保存到 localStorage');
    },
    
    /**
     * 获取 Supabase 配置
     */
    getSupabase() {
        // 优先从 localStorage 读取
        const savedSupabaseConfig = localStorage.getItem('supabase_config');
        if (savedSupabaseConfig) {
            try {
                const supabaseConfig = JSON.parse(savedSupabaseConfig);
                if (supabaseConfig.url && supabaseConfig.anonKey) {
                    return supabaseConfig;
                }
            } catch (e) {
                console.warn('[Config] 读取 Supabase 配置失败');
            }
        }
        // 回退到代码中的配置
        return this.supabase;
    }
};

// 注意：初始化会在main.js中调用，确保所有模块都已加载
