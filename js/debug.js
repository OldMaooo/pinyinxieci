/**
 * 可视化调试模块
 * 用于在iPad等设备上直接查看调试信息，无需开发者工具
 */

const Debug = {
    isEnabled: false,
    logs: [],
    maxLogs: 100,
    lastImage: null, // 保存最后一次发送的图片
    imageHistory: [], // 图片历史记录
    currentImageIndex: -1, // 当前查看的图片索引
    
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
        const viewImageBtn = document.getElementById('debug-view-image-btn');
        
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
        
        if (viewImageBtn) {
            viewImageBtn.addEventListener('click', () => this.viewLastImage());
        }
        
        // 初始化开关状态
        try { this.isEnabled = localStorage.getItem('debugMode') === '1'; } catch(e) { this.isEnabled = false; }
        const switchEl = document.getElementById('debug-mode-switch');
        if (switchEl) {
            switchEl.checked = this.isEnabled;
            switchEl.addEventListener('change', (e) => {
                this.setEnabled(e.target.checked);
            });
        }

        // 初始化显示
        this.refresh();
        this.log('info', '调试面板已初始化', 'env');
        this.applyVisibility();
    },

    setEnabled(enabled) {
        this.isEnabled = !!enabled;
        try { localStorage.setItem('debugMode', this.isEnabled ? '1' : '0'); } catch(e) {}
        this.applyVisibility();
    },

    applyVisibility() {
        // 不自动显示面板，即使调试模式开启，面板也默认隐藏
        // 面板的显示/隐藏只由 toggle 按钮控制
        const panel = document.getElementById('debug-panel');
        if (panel) {
            // 始终隐藏，除非用户主动点击显示按钮
            // 调试模式开启时，只影响日志记录功能，不影响面板显示
            if (!panel.dataset.userOpened) {
                panel.classList.add('d-none');
            }
        }
    },
    
    /**
     * 显示/隐藏调试面板
     */
    toggle() {
        const panel = document.getElementById('debug-panel');
        if (panel) {
            const isHidden = panel.classList.contains('d-none');
            panel.classList.toggle('d-none');
            if (!isHidden) {
                // 隐藏时，清除标记
                delete panel.dataset.userOpened;
            } else {
                // 显示时，设置标记
                panel.dataset.userOpened = '1';
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
     * 查看图片（支持历史记录切换）
     */
    viewLastImage(index = null) {
        // 如果没有指定索引，使用当前索引
        if (index === null) {
            index = this.currentImageIndex >= 0 ? this.currentImageIndex : this.imageHistory.length - 1;
        }
        
        if (this.imageHistory.length === 0) {
            this.log('warning', '暂无图片数据，请先进行一次识别', 'env');
            return;
        }
        
        // 确保索引在有效范围内
        if (index < 0) index = 0;
        if (index >= this.imageHistory.length) index = this.imageHistory.length - 1;
        this.currentImageIndex = index;
        
        const imageData = this.imageHistory[index];
        const hasPrev = index > 0;
        const hasNext = index < this.imageHistory.length - 1;
        
        // 创建或更新模态框显示图片
        let modal = document.getElementById('debug-image-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.className = 'modal fade';
            modal.id = 'debug-image-modal';
            document.body.appendChild(modal);
        }
        
        modal.innerHTML = `
            <div class="modal-dialog modal-lg modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">发送给百度API的图片 (${index + 1}/${this.imageHistory.length})</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-2">
                            <small class="text-muted">时间: ${imageData.timestamp}</small>
                        </div>
                        <img src="${imageData.image}" class="img-fluid" alt="识别图片" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; background: white;">
                        <div class="mt-3 d-flex justify-content-center gap-2">
                            <button class="btn btn-sm btn-outline-secondary" ${!hasPrev ? 'disabled' : ''} onclick="Debug.viewImage(${index - 1})">
                                <i class="bi bi-chevron-left"></i> 上一张
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="navigator.clipboard.writeText('${imageData.image}').then(() => alert('图片Base64已复制到剪贴板'))">
                                <i class="bi bi-clipboard"></i> 复制Base64
                            </button>
                            <a href="${imageData.image}" download="recognition-image-${index + 1}.png" class="btn btn-sm btn-success">
                                <i class="bi bi-download"></i> 下载
                            </a>
                            <button class="btn btn-sm btn-outline-secondary" ${!hasNext ? 'disabled' : ''} onclick="Debug.viewImage(${index + 1})">
                                下一张 <i class="bi bi-chevron-right"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    },
    
    /**
     * 查看指定索引的图片（用于切换）
     */
    viewImage(index) {
        this.viewLastImage(index);
    },
    
    /**
     * 设置最后一次发送的图片
     */
    setLastImage(imageBase64) {
        this.lastImage = imageBase64;
        // 添加到历史记录
        this.imageHistory.push({
            image: imageBase64,
            timestamp: new Date().toLocaleString('zh-CN')
        });
        // 限制历史记录数量（保留最近20张）
        if (this.imageHistory.length > 20) {
            this.imageHistory.shift();
        }
        // 更新当前索引为最新一张
        this.currentImageIndex = this.imageHistory.length - 1;
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

