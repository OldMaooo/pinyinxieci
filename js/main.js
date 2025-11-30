/**
 * 主入口模块
 * 路由管理和页面初始化
 */

const Main = {
    _practiceScriptPromise: null,
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

        // 主题切换
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            const applyTheme = (mode) => {
                document.documentElement.setAttribute('data-bs-theme', mode);
                localStorage.setItem('theme', mode);
                themeBtn.innerHTML = mode === 'dark' ? '<i class="bi bi-moon"></i> 深色' : '<i class="bi bi-brightness-high"></i> 浅色';
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
            themeBtn.addEventListener('click', () => {
                const current = document.documentElement.getAttribute('data-bs-theme') || 'light';
                applyTheme(current === 'light' ? 'dark' : 'light');
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
                
                // 获取拆分阈值（默认50，可从设置中读取）
                const splitThreshold = 50;
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
                if (!file) return;
                
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    
                    // 检查数据格式
                    if (!data.version) {
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('danger', '无效的数据格式');
                        }
                        // 清空文件选择，以便下次可以选择相同文件
                        importInput.value = '';
                        return;
                    }
                    
                    // 显示预览弹框
                    this.showImportPreview(data, file);
                } catch (error) {
                    console.error('[Main] 解析文件失败:', error);
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('danger', '文件解析失败: ' + (error.message || '未知错误'));
                    }
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
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});
