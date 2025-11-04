/**
 * 可视化调试模块
 * 用于在iPad等设备上直接查看调试信息，无需开发者工具
 */

const Debug = {
    logs: [],
    maxLogs: 100,
    
    /**
     * 初始化调试面板
     */
    init() {
        const toggleBtn = document.getElementById('debug-toggle-btn');
        const closeBtn = document.getElementById('debug-close-btn');
        const panel = document.getElementById('debug-panel');
        const refreshBtn = document.getElementById('debug-refresh-btn');
        const testProxyBtn = document.getElementById('debug-test-proxy-btn');
        const clearBtn = document.getElementById('debug-clear-btn');
        const exportBtn = document.getElementById('debug-export-btn');
        const copyAllBtn = document.getElementById('debug-copy-all-btn');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggle());
        }
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
        
        if (testProxyBtn) {
            testProxyBtn.addEventListener('click', () => this.testProxy());
        }
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearLogs());
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportLogs());
        }
        
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => this.copyAllLogs());
        }
        
        // 初始化显示
        this.refresh();
        this.log('info', '调试面板已初始化', 'env');
    },
    
    /**
     * 显示/隐藏调试面板
     */
    toggle() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.classList.toggle('d-none');
            if (!panel.classList.contains('d-none')) {
                this.refresh();
            }
        }
    },
    
    /**
     * 隐藏调试面板
     */
    hide() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            panel.classList.add('d-none');
        }
    },
    
    /**
     * 刷新状态显示
     */
    refresh() {
        this.updateEnvInfo();
        this.updateProxyInfo();
    },
    
    /**
     * 更新环境信息
     */
    updateEnvInfo() {
        const envDiv = document.getElementById('debug-env');
        if (!envDiv) return;
        
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        const isVercel = window.location.hostname.includes('vercel.app');
        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
        
        envDiv.innerHTML = `
            <div><strong>URL:</strong> ${window.location.href}</div>
            <div><strong>Hostname:</strong> ${window.location.hostname}</div>
            <div><strong>Protocol:</strong> ${window.location.protocol}</div>
            <div><strong>环境:</strong> 
                <span class="badge ${isGitHubPages ? 'bg-warning' : isVercel ? 'bg-success' : isLocal ? 'bg-info' : 'bg-secondary'}">
                    ${isGitHubPages ? 'GitHub Pages' : isVercel ? 'Vercel' : isLocal ? '本地' : '其他'}
                </span>
            </div>
            <div><strong>User Agent:</strong> <small>${navigator.userAgent.substring(0, 50)}...</small></div>
            <div><strong>在线状态:</strong> 
                <span class="badge ${navigator.onLine ? 'bg-success' : 'bg-danger'}">
                    ${navigator.onLine ? '在线' : '离线'}
                </span>
            </div>
        `;
    },
    
    /**
     * 更新代理配置信息
     */
    updateProxyInfo() {
        const proxyDiv = document.getElementById('debug-proxy');
        if (!proxyDiv) return;
        
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        const proxyBase = localStorage.getItem('proxyBase') || '';
        const configuredProxy = proxyBase || (isGitHubPages ? 'https://pinyinxieci.vercel.app' : '/api/baidu-proxy');
        
        let statusHtml = '';
        if (isGitHubPages) {
            if (proxyBase) {
                statusHtml = `<span class="badge bg-success">已配置</span>`;
            } else {
                statusHtml = `<span class="badge bg-warning">使用默认</span>`;
            }
        } else {
            statusHtml = `<span class="badge bg-info">本地/同源</span>`;
        }
        
        proxyDiv.innerHTML = `
            <div><strong>状态:</strong> ${statusHtml}</div>
            <div><strong>代理地址:</strong> <code>${configuredProxy}</code></div>
            <div><strong>完整URL:</strong> <code>${configuredProxy.replace(/\/$/, '')}/api/baidu-proxy</code></div>
            <div><strong>localStorage:</strong> <code>${proxyBase || '(未设置)'}</code></div>
        `;
    },
    
    /**
     * 添加日志
     */
    log(level, message, tag = '') {
        const timestamp = new Date().toLocaleTimeString('zh-CN');
        const logEntry = {
            timestamp,
            level,
            message,
            tag
        };
        
        this.logs.push(logEntry);
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.renderLogs();
    },
    
    /**
     * 渲染日志
     */
    renderLogs() {
        const logsDiv = document.getElementById('debug-logs');
        const countBadge = document.getElementById('debug-log-count');
        
        if (!logsDiv) return;
        
        logsDiv.innerHTML = this.logs.map(log => {
            const tagHtml = log.tag ? `<span class="log-tag tag-${log.tag}">${log.tag}</span>` : '';
            return `
                <div class="log-item log-${log.level}">
                    <span class="log-time">${log.timestamp}</span>
                    ${tagHtml}
                    ${log.message}
                </div>
            `;
        }).reverse().join('');
        
        // 自动滚动到底部
        logsDiv.scrollTop = logsDiv.scrollHeight;
        
        if (countBadge) {
            countBadge.textContent = this.logs.length;
        }
    },
    
    /**
     * 清空日志
     */
    clearLogs() {
        this.logs = [];
        this.renderLogs();
        this.log('info', '日志已清空', 'env');
    },
    
    /**
     * 导出日志
     */
    exportLogs() {
        const logText = JSON.stringify({
            timestamp: new Date().toISOString(),
            environment: {
                url: window.location.href,
                hostname: window.location.hostname,
                userAgent: navigator.userAgent,
                online: navigator.onLine
            },
            proxy: {
                base: localStorage.getItem('proxyBase') || '',
                configured: localStorage.getItem('proxyBase') || 'https://pinyinxieci.vercel.app'
            },
            logs: this.logs
        }, null, 2);
        
        const blob = new Blob([logText], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `debug-logs-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.log('success', '日志已导出', 'env');
    },
    
    /**
     * 复制所有日志到剪贴板
     */
    copyAllLogs() {
        const logsText = this.logs.map(log => {
            const tagStr = log.tag ? `[${log.tag}] ` : '';
            return `${log.timestamp} ${tagStr}${log.message}`;
        }).reverse().join('\n');
        
        // 添加环境信息
        const envInfo = `=== 调试日志 ===
时间: ${new Date().toLocaleString('zh-CN')}
URL: ${window.location.href}
环境: ${window.location.hostname.includes('github.io') ? 'GitHub Pages' : window.location.hostname.includes('vercel.app') ? 'Vercel' : '本地'}
代理: ${localStorage.getItem('proxyBase') || '(未配置)'}

=== 日志内容 ===
${logsText}`;
        
        // 使用 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(envInfo).then(() => {
                this.log('success', '✅ 所有日志已复制到剪贴板', 'env');
                // 临时更新按钮文本
                const copyBtn = document.getElementById('debug-copy-all-btn');
                if (copyBtn) {
                    const originalText = copyBtn.innerHTML;
                    copyBtn.innerHTML = '<i class="bi bi-check"></i> 已复制';
                    copyBtn.classList.add('btn-success');
                    copyBtn.classList.remove('btn-outline-dark');
                    setTimeout(() => {
                        copyBtn.innerHTML = originalText;
                        copyBtn.classList.remove('btn-success');
                        copyBtn.classList.add('btn-outline-dark');
                    }, 2000);
                }
            }).catch(err => {
                this.log('error', `复制失败: ${err.message}`, 'error');
                // 降级方案：使用传统方法
                this.fallbackCopy(envInfo);
            });
        } else {
            // 降级方案：使用传统方法
            this.fallbackCopy(envInfo);
        }
    },
    
    /**
     * 降级复制方法（兼容旧浏览器）
     */
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        textarea.style.left = '-999999px';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            this.log('success', '✅ 所有日志已复制到剪贴板（降级方法）', 'env');
        } catch (err) {
            this.log('error', `复制失败: ${err.message}`, 'error');
            // 如果都失败了，显示文本让用户手动复制
            alert('自动复制失败，请手动选择并复制以下文本：\n\n' + text.substring(0, 500) + '...');
        } finally {
            document.body.removeChild(textarea);
        }
    },
    
    /**
     * 测试代理连接
     */
    async testProxy() {
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        const proxyBase = localStorage.getItem('proxyBase') || 'https://pinyinxieci.vercel.app';
        const testUrl = `${proxyBase.replace(/\/$/, '')}/api/baidu-proxy`;
        
        this.log('info', `开始测试代理: ${testUrl}`, 'network');
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const startTime = Date.now();
            const response = await fetch(testUrl, {
                method: 'GET',
                signal: controller.signal,
                mode: 'cors'
            });
            const endTime = Date.now();
            
            clearTimeout(timeoutId);
            
            const data = await response.json().catch(() => ({}));
            
            if (data.ok || response.ok) {
                this.log('success', `✅ 代理连接成功 (${endTime - startTime}ms)`, 'network');
                this.log('info', `响应: ${JSON.stringify(data)}`, 'network');
            } else {
                throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            let errorMsg = error.message;
            if (error.name === 'AbortError') {
                errorMsg = '连接超时（10秒）';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMsg = '网络错误：无法连接到代理服务器';
            }
            
            this.log('error', `❌ 代理测试失败: ${errorMsg}`, 'network');
            this.log('error', `错误详情: ${error.stack || error}`, 'error');
        }
        
        this.refresh();
    },
    
    /**
     * 记录网络请求
     */
    logNetworkRequest(url, method, options = {}) {
        this.log('info', `${method} ${url}`, 'network');
        if (options.body) {
            try {
                const bodyPreview = typeof options.body === 'string' 
                    ? (options.body.length > 200 ? options.body.substring(0, 200) + '...' : options.body)
                    : JSON.stringify(options.body).substring(0, 200);
                this.log('info', `请求体: ${bodyPreview}`, 'network');
            } catch (e) {
                this.log('warning', '无法序列化请求体', 'network');
            }
        }
    },
    
    /**
     * 记录网络响应
     */
    logNetworkResponse(url, response, data = null) {
        const statusClass = response.ok ? 'success' : 'error';
        this.log(statusClass, `响应 ${response.status} ${response.statusText} from ${url}`, 'network');
        if (data) {
            try {
                const dataPreview = typeof data === 'string' 
                    ? (data.length > 200 ? data.substring(0, 200) + '...' : data)
                    : JSON.stringify(data).substring(0, 200);
                this.log('info', `响应数据: ${dataPreview}`, 'network');
            } catch (e) {
                this.log('warning', '无法序列化响应数据', 'network');
            }
        }
    },
    
    /**
     * 记录错误
     */
    logError(error, context = '') {
        const errorMsg = error.message || String(error);
        const errorStack = error.stack || '';
        this.log('error', `❌ ${context ? context + ': ' : ''}${errorMsg}`, 'error');
        if (errorStack) {
            this.log('error', `堆栈: ${errorStack}`, 'error');
        }
    }
};

// 初始化（DOM加载完成后）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Debug.init());
} else {
    Debug.init();
}

