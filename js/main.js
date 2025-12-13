/**
 * 主入口模块
 * 路由管理和页面初始化
 */

const Main = {
    _practiceScriptPromise: null,
    
    /**
     * 版本一致性自检
     * 确保 APP_VERSION、页面显示版本和 Practice._codeVersion 完全一致，
     * 一旦发现不一致，立即强制刷新以加载同一套最新代码，避免「版本号新但逻辑旧」的混合状态。
     */
    checkVersionConsistency() {
        try {
            if (typeof APP_VERSION === 'undefined') {
                console.warn('[Main.checkVersionConsistency] APP_VERSION 未定义，跳过版本自检');
                return;
            }

            const targetVersion = APP_VERSION.version;

            // 1. 页面显示的版本（左上角）
            let displayVersion = null;
            const versionEl = document.getElementById('app-version');
            if (versionEl && versionEl.textContent) {
                // 文本形如 "v1.3.92"
                const match = versionEl.textContent.trim().match(/v(\d+\.\d+\.\d+)/);
                if (match) {
                    displayVersion = match[1];
                }
            }

            // 2. Practice 模块内部代码版本
            const practiceVersion = (typeof Practice !== 'undefined' && Practice._codeVersion) 
                ? Practice._codeVersion 
                : null;

            // 如果有任何一个存在且与目标版本不一致，则认为版本混乱
            const mismatch =
                (displayVersion && displayVersion !== targetVersion) ||
                (practiceVersion && practiceVersion !== targetVersion);

            if (mismatch) {
                console.warn('[Main.checkVersionConsistency] 检测到版本不一致，将强制刷新页面以加载最新版本', {
                    targetVersion,
                    displayVersion,
                    practiceVersion
                });
                alert(`检测到应用代码版本不一致，将刷新以加载最新版本（v${targetVersion}）。如果多次出现，请稍等片刻再重试。`);
                const basePath = window.location.pathname || '/';
                // 使用版本号和时间戳组合，尽可能绕过 Safari 和 CDN 的短期缓存
                const newUrl = `${basePath}?v=${encodeURIComponent(targetVersion)}&t=${Date.now()}`;
                window.location.replace(newUrl);
            }
        } catch (e) {
            console.error('[Main.checkVersionConsistency] 自检失败：', e);
        }
    },
    /**
     * 初始化
     */
    init() {
        console.log('[Main.init] ===== 开始初始化 =====');
        try {
            // 更新版本号显示
            if (typeof APP_VERSION !== 'undefined') {
                const versionEl = document.getElementById('app-version');
                if (versionEl) {
                    versionEl.textContent = `v${APP_VERSION.version}`;
                    versionEl.title = `版本 ${APP_VERSION.version}\n构建日期: ${APP_VERSION.buildDate}`;
                    console.log('[Main.init] 版本号已更新:', APP_VERSION.version);
                } else {
                    console.warn('[Main.init] ⚠️ 找不到 app-version 元素');
                }
            } else {
                console.warn('[Main.init] ⚠️ APP_VERSION 未定义');
            }

            // 版本一致性自检：防止出现「版本号是新的，但核心脚本仍是旧版本」的混合状态
            this.checkVersionConsistency();
            
            // 确保Storage先初始化
            if (typeof Storage !== 'undefined') {
                Storage.init();
            }
            
            // 初始化配置
            if (typeof Config !== 'undefined') {
                Config.init();
            }
            
            // 初始化手写输入（延迟，因为canvas可能还未渲染）
            setTimeout(() => {
                if (typeof Handwriting !== 'undefined') {
                    Handwriting.init('handwriting-canvas');
                }
            }, 100);
            
            // 加载首页统计
            if (typeof Statistics !== 'undefined') {
                Statistics.updateHomeStats();
            }
            
            // 加载题库列表
            if (typeof WordBank !== 'undefined') {
                WordBank.loadWordBank();
            }
            
            // 加载错题本
            if (typeof ErrorBook !== 'undefined') {
                ErrorBook.load();
            }
            
            // 初始化任务清单UI
            if (typeof TaskListUI !== 'undefined') {
                TaskListUI.init();
            }
        } catch (error) {
            console.error('[Main.init] ❌ 初始化失败:', error);
            console.error('[Main.init] 错误详情:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
            // 显示错误提示
            const errorDiv = document.createElement('div');
            errorDiv.className = 'alert alert-danger m-3';
            errorDiv.innerHTML = `
                <h5>初始化失败</h5>
                <p>${error.message}</p>
                <p>请刷新页面重试，或检查浏览器控制台查看详细错误。</p>
            `;
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
        
        // 初始化路由
        this.initRouter();
        
        // 绑定导航链接
        this.bindNavLinks();
        
        // 绑定结果页面按钮
        this.bindResultButtons();

            // 绑定首页快捷按钮
            this.bindQuickButtons();
            this.bindWordBankRefreshButton();

        // 页面可见性与退出时的自动保存
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && typeof Practice !== 'undefined' && Practice.savePartialIfActive) {
                Practice.savePartialIfActive();
            }
        });
        window.addEventListener('beforeunload', () => {
            if (typeof Practice !== 'undefined' && Practice.savePartialIfActive) {
                Practice.savePartialIfActive();
            }
        });

        // 启动时检查是否存在未提交草稿，如有则清理，避免重复生成按轮记录
        if (typeof Storage !== 'undefined' && Storage.getPracticeAutosave) {
            const draft = Storage.getPracticeAutosave();
            if (draft && draft.totalWords) {
                Storage.clearPracticeAutosave && Storage.clearPracticeAutosave();
            }
        }

        // 调试模式开关兜底初始化（Debug 会在自身 init 中处理，这里确保一致性）
        const dbgSwitch = document.getElementById('debug-mode-switch');
        if (dbgSwitch) {
            try {
                const enabled = localStorage.getItem('debugMode') === '1';
                if (typeof Debug !== 'undefined' && Debug.setEnabled) {
                    if (dbgSwitch.checked !== enabled) dbgSwitch.checked = enabled;
                    dbgSwitch.addEventListener('change', (e) => Debug.setEnabled(e.target.checked));
                }
            } catch(e) {}
        }
        
        // 检查API配置
        this.checkAPIConfig();
        
        // 自动配置代理（GitHub Pages环境）
        if (typeof Recognition !== 'undefined' && Recognition.autoConfigureProxy) {
            Recognition.autoConfigureProxy();
        }
        
        // 初始化题库范围选择器
        if (typeof PracticeRange !== 'undefined') {
            // 延迟初始化，确保Storage已初始化
            setTimeout(() => {
                PracticeRange.init();
            }, 500);
        }
        
        // 页面加载时自动下载并合并云端数据（如果启用自动同步）
        // 延迟检查，确保所有脚本都已加载
        setTimeout(() => {
            if (typeof SupabaseSync === 'undefined') {
                console.warn('[Main.init] SupabaseSync 模块未加载，跳过同步功能');
                return;
            }
            
            // 更新同步状态显示
            this.updateSyncStatusDisplay();

            if (SupabaseSync.isAutoSyncEnabled && SupabaseSync.isAutoSyncEnabled()) {
                // 延迟执行，确保所有模块都已加载
                setTimeout(() => {
                    if (SupabaseSync.autoDownload) {
                        SupabaseSync.autoDownload().then(() => {
                            this.updateSyncStatusDisplay();
                        });
                    }
                }, 2000);
            }
        }, 500);
    },
    
    /**
     * 更新同步状态显示
     */
    async updateSyncStatusDisplay() {
        if (typeof SupabaseSync === 'undefined' || typeof Storage === 'undefined') return;
        
        const timeEl = document.getElementById('home-sync-time');
        const timeValueEl = document.getElementById('home-sync-time-value');
        const statusEl = document.getElementById('home-sync-status');
        
        if (!timeEl || !timeValueEl) return;
        
        const localTime = Storage.getLocalLastModified();
        const cloudStatus = await SupabaseSync.checkCloudStatus();
        
        let html = '';
        
        // 本地时间
        const formatTime = (isoString) => {
            if (!isoString) return '无';
            const date = new Date(isoString);
            return date.toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            });
        };
        
        html += `<div class="d-flex justify-content-between"><span>本地版本:</span> <span class="text-primary">${formatTime(localTime)}</span></div>`;
        
        // 云端时间
        if (cloudStatus.error) {
            html += `<div class="d-flex justify-content-between"><span>云端版本:</span> <span class="text-danger">获取失败</span></div>`;
        } else if (!cloudStatus.exists) {
            html += `<div class="d-flex justify-content-between"><span>云端版本:</span> <span class="text-muted">无数据</span></div>`;
        } else {
            html += `<div class="d-flex justify-content-between"><span>云端版本:</span> <span class="text-success">${formatTime(cloudStatus.updatedAt)}</span></div>`;
        }
        
        // 同步状态判断
        let syncState = '';
        if (cloudStatus.exists && cloudStatus.updatedAt && localTime) {
            const cloudTs = new Date(cloudStatus.updatedAt).getTime();
            const localTs = new Date(localTime).getTime();
            const diff = Math.abs(cloudTs - localTs);
            
            if (diff < 2000) { // 允许2秒误差
                syncState = '<span class="badge bg-success">已同步</span>';
            } else if (cloudTs > localTs) {
                syncState = '<span class="badge bg-warning text-dark">云端较新</span>';
            } else {
                syncState = '<span class="badge bg-info text-dark">本地较新</span>';
            }
        } else if (!cloudStatus.exists && localTime) {
             syncState = '<span class="badge bg-secondary">未同步</span>';
        }
        
        html += `<div class="d-flex justify-content-between mt-1"><span>状态:</span> ${syncState}</div>`;
        
        timeValueEl.innerHTML = html;
        timeEl.style.display = 'block';
        
        // 更新状态文字
        if (statusEl && !SupabaseSync.isSyncing()) {
             if (cloudStatus.error) {
                 statusEl.innerHTML = '<i class="bi bi-exclamation-circle text-warning"></i> 无法连接云端';
             } else {
                 statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 就绪';
             }
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
        
        if (!window.location.hash) {
            window.location.hash = 'home';
        }
        const hash = window.location.hash.substring(1) || 'home';
        this.showPage(hash);
    },
    
    /**
     * 显示指定页面
     */
    showPage(pageId) {
        if (pageId === 'practice') {
            let allowPractice = false;
            if (typeof Practice !== 'undefined') {
                if (Practice.isActive) {
                    console.log('[Main.showPage] 允许进入练习页：Practice.isActive = true');
                    allowPractice = true;
                } else if (Practice.consumePracticePageAllowance && Practice.consumePracticePageAllowance()) {
                    console.log('[Main.showPage] 允许进入练习页：消耗授权成功');
                    allowPractice = true;
                } else {
                    // 如果授权已被消耗，但当前hash是'practice'且页面已显示
                    // 说明这是由Main.showPage设置hash导致的hashchange重复触发
                    // 允许进入，避免重复切换导致的重定向
                    const currentHash = window.location.hash.substring(1);
                    const currentVisible = document.querySelector('.page-section.active');
                    console.log('[Main.showPage] 授权已消耗，检查fallback条件:', {
                        currentHash,
                        currentVisibleId: currentVisible?.id,
                        matches: currentHash === 'practice' && currentVisible && currentVisible.id === 'practice'
                    });
                    if (currentHash === 'practice' && currentVisible && currentVisible.id === 'practice') {
                        console.log('[Main.showPage] 允许进入练习页：fallback条件满足');
                        allowPractice = true;
                    }
                }
            }
            if (!allowPractice) {
                console.warn('[Main.showPage] 拒绝进入练习页，重定向到首页');
                window.location.hash = 'home';
                pageId = 'home';
            }
        }
        // 如果离开练习页，保存未完成练习
        const currentVisible = document.querySelector('.page-section.active');
        if (currentVisible && currentVisible.id === 'practice' && pageId !== 'practice') {
            if (typeof Practice !== 'undefined' && Practice.savePartialIfActive) {
                Practice.savePartialIfActive();
            }
        }

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
            if (pageId === 'practice') {
                if (typeof PracticeRange !== 'undefined') {
                setTimeout(() => {
                    PracticeRange.init();
                }, 100);
                }
                if (typeof Practice !== 'undefined' && Practice.syncForcedWordStateFromStorage) {
                    Practice.syncForcedWordStateFromStorage();
                }
            }
        }
        
        // 更新导航状态
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${pageId}`) {
                link.classList.add('active');
            }
        });
        
        if (window.location.hash.substring(1) !== pageId) {
            window.location.hash = pageId;
        }
        
        // 特殊处理：如果显示错题本、任务清单或题库管理，刷新数据
        if (pageId === 'errorbook') {
            ErrorBook.load();
        } else if (pageId === 'tasklist') {
            if (typeof TaskListUI !== 'undefined') {
                if (TaskListUI.load) {
                    TaskListUI.load();
                } else if (TaskListUI.render) {
                    TaskListUI.render();
                }
            }
        } else if (pageId === 'wordbank') {
            if (typeof WordBank !== 'undefined') {
                if (WordBank.loadWordBank) {
            WordBank.loadWordBank();
                }
                // 延迟加载掌握状态视图，确保DOM已准备好
                setTimeout(() => {
                    if (WordBank.loadMasteryView) {
                        WordBank.loadMasteryView();
                    }
                }, 100);
            }
        } else if (pageId === 'home') {
            // 首页：重新绑定管理模式按钮（因为按钮可能是动态生成的）
            setTimeout(() => {
                if (this.bindHomeManagementMode) {
                    this.bindHomeManagementMode();
                }
            }, 200);
        } else if (pageId === 'reviewplan') {
            // 复习计划已合并到任务清单中，不再单独显示
            // 如果用户访问复习计划页面，重定向到任务清单
            if (typeof Main !== 'undefined') {
                Main.showPage('tasklist');
            }
            // if (typeof ReviewPlanUI !== 'undefined' && ReviewPlanUI.load) {
            //     ReviewPlanUI.load();
            // }
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
        
        // 管理模式按钮
        const adminBtn = document.getElementById('admin-mode-btn');
        if (adminBtn) {
            adminBtn.addEventListener('click', () => {
                const modalEl = document.getElementById('adminModeModal');
                if (!modalEl) return;
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
                const input = document.getElementById('admin-mode-input');
                if (input) input.value = '';
            });
        }
        const adminConfirm = document.getElementById('admin-mode-confirm');
        if (adminConfirm) {
            adminConfirm.addEventListener('click', () => {
                const input = document.getElementById('admin-mode-input');
                const text = (input && input.value || '').trim();
                if (text === '管理模式') {
                    localStorage.setItem('adminMode', '1');
                    document.querySelector('#adminModeModal .btn-close')?.click();
                    // 重新渲染错题本按钮显示
                    if (typeof ErrorBook !== 'undefined') {
                        ErrorBook.load();
                    }
                } else {
                    alert('验证失败，请输入：管理模式');
                }
            });
        }

        // 主题切换（使用设置菜单中的开关）
        const themeSwitch = document.getElementById('theme-switch');
        if (themeSwitch) {
            const applyTheme = (mode) => {
                document.documentElement.setAttribute('data-bs-theme', mode);
                localStorage.setItem('theme', mode);
                themeSwitch.checked = mode === 'dark';
                // 导航栏配色
                const navbar = document.querySelector('nav.navbar');
                if (navbar) {
                    navbar.classList.toggle('navbar-dark', mode === 'dark');
                    navbar.classList.toggle('bg-dark', mode === 'dark');
                    navbar.classList.toggle('navbar-light', mode !== 'dark');
                    navbar.classList.toggle('bg-light', mode !== 'dark');
                }
                // 更新画布笔迹颜色与网格
                if (typeof Handwriting !== 'undefined') {
                    setTimeout(() => Handwriting.updateInkAndGrid && Handwriting.updateInkAndGrid(), 0);
                }
            };
            const saved = localStorage.getItem('theme') || 'light';
            applyTheme(saved);
            themeSwitch.addEventListener('change', (e) => {
                const mode = e.target.checked ? 'dark' : 'light';
                applyTheme(mode);
            });
        }

        // 首页开始按钮：使用首页设置直接开始练习
        console.log('[Main.init] ===== 绑定首页开始按钮 =====');
        const startHome = document.getElementById('start-practice-btn-home');
        console.log('[Main.init] 首页开始按钮元素:', { exists: !!startHome, id: startHome?.id });
        
        if (startHome) {
            startHome.addEventListener('click', async (event) => {
                console.log('[Main.init] 首页开始按钮被点击');
                event.preventDefault();
                // 同步首页设置到练习页输入
                const countHome = document.getElementById('word-count-input-home');
                const timeHome = document.getElementById('time-limit-input-home');
                const modeHome = document.getElementById('practice-mode-select-home');
                
                // 优先使用输入框值，否则使用下拉框值
                let resolvedCount = 'all';
                if (countHome && countHome.value && countHome.value.trim() !== '') {
                    const inputVal = parseInt(countHome.value);
                    if (isFinite(inputVal) && inputVal > 0) {
                        resolvedCount = inputVal;
                    }
                }
                
                const time = timeHome ? parseInt(timeHome.value) : 30;
                const countInput = document.getElementById('word-count-input');
                const timeInput = document.getElementById('time-limit-input');
                if (countInput) {
                    if (resolvedCount === 'all') {
                        countInput.value = '';
                    } else {
                        countInput.value = String(resolvedCount);
                    }
                }
                // 保存设置
                if (typeof Storage !== 'undefined') {
                    const settings = Storage.getSettings() || {};
                    settings.practice = { wordCount: resolvedCount, timeLimit: time, mode: (modeHome && modeHome.value) || 'normal' };
                    Storage.saveSettings(settings);
                }
                if (timeInput) timeInput.value = isFinite(time) && time > 0 ? String(time) : '30';
                // 获取选中的题目
                console.log('[Main.init] 开始获取选中的题目...');
                let selectedWords = [];
                if (typeof PracticeRange !== 'undefined' && PracticeRange.getSelectedWords) {
                    selectedWords = PracticeRange.getSelectedWords('practice-range-container-home');
                    console.log('[Main.init] 获取到选中的题目数量:', selectedWords.length);
                } else {
                    console.error('[Main.init] ❌ PracticeRange 未定义或没有 getSelectedWords 方法');
                }
                
                if (selectedWords.length === 0) {
                    console.warn('[Main.init] ⚠️ 没有选中任何题目');
                    alert('请先选择练习范围！\n\n在"练习范围"区域勾选要练习的单元。');
                    return;
                }
                
                // 获取拆分阈值（默认25，可从设置中读取）
                const splitThreshold = 25;
                console.log('[Main.init] 拆分阈值:', splitThreshold, '选中题目数:', selectedWords.length);
                
                // 如果题目数量超过阈值，显示确认弹窗
                if (selectedWords.length > splitThreshold) {
                    console.log('[Main.init] 题目数量超过阈值，显示确认弹窗...');
                    // 显示确认弹窗
                    const confirmModal = document.getElementById('practice-confirm-modal');
                    const confirmCountEl = document.getElementById('practice-confirm-count');
                    if (confirmModal && confirmCountEl) {
                        confirmCountEl.textContent = selectedWords.length;
                        const modalInstance = new bootstrap.Modal(confirmModal);
                        modalInstance.show();
                        
                        // 存储当前选中的题目，供按钮回调使用
                        this._pendingPracticeWords = selectedWords;
                        
                        // 等待用户选择（通过按钮事件处理）
                        return;
                    } else {
                        console.warn('[Main.init] 确认弹窗元素不存在，使用默认行为');
                    }
                }
                
                // 直接开始练习，跳过练习范围选择页面
                console.log('[Main.init] 准备直接开始练习...');
                await this.startPracticeDirectly(selectedWords);
            });
        }

        // 加载保存的设置到首页表单
        const countInputHomeEl = document.getElementById('word-count-input-home');
        const timeHomeEl = document.getElementById('time-limit-input-home');
        if (typeof Storage !== 'undefined') {
            const settings = Storage.getSettings() || {};
            const p = settings.practice || {};
            if (countInputHomeEl && p.wordCount !== undefined) {
                if (p.wordCount === 'all') {
                    countInputHomeEl.value = '';
                } else {
                    countInputHomeEl.value = String(p.wordCount || '20');
                }
            }
            if (timeHomeEl && p.timeLimit !== undefined) timeHomeEl.value = p.timeLimit;
        }
        
        // 绑定清除缓存按钮
        const clearCacheBtn = document.getElementById('clear-cache-btn');
        if (clearCacheBtn) {
            clearCacheBtn.addEventListener('click', () => {
                if (confirm('确定要清除缓存并刷新页面吗？\n\n这将清除浏览器缓存，但不会删除您的练习记录和题库数据。')) {
                    this.clearCache();
                }
            });
        }
        
        // 绑定首页管理模式切换
        this.bindHomeManagementMode();
        
        // 绑定首页导入导出
        this.bindHomeImportExport();
        
        // 绑定练习确认弹窗
        this.bindPracticeConfirmModal();
        
        console.log('[Main.init] ===== 初始化完成 =====');
    },
    
    /**
     * 绑定首页管理模式切换
     */
    bindHomeManagementMode() {
        console.log('[Main.bindHomeManagementMode] ===== 开始绑定管理模式 =====');
        // 管理模式按钮可能在工具栏中（动态生成）或批量操作工具栏中（静态）
        let isManagementMode = false;
        
        const toggleManagementMode = (btn) => {
            console.log('[Main.bindHomeManagementMode] ===== 管理模式按钮被点击 =====', { 
                btn: btn?.id || btn?.className, 
                currentMode: isManagementMode,
                btnElement: btn
            });
            isManagementMode = !isManagementMode;
            console.log('[Main.bindHomeManagementMode] 切换后状态:', isManagementMode);
            
            // 更新按钮状态（更新所有管理模式按钮）
            const allModeBtns = [
                document.getElementById('home-management-mode-btn-toolbar')
            ].filter(Boolean);
            
            console.log('[Main.bindHomeManagementMode] 找到的按钮数量:', allModeBtns.length);
            
            allModeBtns.forEach(button => {
                if (isManagementMode) {
                    button.classList.remove('btn-outline-secondary');
                    button.classList.add('btn-primary');
                    button.innerHTML = '<i class="bi bi-gear-fill"></i> 管理模式';
                } else {
                    button.classList.remove('btn-primary');
                    button.classList.add('btn-outline-secondary');
                    button.innerHTML = '<i class="bi bi-gear"></i> 管理模式';
                }
            });
            
            // 显示/隐藏开始练习按钮和批量操作工具栏
            const startPracticeBar = document.getElementById('home-start-practice-bar');
            const batchToolbar = document.getElementById('home-batch-toolbar');
            
            console.log('[Main.bindHomeManagementMode] 工具栏元素:', { startPracticeBar, batchToolbar });
            
            if (isManagementMode) {
                if (startPracticeBar) startPracticeBar.style.display = 'none';
                if (batchToolbar) batchToolbar.classList.remove('d-none');
            } else {
                if (startPracticeBar) startPracticeBar.style.display = 'block';
                if (batchToolbar) batchToolbar.classList.add('d-none');
            }
            
            // 重新渲染练习范围视图（带管理模式选项）
            const container = document.getElementById('practice-range-container-home');
            console.log('[Main.bindHomeManagementMode] 容器:', container);
            if (container && typeof PracticeRange !== 'undefined') {
                const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
                console.log('[Main.bindHomeManagementMode] 开始重新渲染，题库数量:', wordBank.length);
                PracticeRange.renderTableView(container, wordBank, {
                    context: 'home',
                    managementMode: isManagementMode,
                    stickyToolbar: true,
                    showOnlyWrongToggle: true,
                    showManagementModeBtn: true
                });
                
                // 重新绑定工具栏中的管理模式按钮和批量操作按钮
                setTimeout(() => {
                    const toolbarBtn = document.getElementById('home-management-mode-btn-toolbar');
                    if (toolbarBtn) {
                        console.log('[Main.bindHomeManagementMode] 重新绑定工具栏按钮');
                        // 移除旧的事件监听器，添加新的
                        const newBtn = toolbarBtn.cloneNode(true);
                        toolbarBtn.parentNode.replaceChild(newBtn, toolbarBtn);
                        newBtn.addEventListener('click', () => toggleManagementMode(newBtn));
                    }
                    
                    // 重新绑定批量操作按钮（因为视图重新渲染了）
                    const unpracticedBtn = document.getElementById('home-batch-unpracticed-btn');
                    const masterBtn = document.getElementById('home-batch-master-btn');
                    const errorBtn = document.getElementById('home-batch-error-btn');
                    
                    if (unpracticedBtn) {
                        const newUnpracticedBtn = unpracticedBtn.cloneNode(true);
                        unpracticedBtn.parentNode.replaceChild(newUnpracticedBtn, unpracticedBtn);
                        newUnpracticedBtn.addEventListener('click', () => {
                            if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                                WordBank.batchSetStatusForHome('default');
                            }
                        });
                    }
                    
                    if (masterBtn) {
                        const newMasterBtn = masterBtn.cloneNode(true);
                        masterBtn.parentNode.replaceChild(newMasterBtn, masterBtn);
                        newMasterBtn.addEventListener('click', () => {
                            if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                                WordBank.batchSetStatusForHome('mastered');
                            }
                        });
                    }
                    
                    if (errorBtn) {
                        const newErrorBtn = errorBtn.cloneNode(true);
                        errorBtn.parentNode.replaceChild(newErrorBtn, errorBtn);
                        newErrorBtn.addEventListener('click', () => {
                            if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                                WordBank.batchSetStatusForHome('error');
                            }
                        });
                    }
                }, 100);
            }
        };
        
        // 绑定工具栏中的按钮（动态生成，需要延迟绑定）
        const bindToolbarButton = () => {
            const toolbarBtn = document.getElementById('home-management-mode-btn-toolbar');
            console.log('[Main.bindHomeManagementMode] 尝试绑定工具栏按钮:', toolbarBtn);
            if (toolbarBtn) {
                // 移除可能存在的旧监听器
                const newBtn = toolbarBtn.cloneNode(true);
                toolbarBtn.parentNode.replaceChild(newBtn, toolbarBtn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('[Main.bindHomeManagementMode] 工具栏按钮被点击');
                    toggleManagementMode(newBtn);
                });
                console.log('[Main.bindHomeManagementMode] 工具栏按钮绑定成功');
                return true;
            }
            return false;
        };
        
        // 绑定批量操作工具栏中的按钮（静态HTML）
        // 注意：home-management-mode-btn 按钮已从HTML中移除，不再需要绑定
        
        // 尝试绑定工具栏中的按钮（可能需要等待渲染完成）
        if (!bindToolbarButton()) {
            console.log('[Main.bindHomeManagementMode] 工具栏按钮不存在，等待渲染...');
            // 如果按钮还不存在，等待一段时间后重试
            setTimeout(() => {
                bindToolbarButton();
            }, 500);
            
            // 监听DOM变化，当工具栏按钮出现时立即绑定
            const observer = new MutationObserver(() => {
                if (bindToolbarButton()) {
                    console.log('[Main.bindHomeManagementMode] 通过MutationObserver绑定成功');
                    observer.disconnect();
                }
            });
            const container = document.getElementById('practice-range-container-home');
            if (container) {
                observer.observe(container, { childList: true, subtree: true });
            }
        }
        
        // 绑定批量操作按钮（使用克隆节点方式，避免重复绑定）
        const unpracticedBtn = document.getElementById('home-batch-unpracticed-btn');
        const masterBtn = document.getElementById('home-batch-master-btn');
        const errorBtn = document.getElementById('home-batch-error-btn');
        
        if (unpracticedBtn) {
            const newUnpracticedBtn = unpracticedBtn.cloneNode(true);
            unpracticedBtn.parentNode.replaceChild(newUnpracticedBtn, unpracticedBtn);
            newUnpracticedBtn.addEventListener('click', () => {
                if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                    WordBank.batchSetStatusForHome('default');
                }
            });
        }
        
        if (masterBtn) {
            const newMasterBtn = masterBtn.cloneNode(true);
            masterBtn.parentNode.replaceChild(newMasterBtn, masterBtn);
            newMasterBtn.addEventListener('click', () => {
                if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                    WordBank.batchSetStatusForHome('mastered');
                }
            });
        }
        
        if (errorBtn) {
            const newErrorBtn = errorBtn.cloneNode(true);
            errorBtn.parentNode.replaceChild(newErrorBtn, errorBtn);
            newErrorBtn.addEventListener('click', () => {
                if (typeof WordBank !== 'undefined' && WordBank.batchSetStatusForHome) {
                    WordBank.batchSetStatusForHome('error');
                }
            });
        }
    },
    
    /**
     * 绑定练习确认弹窗的按钮事件
     */
    bindPracticeConfirmModal() {
        const noSplitBtn = document.getElementById('practice-confirm-no-split-btn');
        const splitBtn = document.getElementById('practice-confirm-split-btn');
        const confirmModal = document.getElementById('practice-confirm-modal');
        
        if (!noSplitBtn || !splitBtn || !confirmModal) {
            console.warn('[Main.bindPracticeConfirmModal] 弹窗元素不存在');
            return;
        }
        
        // 不拆分按钮：直接开始练习
        noSplitBtn.addEventListener('click', async () => {
            console.log('[Main.bindPracticeConfirmModal] 用户选择不拆分，直接开始练习');
            const modalInstance = bootstrap.Modal.getInstance(confirmModal);
            if (modalInstance) {
                modalInstance.hide();
            }
            
            const selectedWords = this._pendingPracticeWords || [];
            if (selectedWords.length === 0) {
                console.error('[Main.bindPracticeConfirmModal] 没有待练习的题目');
                return;
            }
            
            // 开始练习
            await this.startPracticeDirectly(selectedWords);
            this._pendingPracticeWords = null;
        });
        
        // 拆分练习按钮：显示拆分弹窗
        splitBtn.addEventListener('click', () => {
            console.log('[Main.bindPracticeConfirmModal] 用户选择拆分练习');
            const modalInstance = bootstrap.Modal.getInstance(confirmModal);
            if (modalInstance) {
                modalInstance.hide();
            }
            
            const selectedWords = this._pendingPracticeWords || [];
            if (selectedWords.length === 0) {
                console.error('[Main.bindPracticeConfirmModal] 没有待练习的题目');
                return;
            }
            
            // 显示拆分弹窗
            const wordIds = selectedWords.map(w => w.id);
            const selectedUnits = this.getSelectedUnitsForTaskName();
            console.log('[Main.bindPracticeConfirmModal] 选中的单元:', selectedUnits);
            const taskName = typeof TaskList !== 'undefined' ? TaskList.generateTaskName(selectedUnits) : '未命名任务';
            console.log('[Main.bindPracticeConfirmModal] 生成的任务名称:', taskName);
            
            if (typeof TaskListUI !== 'undefined') {
                console.log('[Main.bindPracticeConfirmModal] 调用 TaskListUI.showSplitModal...');
                TaskListUI.showSplitModal(wordIds, taskName);
                console.log('[Main.bindPracticeConfirmModal] TaskListUI.showSplitModal 调用完成');
            } else {
                console.error('[Main.bindPracticeConfirmModal] ❌ TaskListUI 未定义，无法显示拆分弹窗');
            }
            
            this._pendingPracticeWords = null;
        });
        
        // 取消按钮：关闭弹窗（已通过 data-bs-dismiss="modal" 自动处理）
        confirmModal.addEventListener('hidden.bs.modal', () => {
            // 弹窗关闭时清空待练习的题目
            this._pendingPracticeWords = null;
        });
    },
    
    /**
     * 直接开始练习（不拆分）
     */
    async startPracticeDirectly(selectedWords) {
        console.log('[Main.startPracticeDirectly] 准备直接开始练习...');
        // 先同步范围选择（在后台进行）
        if (typeof PracticeRange !== 'undefined' && PracticeRange.syncSelection) {
            console.log('[Main.startPracticeDirectly] 同步范围选择...');
            PracticeRange.syncSelection('practice-range-container-home', 'practice-range-container');
        }
        // 直接开始练习
        if (typeof Practice === 'undefined') {
            console.warn('[Main.startPracticeDirectly] Practice 模块未定义，尝试动态加载脚本...');
            try {
                const loaded = await this.ensurePracticeModule();
                if (!loaded) {
                    alert('练习模块加载失败，请刷新页面后重试。');
                    console.error('[Main.startPracticeDirectly] 动态加载 Practice 脚本后仍未定义');
                    return;
                }
            } catch (loadErr) {
                alert('练习模块加载失败，请刷新页面后重试。');
                console.error('[Main.startPracticeDirectly] 动态加载 Practice 模块失败:', loadErr);
                return;
            }
        }

        if (typeof Practice !== 'undefined') {
            console.log('[Main.startPracticeDirectly] Practice 模块存在，授权并开始练习...');
            if (Practice.allowPracticePageOnce) {
                Practice.allowPracticePageOnce();
                console.log('[Main.startPracticeDirectly] 练习页授权已授予');
            }
            console.log('[Main.startPracticeDirectly] 切换到练习页...');
            this.showPage('practice');
            console.log('[Main.startPracticeDirectly] 调用 Practice.start()...');
            Practice.start();
            console.log('[Main.startPracticeDirectly] Practice.start() 调用完成');
        } else {
            console.error('[Main.startPracticeDirectly] ❌ Practice 模块仍未定义，无法开始练习');
        }
    },
    
    /**
     * 绑定首页导入导出
     */
    bindHomeImportExport() {
        // 导入按钮 - 点击后选择文件
        const importBtn = document.getElementById('home-import-btn');
        const importInput = document.getElementById('home-import-file-input');
        
        if (importBtn && importInput) {
            importBtn.addEventListener('click', () => {
                importInput.click();
            });
            
            // 文件选择后显示预览弹框
            importInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    alert('调试提示：未检测到文件 (e.target.files[0] is null)');
                    return;
                }
                
                try {
                    let text;
                    try {
                        text = await file.text();
                    } catch (readErr) {
                        console.warn('[Main] file.text() 读取失败，尝试 FileReader:', readErr);
                        text = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => resolve(reader.result);
                            reader.onerror = () => reject(reader.error);
                            reader.readAsText(file);
                        });
                    }
                    
                    const data = JSON.parse(text);
                    
                    // 检查数据格式
                    if (!data.version) {
                        alert(`调试提示：文件解析成功，但缺少 version 字段。\n文件名: ${file.name}\n文件大小: ${file.size}\n文件类型: ${file.type}\n内容预览: ${text.substring(0, 100)}...`);
                        
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('danger', '无效的数据格式');
                        }
                        return;
                    }
                    
                    // 显示预览弹框
                    this.showImportPreview(data, file);
                } catch (error) {
                    alert(`调试提示：导入失败\n错误: ${error.message}\n类型: ${error.name}\n文件名: ${file ? file.name : '未知'}\n文件大小: ${file ? file.size : '未知'}\n文件类型: ${file ? file.type : '未知'}`);
                    console.error('[Main] 解析文件失败:', error);
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('danger', '文件解析失败: ' + (error.message || '未知错误'));
                    }
                } finally {
                    // 清空文件选择，以便下次可以选择相同文件
                    importInput.value = '';
                }
            });
        }
        
        // 确认导入按钮
        const confirmImportBtn = document.getElementById('home-import-preview-confirm-btn');
        if (confirmImportBtn) {
            let pendingImportData = null;
            
            confirmImportBtn.addEventListener('click', async () => {
                const mergeSelect = document.getElementById('home-import-preview-merge-select');
                const mergeMode = mergeSelect && mergeSelect.value === 'merge';
                
                if (!pendingImportData) {
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('warning', '文件数据丢失，请重新选择');
                    }
                    return;
                }
                
                try {
                    // 获取选中的范围
                    const previewContainer = document.getElementById('home-import-preview-container');
                    const selectedUnits = [];
                    if (previewContainer) {
                        previewContainer.querySelectorAll('.import-unit-checkbox:checked').forEach(cb => {
                            selectedUnits.push({
                                semester: cb.dataset.semester,
                                unit: cb.dataset.unit
                            });
                        });
                    }
                    
                    // 如果没有选中任何单元，提示用户
                    if (selectedUnits.length === 0) {
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('warning', '请至少选择一个单元');
                        }
                        return;
                    }
                    
                    // 过滤数据：只保留选中范围内的数据
                    const filteredData = this.filterImportDataByRange(pendingImportData, selectedUnits);
                    
                    // 直接使用Storage.importSyncData导入过滤后的数据
                    if (typeof Storage !== 'undefined' && Storage.importSyncData) {
                        Storage.importSyncData(filteredData, mergeMode);
                        
                        // 重新加载界面
                        if (typeof WordBank !== 'undefined' && WordBank.loadMasteryView) {
                            WordBank.loadMasteryView();
                        }
                        
                        // 更新错题本
                        if (typeof ErrorBook !== 'undefined' && ErrorBook.load) {
                            ErrorBook.load();
                        }
                        
                        // 更新统计
                        if (typeof Statistics !== 'undefined' && Statistics.updateHomeStats) {
                            Statistics.updateHomeStats();
                        }
                        
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('success', '导入成功');
                        }
                        // 关闭弹框
                        const modalEl = document.getElementById('home-import-preview-modal');
                        if (modalEl) {
                            const modal = bootstrap.Modal.getInstance(modalEl);
                            if (modal) modal.hide();
                        }
                        // 清空文件选择和数据
                        if (importInput) importInput.value = '';
                        pendingImportData = null;
                        // 刷新视图
                        if (typeof PracticeRange !== 'undefined' && PracticeRange.refresh) {
                            PracticeRange.refresh();
                        }
                    } else {
                        throw new Error('Storage.importSyncData 不可用');
                    }
                } catch (error) {
                    console.error('[Main] 导入失败:', error);
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('danger', '导入失败: ' + (error.message || '未知错误'));
                    }
                }
            });
            
            // 保存pendingImportData的引用
            window._pendingImportData = (data) => {
                pendingImportData = data;
            };
        }
        
        // 云端同步按钮
        this.bindSupabaseSyncButtons();
        
        // 导出按钮 - 显示导出选择弹框
        const exportSyncBtn = document.getElementById('home-export-sync-btn');
        if (exportSyncBtn) {
            exportSyncBtn.addEventListener('click', () => {
                this.showExportPreview();
            });
        }
        
        // 确认导出按钮
        const confirmExportBtn = document.getElementById('home-export-preview-confirm-btn');
        if (confirmExportBtn) {
            confirmExportBtn.addEventListener('click', () => {
                const previewContainer = document.getElementById('home-export-preview-container');
                const selectedUnits = [];
                if (previewContainer) {
                    previewContainer.querySelectorAll('.export-unit-checkbox:checked').forEach(cb => {
                        selectedUnits.push({
                            semester: cb.dataset.semester,
                            unit: cb.dataset.unit
                        });
                    });
                }
                
                // 如果没有选中任何单元，提示用户
                if (selectedUnits.length === 0) {
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('warning', '请至少选择一个单元');
                    }
                    return;
                }
                
                // 导出选中范围的数据
                this.exportSyncDataByRange(selectedUnits);
                
                // 关闭弹框
                const modalEl = document.getElementById('home-export-preview-modal');
                if (modalEl) {
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                }
            });
        }
        
        // 绑定导入导出折叠框的图标切换
        const importExportHeader = document.getElementById('home-import-export-header');
        const importExportChevron = document.getElementById('home-import-export-chevron');
        if (importExportHeader && importExportChevron) {
            importExportHeader.addEventListener('click', () => {
                // Bootstrap collapse会自动处理，我们只需要更新图标
                setTimeout(() => {
                    const collapse = document.getElementById('home-import-export-collapse');
                    if (collapse) {
                        const isExpanded = collapse.classList.contains('show');
                        if (isExpanded) {
                            importExportChevron.classList.remove('bi-chevron-down');
                            importExportChevron.classList.add('bi-chevron-up');
                        } else {
                            importExportChevron.classList.remove('bi-chevron-up');
                            importExportChevron.classList.add('bi-chevron-down');
                        }
                    }
                }, 100);
            });
        }
    },
    
    /**
     * 显示导入预览弹框
     */
    showImportPreview(data, file) {
        const previewContainer = document.getElementById('home-import-preview-container');
        
        if (!previewContainer) return;
        
        // 保存文件数据到全局变量
        if (window._pendingImportData) {
            window._pendingImportData(data);
        }
        
        // 提取导入数据中的所有状态（mastered、error、default）
        const wordMastery = data.wordMastery || {};
        const errorWords = data.errorWords || [];
        
        console.log('[Main.showImportPreview] 导入数据:', {
            wordMasteryCount: Object.keys(wordMastery).length,
            errorWordsCount: errorWords.length,
            sampleWordMastery: Object.keys(wordMastery).slice(0, 5).map(id => ({ id, status: wordMastery[id] }))
        });
        
        // 从wordMastery中提取所有状态的字
        const masteredWordIds = new Set();
        const errorWordIds = new Set();
        const defaultWordIds = new Set();
        
        // 从errorWords数组中提取（errorWords中的wordId都是error状态）
        errorWords.forEach(ew => errorWordIds.add(ew.wordId));
        
        // 从wordMastery中提取所有状态（这是主要来源）
        Object.keys(wordMastery).forEach(wordId => {
            const status = wordMastery[wordId];
            if (status === 'mastered') {
                masteredWordIds.add(wordId);
                // 如果errorWords中也有，以wordMastery为准
                errorWordIds.delete(wordId);
            } else if (status === 'error') {
                errorWordIds.add(wordId);
            } else if (status === 'default') {
                defaultWordIds.add(wordId);
                // 如果errorWords中也有，以wordMastery为准
                errorWordIds.delete(wordId);
            }
        });
        
        console.log('[Main.showImportPreview] 提取的状态:', {
            mastered: masteredWordIds.size,
            error: errorWordIds.size,
            default: defaultWordIds.size
        });
        
        // 获取完整题库以显示字的信息
        const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
        const allWordObjects = [];
        
        // 合并所有有状态的字
        const allWordIds = new Set([...masteredWordIds, ...errorWordIds, ...defaultWordIds]);
        allWordIds.forEach(wordId => {
            const word = wordBank.find(w => w.id === wordId);
            if (word) {
                // 添加状态信息
                word._importStatus = masteredWordIds.has(wordId) ? 'mastered' : 
                                    errorWordIds.has(wordId) ? 'error' : 'default';
                allWordObjects.push(word);
            }
        });
        
        // 按学期和单元分组
        if (typeof PracticeRange !== 'undefined' && PracticeRange.groupWordsBySemesterUnit) {
            const grouped = PracticeRange.groupWordsBySemesterUnit(allWordObjects);
            const semesters = PracticeRange.sortSemesters(Object.keys(grouped));
            
            let html = '<div class="practice-range-preview">';
            
            if (semesters.length === 0) {
                html += '<div class="text-center text-muted py-3">导入数据中没有掌握状态数据</div>';
            } else {
                semesters.forEach(semesterKey => {
                    const units = PracticeRange.sortUnits(grouped[semesterKey]);
                    const semesterLabel = semesterKey;
                    const semesterId = PracticeRange.sanitizeId(`import-semester-${semesterKey}`);
                    
                    html += `<div class="mb-3">`;
                    html += `<div class="form-check mb-2">`;
                    html += `<input class="form-check-input import-semester-checkbox" type="checkbox" id="${semesterId}" data-semester="${semesterKey}" checked>`;
                    html += `<label class="form-check-label fw-bold" for="${semesterId}">${semesterLabel}</label>`;
                    html += `</div>`;
                    
                    // 使用表格样式显示单元
                    html += `<table class="table table-sm table-borderless mb-0">`;
                    html += `<tbody>`;
                    
                    units.forEach(unitKey => {
                        const words = grouped[semesterKey][unitKey];
                        if (Array.isArray(words) && words.length > 0) {
                            const unitLabel = words.unitLabel || PracticeRange.formatUnitLabel(unitKey);
                            const unitId = PracticeRange.sanitizeId(`import-unit-${semesterKey}-${unitKey}`);
                            
                            // 按状态分组显示
                            const masteredWords = words.filter(w => w._importStatus === 'mastered');
                            const errorWords = words.filter(w => w._importStatus === 'error');
                            const defaultWords = words.filter(w => w._importStatus === 'default');
                            
                            // 显示字，用颜色区分状态
                            const wordTags = [];
                            masteredWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-mastered">${w.word}</span>`));
                            errorWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-error">${w.word}</span>`));
                            defaultWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-default">${w.word}</span>`));
                            
                            html += `<tr>`;
                            html += `<td style="width: 80px; vertical-align: top; padding-top: 0.5rem;">`;
                            html += `<div class="form-check">`;
                            html += `<input class="form-check-input import-unit-checkbox" type="checkbox" id="${unitId}" data-semester="${semesterKey}" data-unit="${unitKey}" checked>`;
                            html += `<label class="form-check-label" for="${unitId}">${unitLabel}</label>`;
                            html += `</div>`;
                            html += `</td>`;
                            html += `<td class="word-tags-cell" style="padding-top: 0.5rem;">${wordTags.join('')}</td>`;
                            html += `</tr>`;
                        }
                    });
                    
                    html += `</tbody></table>`;
                    html += `</div>`;
                });
            }
            
            html += '</div>';
            previewContainer.innerHTML = html;
            
            // 绑定复选框事件（学期复选框控制单元复选框）
            previewContainer.querySelectorAll('.import-semester-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const semester = e.target.dataset.semester;
                    const checked = e.target.checked;
                    previewContainer.querySelectorAll(`.import-unit-checkbox[data-semester="${semester}"]`).forEach(unitCb => {
                        unitCb.checked = checked;
                    });
                });
            });
        } else {
            previewContainer.innerHTML = '<div class="text-center text-muted py-3">无法解析导入数据</div>';
        }
        
        // 显示弹框
        const modal = new bootstrap.Modal(document.getElementById('home-import-preview-modal'));
        modal.show();
    },
    
    /**
     * 根据选中的范围过滤导入数据
     */
    filterImportDataByRange(data, selectedUnits) {
        if (!selectedUnits || selectedUnits.length === 0) {
            return { ...data, wordMastery: {}, errorWords: [] };
        }
        
        // 获取完整题库
        const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
        
        // 按学期和单元分组
        const grouped = typeof PracticeRange !== 'undefined' && PracticeRange.groupWordsBySemesterUnit 
            ? PracticeRange.groupWordsBySemesterUnit(wordBank) 
            : {};
        
        // 构建选中范围内的wordId集合
        const selectedWordIds = new Set();
        selectedUnits.forEach(({ semester, unit }) => {
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                words.forEach(w => selectedWordIds.add(w.id));
            }
        });
        
        // 过滤wordMastery
        const filteredWordMastery = {};
        if (data.wordMastery) {
            Object.keys(data.wordMastery).forEach(wordId => {
                if (selectedWordIds.has(wordId)) {
                    filteredWordMastery[wordId] = data.wordMastery[wordId];
                }
            });
        }
        
        // 过滤errorWords
        const filteredErrorWords = [];
        if (data.errorWords && Array.isArray(data.errorWords)) {
            data.errorWords.forEach(ew => {
                if (selectedWordIds.has(ew.wordId)) {
                    filteredErrorWords.push(ew);
                }
            });
        }
        
        return {
            ...data,
            wordMastery: filteredWordMastery,
            errorWords: filteredErrorWords
        };
    },
    
    /**
     * 显示导出预览弹框
     */
    showExportPreview() {
        const previewContainer = document.getElementById('home-export-preview-container');
        if (!previewContainer) return;
        
        // 获取当前数据
        const wordMastery = typeof Storage !== 'undefined' ? Storage.getWordMastery() : {};
        const errorWords = typeof Storage !== 'undefined' ? Storage.getErrorWordsFiltered() : [];
        
        // 提取所有有状态的字
        const masteredWordIds = new Set();
        const errorWordIds = new Set();
        const defaultWordIds = new Set();
        
        // 从errorWords数组中提取
        errorWords.forEach(ew => errorWordIds.add(ew.wordId));
        
        // 从wordMastery中提取所有状态
        Object.keys(wordMastery).forEach(wordId => {
            const status = wordMastery[wordId];
            if (status === 'mastered') {
                masteredWordIds.add(wordId);
            } else if (status === 'error') {
                errorWordIds.add(wordId);
            } else if (status === 'default') {
                defaultWordIds.add(wordId);
            }
        });
        
        // 获取完整题库
        const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
        const allWordObjects = [];
        
        // 合并所有有状态的字
        const allWordIds = new Set([...masteredWordIds, ...errorWordIds, ...defaultWordIds]);
        allWordIds.forEach(wordId => {
            const word = wordBank.find(w => w.id === wordId);
            if (word) {
                // 添加状态信息
                word._exportStatus = masteredWordIds.has(wordId) ? 'mastered' : 
                                    errorWordIds.has(wordId) ? 'error' : 'default';
                allWordObjects.push(word);
            }
        });
        
        // 按学期和单元分组
        if (typeof PracticeRange !== 'undefined' && PracticeRange.groupWordsBySemesterUnit) {
            const grouped = PracticeRange.groupWordsBySemesterUnit(allWordObjects);
            const semesters = PracticeRange.sortSemesters(Object.keys(grouped));
            
            let html = '<div class="practice-range-preview">';
            
            if (semesters.length === 0) {
                html += '<div class="text-center text-muted py-3">当前没有掌握状态数据</div>';
            } else {
                semesters.forEach(semesterKey => {
                    const units = PracticeRange.sortUnits(grouped[semesterKey]);
                    const semesterLabel = semesterKey;
                    const semesterId = PracticeRange.sanitizeId(`export-semester-${semesterKey}`);
                    
                    html += `<div class="mb-3">`;
                    html += `<div class="form-check mb-2">`;
                    html += `<input class="form-check-input export-semester-checkbox" type="checkbox" id="${semesterId}" data-semester="${semesterKey}" checked>`;
                    html += `<label class="form-check-label fw-bold" for="${semesterId}">${semesterLabel}</label>`;
                    html += `</div>`;
                    
                    // 使用表格样式显示单元
                    html += `<table class="table table-sm table-borderless mb-0">`;
                    html += `<tbody>`;
                    
                    units.forEach(unitKey => {
                        const words = grouped[semesterKey][unitKey];
                        if (Array.isArray(words) && words.length > 0) {
                            const unitLabel = words.unitLabel || PracticeRange.formatUnitLabel(unitKey);
                            const unitId = PracticeRange.sanitizeId(`export-unit-${semesterKey}-${unitKey}`);
                            
                            // 按状态分组显示
                            const masteredWords = words.filter(w => w._exportStatus === 'mastered');
                            const errorWords = words.filter(w => w._exportStatus === 'error');
                            const defaultWords = words.filter(w => w._exportStatus === 'default');
                            
                            // 显示字，用颜色区分状态
                            const wordTags = [];
                            masteredWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-mastered">${w.word}</span>`));
                            errorWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-error">${w.word}</span>`));
                            defaultWords.forEach(w => wordTags.push(`<span class="word-tag word-tag-default">${w.word}</span>`));
                            
                            html += `<tr>`;
                            html += `<td style="width: 80px; vertical-align: top; padding-top: 0.5rem;">`;
                            html += `<div class="form-check">`;
                            html += `<input class="form-check-input export-unit-checkbox" type="checkbox" id="${unitId}" data-semester="${semesterKey}" data-unit="${unitKey}" checked>`;
                            html += `<label class="form-check-label" for="${unitId}">${unitLabel}</label>`;
                            html += `</div>`;
                            html += `</td>`;
                            html += `<td class="word-tags-cell" style="padding-top: 0.5rem;">${wordTags.join('')}</td>`;
                            html += `</tr>`;
                        }
                    });
                    
                    html += `</tbody></table>`;
                    html += `</div>`;
                });
            }
            
            html += '</div>';
            previewContainer.innerHTML = html;
            
            // 绑定复选框事件（学期复选框控制单元复选框）
            previewContainer.querySelectorAll('.export-semester-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const semester = e.target.dataset.semester;
                    const checked = e.target.checked;
                    previewContainer.querySelectorAll(`.export-unit-checkbox[data-semester="${semester}"]`).forEach(unitCb => {
                        unitCb.checked = checked;
                    });
                });
            });
        } else {
            previewContainer.innerHTML = '<div class="text-center text-muted py-3">无法加载数据</div>';
        }
        
        // 显示弹框
        const modal = new bootstrap.Modal(document.getElementById('home-export-preview-modal'));
        modal.show();
    },
    
    /**
     * 根据选中的范围导出数据
     */
    exportSyncDataByRange(selectedUnits) {
        if (!selectedUnits || selectedUnits.length === 0) {
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('warning', '请至少选择一个单元');
            }
            return;
        }
        
        // 获取完整数据
        const fullData = typeof Storage !== 'undefined' ? Storage.exportSyncData() : null;
        if (!fullData) {
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('danger', '无法获取导出数据');
            }
            return;
        }
        
        // 获取完整题库
        const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
        
        // 按学期和单元分组
        const grouped = typeof PracticeRange !== 'undefined' && PracticeRange.groupWordsBySemesterUnit 
            ? PracticeRange.groupWordsBySemesterUnit(wordBank) 
            : {};
        
        // 构建选中范围内的wordId集合
        const selectedWordIds = new Set();
        selectedUnits.forEach(({ semester, unit }) => {
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                words.forEach(w => selectedWordIds.add(w.id));
            }
        });
        
        // 过滤wordMastery
        const filteredWordMastery = {};
        if (fullData.wordMastery) {
            Object.keys(fullData.wordMastery).forEach(wordId => {
                if (selectedWordIds.has(wordId)) {
                    filteredWordMastery[wordId] = fullData.wordMastery[wordId];
                }
            });
        }
        
        // 过滤errorWords
        const filteredErrorWords = [];
        if (fullData.errorWords && Array.isArray(fullData.errorWords)) {
            fullData.errorWords.forEach(ew => {
                if (selectedWordIds.has(ew.wordId)) {
                    filteredErrorWords.push(ew);
                }
            });
        }
        
        // 构建导出数据
        const exportData = {
            ...fullData,
            wordMastery: filteredWordMastery,
            errorWords: filteredErrorWords
        };
        
        // 下载文件
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_同步数据_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
            WordBank.showToast('success', '导出成功');
        }
    },
    
    /**
     * 清除缓存并刷新页面
     */
    clearCache() {
        try {
            // 清除所有localStorage中的缓存相关数据（保留用户数据）
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                // 只清除缓存相关的key，保留用户数据
                if (key && (
                    key.includes('cache') || 
                    key.includes('Cache') ||
                    key.includes('version') ||
                    key.includes('Version') ||
                    key === 'builtin_wordbank_version'
                )) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => {
                try {
                    localStorage.removeItem(key);
                    console.log(`[Main.clearCache] 已清除: ${key}`);
                } catch (e) {
                    console.warn(`[Main.clearCache] 清除 ${key} 失败:`, e);
                }
            });
            
            // 强制刷新页面（绕过缓存）
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    registrations.forEach(registration => registration.unregister());
                });
            }
            
            // 使用时间戳强制刷新
            const timestamp = new Date().getTime();
            window.location.href = `${window.location.pathname}?nocache=${timestamp}${window.location.hash}`;
        } catch (error) {
            console.error('[Main.clearCache] 清除缓存失败:', error);
            alert('清除缓存失败，请手动刷新页面');
            window.location.reload(true);
        }
    },
    
    /**
     * 绑定结果页面按钮
     */
    bindResultButtons() {
        const reviewBtn = document.getElementById('review-errors-btn');
        const practiceAgainBtn = document.getElementById('practice-again-btn');
        
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                // 从当前练习记录中获取错题，然后开始练习
                if (typeof Statistics !== 'undefined' && Statistics.currentLogId) {
                    const logs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs();
                    const log = logs.find(l => l.id === Statistics.currentLogId);
                    if (log && log.errorWords && log.errorWords.length > 0) {
                        // 设置练习范围为当前轮的错题
                        if (typeof PracticeRange !== 'undefined' && PracticeRange.setErrorWordsFromLog) {
                            PracticeRange.setErrorWordsFromLog(log.errorWords);
                        }
                        if (typeof Practice !== 'undefined' && Practice.allowPracticePageOnce) {
                            Practice.allowPracticePageOnce();
                        }
                        // 切换到练习页面并开始练习
                this.showPage('practice');
                        if (typeof Practice !== 'undefined') {
                            Practice.start();
                        }
                    } else {
                        alert('本轮练习没有错题');
                    }
                } else {
                    alert('无法获取当前练习记录');
                }
            });
        }
        
        if (practiceAgainBtn) {
            practiceAgainBtn.addEventListener('click', () => {
                window.location.hash = 'home';
                this.showPage('home');
            });
        }
    },
    
    /**
     * 绑定首页快捷按钮
     */
    bindQuickButtons() {
        // 题目数量快捷按钮（首页）
        document.querySelectorAll('.word-count-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                const value = btn.dataset.value;
                const input = document.getElementById('word-count-input-home');
                if (input) {
                    input.value = value;
                    // 不调用focus()，避免iPad上弹出键盘
                }
            });
        });
    },

    bindWordBankRefreshButton() {
        const btn = document.getElementById('refresh-wordbank-btn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            if (btn.disabled) return;
            const confirmMsg = '将重新加载1-6年级默认题库，保留自定义词库。确定继续吗？';
            if (!confirm(confirmMsg)) return;
            const originalHtml = btn.innerHTML;
            btn.disabled = true;
            btn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                刷新中…
            `;
            console.log('[Main] 用户点击刷新默认题库按钮');
            try {
                if (typeof Storage !== 'undefined' && Storage.resetBuiltinWordBank) {
                    Storage.resetBuiltinWordBank();
                }
                if (typeof InitData !== 'undefined' && InitData.loadDefaultWordBank) {
                    await InitData.loadDefaultWordBank('manual-button');
                } else {
                    console.warn('[Main] InitData 不可用，改由 Storage 自动触发 storage-reset 导入');
                }
                if (typeof WordBank !== 'undefined' && WordBank.loadWordBank) {
                    WordBank.loadWordBank();
                }
                if (typeof ErrorBook !== 'undefined' && ErrorBook.load) {
                    ErrorBook.load();
                }
                if (typeof Statistics !== 'undefined' && Statistics.updateHomeStats) {
                    Statistics.updateHomeStats();
                }
                if (typeof PracticeRange !== 'undefined' && PracticeRange.refresh) {
                    PracticeRange.refresh();
                }
                console.log('[Main] 默认题库刷新流程完成');
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('success', '内置题库已刷新');
                } else {
                    alert('内置题库已刷新');
                }
            } catch (error) {
                console.error('刷新内置题库失败:', error);
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('danger', `刷新失败：${error.message}`);
                } else {
                    alert(`刷新失败：${error.message}`);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        });
    },
    
    /**
     * 显示结果页面（供其他模块调用）
     */
    showResults(logId) {
        Statistics.showResults(logId);
        this.showPage('results');
    },
    
    /**
     * 获取选中的单元信息（用于生成任务名称）
     */
    getSelectedUnitsForTaskName() {
        const container = document.getElementById('practice-range-container-home');
        if (!container) return [];
        
        const selectedUnits = [];
        container.querySelectorAll('.unit-checkbox:checked').forEach(cb => {
            const semester = cb.dataset.semester;
            const unit = cb.dataset.unit;
            
            // 获取单元标签（从表格行中获取，需要去掉checkbox）
            const row = cb.closest('tr.unit-row');
            let unitLabel = '';
            if (row) {
                const firstTd = row.querySelector('td:first-child');
                if (firstTd) {
                    // 克隆节点，移除checkbox，然后获取文本
                    const clone = firstTd.cloneNode(true);
                    const checkboxInClone = clone.querySelector('.unit-checkbox');
                    if (checkboxInClone) {
                        checkboxInClone.remove();
                    }
                    unitLabel = clone.textContent?.trim() || '';
                }
            }
            if (!unitLabel) {
                unitLabel = unit;
            }
            
            // 解析学期信息（如"一年级上册"）
            // 匹配：一年级上册、二年级下册等
            const semesterMatch = semester.match(/([一二三四五六])年级([上下])册/);
            if (semesterMatch) {
                selectedUnits.push({
                    grade: semesterMatch[1], // 一、二、三...
                    semester: semesterMatch[2], // 上、下
                    unit: unit,
                    unitLabel: unitLabel
                });
            }
        });
        
        return selectedUnits;
    },

    /**
     * 动态确保 Practice 模块加载完成（用于缓存或脚本顺序问题）
     */
    async ensurePracticeModule() {
        if (typeof Practice !== 'undefined') {
            return true;
        }
        if (this._practiceScriptPromise) {
            return this._practiceScriptPromise;
        }
        const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : 'latest';
        console.warn('[Main.ensurePracticeModule] 尝试动态加载 Practice 脚本...');
        const promise = new Promise((resolve, reject) => {
            try {
                const existing = document.querySelector('script[data-dynamic-practice]');
                if (existing) {
                    existing.remove();
                }
                const script = document.createElement('script');
                script.src = `js/practice.js?v=${version}&reload=${Date.now()}`;
                script.async = true;
                script.dataset.dynamicPractice = '1';
                script.onload = () => {
                    console.log('[Main.ensurePracticeModule] Practice 脚本动态加载完成:', script.src);
                    resolve(typeof Practice !== 'undefined');
                };
                script.onerror = (error) => {
                    reject(error || new Error('Practice script failed to load'));
                };
                document.body.appendChild(script);
            } catch (error) {
                reject(error);
            }
        });
        this._practiceScriptPromise = promise;
        promise.finally(() => {
            this._practiceScriptPromise = null;
        });
        return promise;
    },

    /**
     * 绑定 Supabase 同步按钮事件
     */
    bindSupabaseSyncButtons() {
        // 检查 SupabaseSync 是否已加载
        if (typeof SupabaseSync === 'undefined') {
            console.error('[Main.bindSupabaseSyncButtons] SupabaseSync 模块未加载');
            const statusEl = document.getElementById('home-sync-status');
            if (statusEl) {
                statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-danger"></i> SupabaseSync 模块未加载，请刷新页面';
            }
            return;
        }
        
        // 检查配置状态并显示/隐藏配置界面
        this.updateSupabaseConfigUI();
        
        // 配置切换按钮
        const configToggleBtn = document.getElementById('supabase-config-toggle-btn');
        const configSection = document.getElementById('supabase-config-section');
        if (configToggleBtn && configSection) {
            configToggleBtn.addEventListener('click', () => {
                const isVisible = configSection.style.display !== 'none';
                configSection.style.display = isVisible ? 'none' : 'block';
            });
        }
        
        // 保存配置按钮
        const saveConfigBtn = document.getElementById('supabase-save-config-btn');
        if (saveConfigBtn) {
            saveConfigBtn.addEventListener('click', () => {
                const urlInput = document.getElementById('supabase-url-input');
                const keyInput = document.getElementById('supabase-key-input');
                
                if (!urlInput || !keyInput) return;
                
                const url = urlInput.value.trim();
                const anonKey = keyInput.value.trim();
                
                if (!url || !anonKey) {
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('warning', '请填写完整的 Supabase 配置');
                    }
                    return;
                }
                
                // 保存配置
                Config.saveSupabase({ url, anonKey });
                
                // 更新UI
                this.updateSupabaseConfigUI();
                
                // 隐藏配置界面
                if (configSection) {
                    configSection.style.display = 'none';
                }
                
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('success', 'Supabase 配置已保存');
                }
            });
        }
        
        // 同步按钮（智能合并）
        const syncBtn = document.getElementById('home-sync-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                await this.handleSync();
            });
        }

        // 上传按钮
        const uploadBtn = document.getElementById('home-upload-btn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', async () => {
                await this.handleUpload();
            });
        }

        // 下载按钮
        const downloadBtn = document.getElementById('home-download-btn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                await this.handleDownload();
            });
        }

        // 强制恢复题库按钮
        const forceRestoreBtn = document.getElementById('home-force-restore-btn');
        if (forceRestoreBtn) {
            forceRestoreBtn.addEventListener('click', async () => {
                await this.handleForceRestore();
            });
        }
        
        // 自动同步开关
        const autoSyncSwitch = document.getElementById('supabase-auto-sync-switch');
        if (autoSyncSwitch) {
            // 读取当前设置
            if (typeof SupabaseSync !== 'undefined' && SupabaseSync.isAutoSyncEnabled) {
                autoSyncSwitch.checked = SupabaseSync.isAutoSyncEnabled();
            }
            
            autoSyncSwitch.addEventListener('change', (e) => {
                if (typeof SupabaseSync !== 'undefined' && SupabaseSync.setAutoSyncEnabled) {
                    SupabaseSync.setAutoSyncEnabled(e.target.checked);
                    const status = e.target.checked ? '已启用' : '已禁用';
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('info', `自动同步${status}`);
                    }
                }
            });
        }
    },
    
    /**
     * 更新 Supabase 配置UI状态
     */
    updateSupabaseConfigUI() {
        const supabaseConfig = Config.getSupabase();
        const configSection = document.getElementById('supabase-config-section');
        const urlInput = document.getElementById('supabase-url-input');
        const keyInput = document.getElementById('supabase-key-input');
        
        if (supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey) {
            // 已配置，隐藏配置界面
            if (configSection) {
                configSection.style.display = 'none';
            }
            // 填充输入框（用于编辑）
            if (urlInput) urlInput.value = supabaseConfig.url;
            if (keyInput) keyInput.value = supabaseConfig.anonKey;
        } else {
            // 未配置，显示配置界面
            if (configSection) {
                configSection.style.display = 'block';
            }
        }
    },

    /**
     * 处理同步操作
     */
    async handleSync() {
        const syncBtn = document.getElementById('home-sync-btn');
        const statusEl = document.getElementById('home-sync-status');
        const timeEl = document.getElementById('home-sync-time');
        const timeValueEl = document.getElementById('home-sync-time-value');

        if (!syncBtn || !statusEl) return;

        // 检查配置（优先使用 localStorage 中的配置）
        const supabaseConfig = Config.getSupabase();
        if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> 请先在浏览器控制台配置 Supabase：<br><code style="font-size: 0.8em;">Config.saveSupabase({url: "你的URL", anonKey: "你的Key"})</code>';
            return;
        }

        // 检查 SupabaseSync 是否已加载
        if (typeof SupabaseSync === 'undefined') {
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> SupabaseSync 模块未加载，请刷新页面重试';
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('warning', 'SupabaseSync 模块未加载，请刷新页面重试');
            }
            return;
        }

        // 更新UI状态
        syncBtn.disabled = true;
        syncBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> 同步中...';
        statusEl.innerHTML = '<i class="bi bi-hourglass-split text-info"></i> 正在同步数据...';

        try {
            const result = await SupabaseSync.sync();
            
            if (result.success) {
                // 检查是否有冲突
                if (result.hasConflicts && result.conflicts && result.conflicts.length > 0) {
                    statusEl.innerHTML = `<i class="bi bi-exclamation-triangle text-warning"></i> 同步成功，但发现 ${result.conflicts.length} 个冲突`;
                    // 显示冲突详情按钮
                    const conflictBtn = document.createElement('button');
                    conflictBtn.className = 'btn btn-sm btn-warning mt-2 w-100';
                    conflictBtn.innerHTML = '<i class="bi bi-info-circle"></i> 查看冲突详情';
                    conflictBtn.onclick = () => {
                        this.showConflictDetails(result.conflicts);
                    };
                    statusEl.appendChild(conflictBtn);
                } else {
                    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 同步成功，正在恢复内置题库...';
                }
                
                // 强制恢复三年级上册内置题库（确保题库正确）
                console.log('[Main.handleSync] 强制恢复三年级上册内置题库...');
                if (typeof Storage !== 'undefined' && Storage.forceRestoreGrade3UpBuiltinWordBank) {
                    const restoreResult = await Storage.forceRestoreGrade3UpBuiltinWordBank();
                    if (restoreResult.success) {
                        if (result.hasConflicts && result.conflicts && result.conflicts.length > 0) {
                            statusEl.innerHTML = `<i class="bi bi-check-circle text-success"></i> 同步成功，内置题库已恢复（${result.conflicts.length} 个冲突）`;
                        } else {
                            statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 同步成功，内置题库已恢复';
                        }
                    }
                } else if (typeof InitData !== 'undefined' && InitData.loadDefaultWordBank) {
                    await InitData.loadDefaultWordBank('force-restore-after-sync');
                    if (result.hasConflicts && result.conflicts && result.conflicts.length > 0) {
                        statusEl.innerHTML = `<i class="bi bi-check-circle text-success"></i> 同步成功，内置题库已恢复（${result.conflicts.length} 个冲突）`;
                    } else {
                        statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 同步成功，内置题库已恢复';
                    }
                }
                
                // 刷新相关页面数据
                if (typeof PracticeRange !== 'undefined') {
                    PracticeRange.renderTableView('practice-range-container-home', {});
                }
                if (typeof TaskListUI !== 'undefined') {
                    TaskListUI.load();
                }
                if (typeof ErrorBook !== 'undefined') {
                    ErrorBook.load();
                }

                // 显示成功提示
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    if (result.hasConflicts && result.conflicts && result.conflicts.length > 0) {
                        WordBank.showToast('warning', `同步成功，内置题库已恢复（${result.conflicts.length} 个冲突）`);
                    } else {
                        WordBank.showToast('success', '数据同步成功，内置题库已恢复');
                    }
                }
                
                // 更新状态显示
                this.updateSyncStatusDisplay();
            } else {
                statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> ${result.message || '同步失败'}`;
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('danger', result.message || '同步失败');
                }
            }
        } catch (error) {
            console.error('[Main.handleSync] 同步异常:', error);
            statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> 同步异常: ${error.message}`;
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('danger', `同步异常: ${error.message}`);
            }
        } finally {
            syncBtn.disabled = false;
            syncBtn.innerHTML = '<i class="bi bi-cloud-arrow-up-down"></i> 云端同步';
        }
    },

    /**
     * 处理上传操作
     */
    async handleUpload() {
        const uploadBtn = document.getElementById('home-upload-btn');
        const statusEl = document.getElementById('home-sync-status');
        const timeEl = document.getElementById('home-sync-time');
        const timeValueEl = document.getElementById('home-sync-time-value');

        if (!uploadBtn || !statusEl) return;

        // 检查配置（优先使用 localStorage 中的配置）
        const supabaseConfig = Config.getSupabase();
        if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> 请先在浏览器控制台配置 Supabase：<br><code style="font-size: 0.8em;">Config.saveSupabase({url: "你的URL", anonKey: "你的Key"})</code>';
            return;
        }

        // 检查 SupabaseSync 是否已加载
        if (typeof SupabaseSync === 'undefined') {
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> SupabaseSync 模块未加载，请刷新页面重试';
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('warning', 'SupabaseSync 模块未加载，请刷新页面重试');
            }
            return;
        }

        // 更新UI状态
        uploadBtn.disabled = true;
        statusEl.innerHTML = '<i class="bi bi-hourglass-split text-info"></i> 正在上传...';

        try {
            const result = await SupabaseSync.upload();
            
            if (result.success) {
                statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 上传成功';
                
                // 更新最后同步时间
                if (result.lastSyncTime) {
                    const syncTime = new Date(result.lastSyncTime);
                    const localTime = syncTime.toLocaleString('zh-CN', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                    timeValueEl.textContent = localTime;
                    timeEl.style.display = 'block';
                }

                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('success', '数据上传成功');
                }
            } else {
                statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> ${result.message || '上传失败'}`;
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('danger', result.message || '上传失败');
                }
            }
        } catch (error) {
            console.error('[Main.handleUpload] 上传异常:', error);
            statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> 上传异常: ${error.message}`;
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('danger', `上传异常: ${error.message}`);
            }
        } finally {
            uploadBtn.disabled = false;
        }
    },

    /**
     * 处理下载操作
     */
    async handleDownload() {
        const downloadBtn = document.getElementById('home-download-btn');
        const statusEl = document.getElementById('home-sync-status');
        const timeEl = document.getElementById('home-sync-time');
        const timeValueEl = document.getElementById('home-sync-time-value');

        if (!downloadBtn || !statusEl) return;

        // 检查配置（优先使用 localStorage 中的配置）
        const supabaseConfig = Config.getSupabase();
        if (!supabaseConfig || !supabaseConfig.url || !supabaseConfig.anonKey) {
            statusEl.innerHTML = '<i class="bi bi-exclamation-triangle text-warning"></i> 请先在浏览器控制台配置 Supabase：<br><code style="font-size: 0.8em;">Config.saveSupabase({url: "你的URL", anonKey: "你的Key"})</code>';
            return;
        }

        // 更新UI状态
        downloadBtn.disabled = true;
        statusEl.innerHTML = '<i class="bi bi-hourglass-split text-info"></i> 正在下载...';

        try {
            const result = await SupabaseSync.download();
            
            if (result.success) {
                if (result.data) {
                    // 合并数据到本地
                    try {
                        // 确保数据格式正确
                        if (!result.data.version) {
                            result.data.version = "1.1";
                        }
                        if (!result.data.type) {
                            result.data.type = "sync";
                        }
                        Storage.importSyncData(result.data, true);
                        statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 下载并合并成功，正在恢复内置题库...';
                        
                        // 强制恢复三年级上册内置题库（确保题库正确）
                        console.log('[Main.handleDownload] 强制恢复三年级上册内置题库...');
                        if (typeof Storage !== 'undefined' && Storage.forceRestoreGrade3UpBuiltinWordBank) {
                            const restoreResult = await Storage.forceRestoreGrade3UpBuiltinWordBank();
                            if (restoreResult.success) {
                                statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 下载成功，内置题库已恢复';
                            } else {
                                statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 下载成功，但内置题库恢复失败';
                            }
                        } else if (typeof InitData !== 'undefined' && InitData.loadDefaultWordBank) {
                            await InitData.loadDefaultWordBank('force-restore-after-download');
                            statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 下载成功，内置题库已恢复';
                        }
                        
                        // 更新最后同步时间
                        if (result.lastSyncTime) {
                            const syncTime = new Date(result.lastSyncTime);
                            const localTime = syncTime.toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                            timeValueEl.textContent = localTime;
                            timeEl.style.display = 'block';
                        }

                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('success', '数据下载成功，内置题库已恢复');
                        }

                        // 延迟刷新相关页面数据，确保数据已完全合并
                        setTimeout(() => {
                            try {
                                // 验证 wordBank 是否正确
                                const wordBank = Storage.getWordBank();
                                if (!Array.isArray(wordBank)) {
                                    console.error('[Main.handleDownload] wordBank 不是数组，尝试修复...');
                                    Storage.saveWordBank([]);
                                }
                                
                                // 刷新相关页面数据
                                if (typeof PracticeRange !== 'undefined') {
                                    PracticeRange.renderTableView('practice-range-container-home', {});
                                }
                                if (typeof TaskListUI !== 'undefined') {
                                    TaskListUI.load();
                                }
                                if (typeof ErrorBook !== 'undefined') {
                                    ErrorBook.load();
                                }
                            } catch (refreshError) {
                                console.error('[Main.handleDownload] 刷新页面数据失败:', refreshError);
                            }
                        }, 100);

                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('success', '数据下载并合并成功');
                        }
                    } catch (mergeError) {
                        console.error('[Main.handleDownload] 合并数据失败:', mergeError);
                        statusEl.innerHTML = `<i class="bi bi-exclamation-triangle text-warning"></i> 下载成功，但合并失败: ${mergeError.message}`;
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('warning', `下载成功，但合并失败: ${mergeError.message}`);
                        }
                    }
                } else {
                    statusEl.innerHTML = '<i class="bi bi-info-circle text-info"></i> 云端暂无数据';
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('info', '云端暂无数据');
                    }
                }
            } else {
                statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> ${result.message || '下载失败'}`;
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('danger', result.message || '下载失败');
                }
            }
        } catch (error) {
            console.error('[Main.handleDownload] 下载异常:', error);
            statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> 下载异常: ${error.message}`;
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('danger', `下载异常: ${error.message}`);
            }
        } finally {
            downloadBtn.disabled = false;
        }
    },
    
    /**
     * 显示冲突详情
     */
    showConflictDetails(conflicts) {
        // 创建或获取冲突详情弹窗
        let modalEl = document.getElementById('sync-conflict-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'sync-conflict-modal';
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title"><i class="bi bi-exclamation-triangle text-warning"></i> 同步冲突详情</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="sync-conflict-container"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }
        
        const container = document.getElementById('sync-conflict-container');
        if (!container) return;
        
        let html = `<p class="text-muted">发现 <strong>${conflicts.length}</strong> 个冲突项：</p>`;
        html += '<table class="table table-sm table-bordered">';
        html += '<thead><tr><th>汉字</th><th>拼音</th><th>本地状态</th><th>云端状态</th></tr></thead>';
        html += '<tbody>';
        
        conflicts.forEach(conflict => {
            const statusMap = {
                'mastered': '<span class="badge bg-success">已掌握</span>',
                'error': '<span class="badge bg-danger">错题</span>',
                'default': '<span class="badge bg-secondary">未练习</span>'
            };
            
            html += `<tr>`;
            html += `<td><strong>${conflict.word}</strong></td>`;
            html += `<td>${conflict.pinyin || '-'}</td>`;
            html += `<td>${statusMap[conflict.localStatus] || conflict.localStatus}</td>`;
            html += `<td>${statusMap[conflict.cloudStatus] || conflict.cloudStatus}</td>`;
            html += `</tr>`;
        });
        
        html += '</tbody></table>';
        html += '<p class="text-muted small mt-2"><i class="bi bi-info-circle"></i> 冲突已通过合并模式解决，当前显示的是合并后的结果。</p>';
        
        container.innerHTML = html;
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    },

    /**
     * 处理强制恢复内置题库操作
     */
    async handleForceRestore() {
        const restoreBtn = document.getElementById('home-force-restore-btn');
        const statusEl = document.getElementById('home-sync-status');

        if (!restoreBtn || !statusEl) return;

        if (!confirm('确定要强制恢复三年级上册内置题库吗？这将删除所有三年级上册的字（包括用户添加的），然后重新加载正确的内置题库。')) {
            return;
        }

        // 更新UI状态
        restoreBtn.disabled = true;
        statusEl.innerHTML = '<i class="bi bi-hourglass-split text-info"></i> 正在强制恢复内置题库...';

        try {
            if (typeof Storage !== 'undefined' && Storage.forceRestoreGrade3UpBuiltinWordBank) {
                const result = await Storage.forceRestoreGrade3UpBuiltinWordBank();
                
                if (result.success) {
                    statusEl.innerHTML = '<i class="bi bi-check-circle text-success"></i> 内置题库已强制恢复';
                    
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('success', '三年级上册内置题库已强制恢复');
                    }
                    
                    // 刷新UI
                    if (typeof WordBank !== 'undefined' && WordBank.loadWordBank) {
                        WordBank.loadWordBank();
                    }
                    if (typeof PracticeRange !== 'undefined' && PracticeRange.refresh) {
                        PracticeRange.refresh();
                    }
                } else {
                    statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> 恢复失败: ${result.message || '未知错误'}`;
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('danger', result.message || '恢复失败');
                    }
                }
            } else {
                statusEl.innerHTML = '<i class="bi bi-x-circle text-danger"></i> Storage.forceRestoreGrade3UpBuiltinWordBank 不可用';
            }
        } catch (error) {
            console.error('[Main.handleForceRestore] 恢复异常:', error);
            statusEl.innerHTML = `<i class="bi bi-x-circle text-danger"></i> 恢复异常: ${error.message}`;
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('danger', `恢复异常: ${error.message}`);
            }
        } finally {
            restoreBtn.disabled = false;
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
    
    // 鼠标离开遮罩功能（受设置开关控制）
    const overlay = document.getElementById('mouse-leave-overlay');
    const mouseLeaveSwitch = document.getElementById('mouse-leave-dark-switch');
    
    // 初始化开关状态
    if (mouseLeaveSwitch) {
        const saved = localStorage.getItem('mouseLeaveDark') === 'true';
        mouseLeaveSwitch.checked = saved;
    }
    
    // 鼠标离开/进入事件处理函数
    let mouseLeaveHandler = null;
    let mouseEnterHandler = null;
    let mouseMoveHandler = null;
    
    const enableMouseLeaveDark = () => {
        if (!overlay || mouseLeaveHandler) return; // 已启用则跳过
        
        mouseLeaveHandler = (e) => {
            // 只有当鼠标真正离开页面时才显示遮罩
            if (e.clientY <= 0 || e.clientX <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
                overlay.style.display = 'block';
            }
        };
        
        mouseEnterHandler = () => {
            overlay.style.display = 'none';
        };
        
        mouseMoveHandler = () => {
            overlay.style.display = 'none';
        };
        
        document.addEventListener('mouseleave', mouseLeaveHandler);
        document.addEventListener('mouseenter', mouseEnterHandler);
        document.addEventListener('mousemove', mouseMoveHandler);
    };
    
    const disableMouseLeaveDark = () => {
        if (mouseLeaveHandler) {
            document.removeEventListener('mouseleave', mouseLeaveHandler);
            mouseLeaveHandler = null;
        }
        if (mouseEnterHandler) {
            document.removeEventListener('mouseenter', mouseEnterHandler);
            mouseEnterHandler = null;
        }
        if (mouseMoveHandler) {
            document.removeEventListener('mousemove', mouseMoveHandler);
            mouseMoveHandler = null;
        }
        if (overlay) {
            overlay.style.display = 'none';
        }
    };
    
    // 根据开关状态初始化
    if (mouseLeaveSwitch && mouseLeaveSwitch.checked) {
        enableMouseLeaveDark();
    }
    
    // 监听开关变化
    if (mouseLeaveSwitch) {
        mouseLeaveSwitch.addEventListener('change', (e) => {
            const enabled = e.target.checked;
            localStorage.setItem('mouseLeaveDark', enabled ? 'true' : 'false');
            if (enabled) {
                enableMouseLeaveDark();
            } else {
                disableMouseLeaveDark();
            }
        });
    }
});
