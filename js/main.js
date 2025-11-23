/**
 * 主入口模块
 * 路由管理和页面初始化
 */

const Main = {
    /**
     * 初始化
     */
    init() {
        try {
            // 更新版本号显示
            if (typeof APP_VERSION !== 'undefined') {
                const versionEl = document.getElementById('app-version');
                if (versionEl) {
                    versionEl.textContent = `v${APP_VERSION.version}`;
                    versionEl.title = `版本 ${APP_VERSION.version}\n构建日期: ${APP_VERSION.buildDate}`;
                }
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
            console.error('初始化失败:', error);
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
                TaskListUI.render();
            }
        } else if (pageId === 'wordbank') {
            if (typeof WordBank !== 'undefined' && WordBank.loadWordBank) {
                WordBank.loadWordBank();
            }
            if (typeof WordBank !== 'undefined' && WordBank.loadMasteryView) {
                WordBank.loadMasteryView();
            }
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
        const startHome = document.getElementById('start-practice-btn-home');
        if (startHome) {
            startHome.addEventListener('click', (event) => {
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
                let selectedWords = [];
                if (typeof PracticeRange !== 'undefined' && PracticeRange.getSelectedWords) {
                    selectedWords = PracticeRange.getSelectedWords('practice-range-container-home');
                }
                
                if (selectedWords.length === 0) {
                    alert('请先选择练习范围！\n\n在"练习范围"区域勾选要练习的单元。');
                    return;
                }
                
                // 获取拆分阈值（默认50，可从设置中读取）
                const splitThreshold = 50;
                
                // 如果题目数量超过阈值，询问是否拆分
                if (selectedWords.length > splitThreshold) {
                    if (confirm(`已选择 ${selectedWords.length} 题，是否拆分任务？\n\n点击"确定"拆分任务，点击"取消"直接开始练习。`)) {
                        // 显示拆分弹窗
                        const wordIds = selectedWords.map(w => w.id);
                        const selectedUnits = this.getSelectedUnitsForTaskName();
                        console.log('[Main] 选中的单元:', selectedUnits);
                        const taskName = typeof TaskList !== 'undefined' ? TaskList.generateTaskName(selectedUnits) : '未命名任务';
                        console.log('[Main] 生成的任务名称:', taskName);
                        
                        if (typeof TaskListUI !== 'undefined') {
                            TaskListUI.showSplitModal(wordIds, taskName);
                        }
                        return;
                    }
                }
                
                // 直接开始练习，跳过练习范围选择页面
                // 先同步范围选择（在后台进行）
                if (typeof PracticeRange !== 'undefined' && PracticeRange.syncSelection) {
                    PracticeRange.syncSelection('practice-range-container-home', 'practice-range-container');
                }
                // 直接开始练习
                if (typeof Practice !== 'undefined') {
                    this.showPage('practice');
                    Practice.start();
                }
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
                this.showPage('practice');
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
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    Main.init();
});
