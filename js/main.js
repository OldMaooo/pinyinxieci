/**
 * 主入口模块
 * 路由管理和页面初始化
 */

const Main = {
    /**
     * 初始化
     */
    init() {
        // 初始化配置
        if (typeof Config !== 'undefined') {
            Config.init();
        }
        
        // 初始化手写输入
        Handwriting.init('handwriting-canvas');
        
        // 加载首页统计
        Statistics.updateHomeStats();
        
        // 加载题库列表
        WordBank.loadWordBank();
        
        // 加载错题本
        ErrorBook.load();
        
        // 初始化路由
        this.initRouter();
        
        // 绑定导航链接
        this.bindNavLinks();
        
        // 绑定结果页面按钮
        this.bindResultButtons();
        
        // 检查API配置
        this.checkAPIConfig();
        
        // 初始化题库范围选择器
        if (typeof PracticeRange !== 'undefined') {
            // 延迟初始化，确保Storage已初始化
            setTimeout(() => {
                PracticeRange.init();
            }, 500);
        }
    },
    
    /**
     * 检查API配置
     */
    checkAPIConfig() {
        if (typeof Recognition !== 'undefined') {
            const config = Recognition.apiConfig;
            if (config.apiKey && config.apiSecret) {
                console.log('✅ 识别API配置成功');
            } else {
                console.warn('⚠️ API未配置，请检查config.js文件');
            }
        }
    },
    
    /**
     * 初始化路由
     */
    initRouter() {
        // 处理hash变化
        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.substring(1) || 'home';
            this.showPage(hash);
        });
        
        // 初始页面
        const hash = window.location.hash.substring(1) || 'home';
        this.showPage(hash);
    },
    
    /**
     * 显示指定页面
     */
    showPage(pageId) {
        // 隐藏所有页面
        document.querySelectorAll('.page-section').forEach(section => {
            section.classList.add('d-none');
            section.classList.remove('active');
        });
        
        // 显示目标页面
        const targetPage = document.getElementById(pageId);
        if (targetPage) {
            targetPage.classList.remove('d-none');
            targetPage.classList.add('active');
            
            // 如果是练习页面，重新初始化范围选择器
            if (pageId === 'practice' && typeof PracticeRange !== 'undefined') {
                setTimeout(() => {
                    PracticeRange.init();
                }, 100);
            }
        }
        
        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) {
                link.classList.add('active');
            }
        });
        
        // 特殊处理：如果显示错题本或题库管理，刷新数据
        if (pageId === 'errorbook') {
            ErrorBook.load();
        } else if (pageId === 'wordbank') {
            WordBank.loadWordBank();
        }
    },
    
    /**
     * 绑定导航链接
     */
    bindNavLinks() {
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const href = link.getAttribute('href');
                if (href.startsWith('#')) {
                    this.showPage(href.substring(1));
                    window.location.hash = href.substring(1);
                }
            });
        });
    },
    
    /**
     * 绑定结果页面按钮
     */
    bindResultButtons() {
        const reviewBtn = document.getElementById('review-errors-btn');
        const practiceAgainBtn = document.getElementById('practice-again-btn');
        
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                // 从练习记录中获取错题，然后开始练习
                this.showPage('practice');
                // TODO: 设置练习范围为错题
                document.getElementById('practice-range-select').value = 'error';
            });
        }
        
        if (practiceAgainBtn) {
            practiceAgainBtn.addEventListener('click', () => {
                this.showPage('practice');
            });
        }
    },
    
    /**
     * 显示结果页面（供其他模块调用）
     */
    showResults(logId) {
        Statistics.showResults(logId);
        this.showPage('results');
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});
