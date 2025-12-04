/**
 * 练习模块
 * 管理练习流程
 */

const Practice = {
    // 用于版本一致性自检的代码版本标签，必须与 APP_VERSION.version 保持一致
    _codeVersion: (typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : 'unknown'),
    // 本轮练习的调试事件列表，用于一键复制给开发者排查
    debugEvents: [],

    logDebugEvent(type, payload = {}) {
        try {
            const now = new Date();
            const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
            this.debugEvents.push({
                ts: beijingTime.toISOString(),
                type,
                index: this.currentIndex,
                totalWords: this.currentWords?.length || 0,
                wordId: this.currentWords?.[this.currentIndex]?.id || null,
                word: this.currentWords?.[this.currentIndex]?.word || null,
                state: {
                    isActive: this.isActive,
                    isPaused: this.isPaused,
                    isSubmitting: this.isSubmitting,
                    allowSkip: this.allowSkip,
                    mode: this.mode
                },
                data: payload
            });
            // 防止日志无限增长，最多保留最近 500 条
            if (this.debugEvents.length > 500) {
                this.debugEvents = this.debugEvents.slice(-500);
            }
        } catch (e) {
            console.error('[Practice.logDebugEvent] 记录调试事件失败:', e);
        }
    },
    currentWords: [],
    currentIndex: 0,
    // 记录之前的题目历史（用于返回上一题）
    history: [],
    isProcessingNextQuestion: false, // 防止重复调用showNextQuestion
    allowSkip: true, // 是否允许跳过题目（默认可以跳过）
    practiceLog: {
        totalWords: 0,
        correctCount: 0,
        errorCount: 0,
        totalTime: 0,
        startTime: null,
        wordTimes: [],
        errorWords: []
    },

    async handleEmptySubmission(word) {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
        this._currentWordStartTime = null;
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this.isSubmitting = false;
        
        // 检查是否已存在该题目的记录，如果存在则不重复记录
        const existingIdx = this.practiceLog.details.findIndex(d => d.wordId === word.id);
        if (existingIdx < 0) {
            // 只有不存在记录时才记录
            await this.recordError(word, null);
            this.practiceLog.errorCount++;
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
            this.updateProgressVisual();
        }
        
        // 同步到题库管理的掌握状态：答错的题目标记为错题
        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
            Storage.setWordMasteryStatus(word.id, 'error');
        }
        
        // 更新任务进度（如果有任务，在答题后立即更新）
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false);
        }
        
        // 显示反馈（错误）- 这会显示正确答案在田字格中
        this.showFeedback(false, word, '');
        // 注意：不要在这里清空画布，因为 showFeedback 会在田字格中显示正确答案
        // enterRetryMode 会在8秒后清空画布
        
        this.saveAutosaveDraft();
        
        // 进入错题重做模式：显示正确答案，8秒后清空画布
        // 不论是否允许跳过，这里统一行为，真正的“跳过”通过 skipAnswer / skipQuestion 来处理
        this.enterRetryMode(word);
        // 不进入下一题，等待用户重新提交或显式跳过
    },
    timer: null,
    timeLimit: 30,
    isActive: false,
    isPaused: false,
    mode: 'normal',
    forcedWordCount: null,
    lastSubmitTime: 0, // 上次提交时间，用于防重复提交
    lastSubmitWordId: null, // 上次提交的字ID，用于判断是否切换了字
    isSubmitting: false, // 是否正在提交中
    _currentWordStartTime: null, // 当前题目开始计时点
    _pendingDirectStart: false, // 是否来自首页/错题本的直接启动
    _allowPracticePageOnce: false, // 是否允许在未激活时进入练习页面一次
    allowPracticePageOnce() {
        this._allowPracticePageOnce = true;
    },
    consumePracticePageAllowance() {
        const allowed = this._allowPracticePageOnce;
        this._allowPracticePageOnce = false;
        return allowed;
    },
    consecutiveBlockCount: 0, // 连续被拦截的次数，用于容错机制
    _nextWordTimer: null,
    _isRetryingError: false, // 是否在重做错题
    _retryClearTimer: null, // 错题重做清空画布的定时器
    _hasClearedCanvasInRetry: false, // 是否已经在重做模式下清空过画布（防止重复清空）
    clearPendingNextWordTimer() {
        if (this._nextWordTimer) {
            clearTimeout(this._nextWordTimer);
            this._nextWordTimer = null;
        }
    },
    clearRetryTimer() {
        if (this._retryClearTimer) {
            clearTimeout(this._retryClearTimer);
            this._retryClearTimer = null;
        }
    },

    scheduleNextWord(delay, fn) {
        this.clearPendingNextWordTimer();
        this._nextWordTimer = setTimeout(() => {
            this._nextWordTimer = null;
            fn?.();
        }, delay);
    },
    
    /**
     * 开始练习
     */
    async start(options = {}) {
        const directStart = options.directStart || this._pendingDirectStart;
        this._pendingDirectStart = false;
        this.clearPendingNextWordTimer();
        if (directStart) {
            this.prepareDirectStartUI();
        }
        // 同步可能来自错题本的强制题量设置
        if (typeof this.syncForcedWordStateFromStorage === 'function') {
            this.syncForcedWordStateFromStorage();
        }
        // 确保词组数据已加载（无论是否已加载，都重新加载以确保最新）
        if (typeof WordGroups !== 'undefined' && WordGroups.load) {
            try {
                console.log('[Practice.start] 开始加载词组数据，当前状态:', JSON.stringify({
                    _loaded: WordGroups._loaded,
                    _loading: WordGroups._loading,
                    groupsCount: Object.keys(WordGroups.groups).length
                }, null, 2));
                // 强制重新加载，确保数据是最新的
                WordGroups._loaded = false;
                await WordGroups.load();
                console.log('[Practice.start] 词组数据加载完成，状态:', JSON.stringify({
                    _loaded: WordGroups._loaded,
                    groupsCount: Object.keys(WordGroups.groups).length,
                    sampleWords: Object.keys(WordGroups.groups).slice(0, 5)
                }, null, 2));
            } catch (e) {
                console.error('加载词组数据失败，继续练习:', e);
            }
        } else {
            console.warn('[Practice.start] WordGroups 未定义或没有 load 方法');
        }
        
        const countInput = document.getElementById('word-count-input');
        const countSelect = document.getElementById('word-count-select-home');
        let wordCount = countInput ? parseInt(countInput.value) : NaN;
        if (isNaN(wordCount)) {
            wordCount = countSelect ? (countSelect.value === 'all' ? 'all' : parseInt(countSelect.value)) : 'all';
        }
        const timeLimitInput = document.getElementById('time-limit-input');
        const timeLimit = timeLimitInput ? parseInt(timeLimitInput.value) : 30; // 默认30秒
        const modeHome = document.getElementById('practice-mode-select-home');
        this.mode = (modeHome && modeHome.value) || 'normal';
        
        this.timeLimit = timeLimit;

        // 记忆设置
        if (typeof Storage !== 'undefined') {
            const settings = Storage.getSettings() || {};
            settings.practice = { wordCount, timeLimit };
            Storage.saveSettings(settings);
        }
        
        // 获取题目（支持错题集一键练习和任务模式）
        let words = [];
        let currentTaskId = null;
        
        // 检查是否从任务清单开始
        const taskIdFromStorage = localStorage.getItem('current_task_id');
        if (taskIdFromStorage && typeof TaskList !== 'undefined') {
            const task = TaskList.getTask(taskIdFromStorage);
            if (task) {
                currentTaskId = taskIdFromStorage;
                const wordBank = Storage.getWordBank();
                // 重要：任务模式下，只使用任务中的wordIds，确保不会包含其他题目
                words = wordBank.filter(w => task.wordIds.includes(w.id));
                
                console.log('[Practice.start] 任务模式：', {
                    taskId: taskIdFromStorage,
                    taskName: task.name,
                    taskWordIdsCount: task.wordIds.length,
                    taskProgressTotal: task.progress?.total,
                    filteredWordsCount: words.length
                });
                
                // 验证：确保words数量与task.wordIds数量一致
                if (words.length !== task.wordIds.length) {
                    console.warn('[Practice.start] ⚠️ 任务题目数量不匹配：', {
                        taskWordIdsCount: task.wordIds.length,
                        filteredWordsCount: words.length,
                        missingWordIds: task.wordIds.filter(id => !words.some(w => w.id === id))
                    });
                }
                
                // 保留所有题目，从completed位置开始（在设置currentIndex时处理）
            }
            // 清除标记
            localStorage.removeItem('current_task_id');
        }
        
        // 检查是否从复习计划或options传入wordIds
        if (words.length === 0 && options.wordIds && Array.isArray(options.wordIds)) {
            const wordBank = Storage.getWordBank();
            words = wordBank.filter(w => options.wordIds.includes(w.id));
        }
        
        const errorOnly = localStorage.getItem('practice_error_only') === '1';
        const errorWordIdsJson = localStorage.getItem('practice_error_word_ids');
        
        if (words.length === 0 && errorWordIdsJson) {
            // 优先使用从结果页传入的错题ID列表（当前轮的错题）
            try {
                const errorWordIds = JSON.parse(errorWordIdsJson);
                const wordBank = Storage.getWordBank();
                words = wordBank.filter(w => errorWordIds.includes(w.id));
                // 清除标记
                localStorage.removeItem('practice_error_word_ids');
            } catch (e) {
                console.error('解析错题ID列表失败:', e);
                localStorage.removeItem('practice_error_word_ids');
            }
        } else if (words.length === 0 && errorOnly) {
            const errorWords = Storage.getErrorWordsFiltered();
            const wordBank = Storage.getWordBank();
            words = wordBank.filter(w => errorWords.some(ew => ew.wordId === w.id));
            // 重置标记
            localStorage.removeItem('practice_error_only');
        } else if (words.length === 0 && typeof PracticeRange !== 'undefined' && PracticeRange.getSelectedWords) {
            // 仅读取练习页容器中的选择，避免与首页重复
            words = PracticeRange.getSelectedWords('practice-range-container');
        } else if (words.length === 0) {
            // 降级：使用原来的范围选择
            const range = document.getElementById('practice-range-select')?.value || 'all';
            words = this.getWordsByRange(range);
        }
        
        // 保存当前任务ID
        if (currentTaskId) {
            this.currentTaskId = currentTaskId;
        }
        
        if (words.length === 0) {
            alert('请先选择练习范围！\n\n在"练习范围"区域勾选要练习的单元。');
            return;
        }
        
        // 题目去重：按word.id去重，避免同一轮内出现重复题目
        const uniqueWordsMap = new Map();
        words.forEach(word => {
            if (!uniqueWordsMap.has(word.id)) {
                uniqueWordsMap.set(word.id, word);
            }
        });
        words = Array.from(uniqueWordsMap.values());

        const singleWords = words.filter(w => (w.word || '').trim().length === 1);
        if (singleWords.length) {
            console.warn('[Practice.start] ⚠️ 当前练习包含单字题目，请检查题库来源:', singleWords.slice(0, 10).map(w => ({
                id: w.id,
                word: w.word,
                grade: w.grade,
                semester: w.semester,
                unit: w.unit,
                unitLabel: w.unitLabel
            })));
        }
        
        let forcedMode = false;
        if (this.forcedWordCount && this.forcedWordCount > 0) {
            wordCount = this.forcedWordCount;
            forcedMode = true;
        }
        
        // 随机选择或限制数量
        // 重要：任务模式下不应该应用wordCount限制，应该使用任务中的所有题目（已通过task.wordIds过滤）
        // 任务模式下，words已经通过task.wordIds过滤，不应该再次限制
        if (!currentTaskId && !forcedMode && wordCount !== 'all') {
            words = this.shuffleArray(words).slice(0, wordCount);
        } else if (currentTaskId) {
            // 任务模式下，确保words数量与任务一致（不应该被wordCount限制）
            console.log('[Practice.start] 任务模式：使用任务中的所有题目，不应用wordCount限制', {
                wordsCount: words.length,
                wordCount: wordCount,
                taskId: currentTaskId
            });
        }
        if (forcedMode) {
            // 用完即清除，下一次回到手动模式
            this.clearForcedWords?.();
        }
        
        this.currentWords = words;
        
        // 如果是从任务继续，使用任务的进度
        let task = null;
        if (currentTaskId && typeof TaskList !== 'undefined') {
            task = TaskList.getTask(currentTaskId);
        } else if (!currentTaskId && typeof TaskList !== 'undefined' && typeof TaskListUI !== 'undefined') {
            // 如果没有任务ID，创建一个新任务（单独练习）
            const wordIds = words.map(w => w.id);
            const selectedUnits = typeof Main !== 'undefined' && Main.getSelectedUnitsForTaskName ? Main.getSelectedUnitsForTaskName() : [];
            const taskName = TaskList.generateTaskName(selectedUnits) || '练习任务';
            
            const newTask = {
                name: taskName,
                wordIds: wordIds,
                type: TaskList.TYPE.PRACTICE,
                status: TaskList.STATUS.IN_PROGRESS,
                progress: {
                    total: wordIds.length,
                    completed: 0,
                    correct: 0,
                    errors: []
                }
            };
            
            const result = TaskList.addTask(newTask);
            if (result.success) {
                this.currentTaskId = newTask.id;
                task = newTask;
                console.log('[Practice.start] 创建新任务:', { taskId: this.currentTaskId, taskName, wordCount: wordIds.length });
            } else {
                console.error('[Practice.start] 创建任务失败:', result);
            }
        }
        
        if (currentTaskId && task && task.progress && task.progress.completed > 0) {
            // 从上次停止的地方继续（completed表示已完成的数量，即当前要答的题目索引）
            // 确保currentIndex不会超过words.length，避免直接跳转到结果页
            // 如果completed已经等于或超过total，说明任务已完成，不应该继续
            if (task.progress.completed >= task.progress.total) {
                // 任务已完成，不应该继续练习
                console.warn('[Practice.start] 任务已完成，不应该继续练习');
                this.currentIndex = words.length; // 设置为words.length，让showNextWord直接finish
            } else {
                this.currentIndex = Math.min(task.progress.completed, words.length - 1);
            }
        } else {
            this.currentIndex = 0;
        }
        
        this.history = []; // 重置历史记录（限制历史记录长度，防止内存泄漏）
        // 限制历史记录最大长度为100，防止内存泄漏
        if (this.history.length > 100) {
            this.history = this.history.slice(-100);
        }
        
        // 重置提交限制相关状态（容错机制）
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this.isSubmitting = false;
        
        // 每轮开始时清空调试日志并记录启动事件
        this.debugEvents = [];
        this.logDebugEvent('start_practice', {
            fromTaskId: this.currentTaskId || null,
            wordsLength: words.length,
            resumeFromIndex: this.currentIndex
        });

        // 初始化练习记录
        // 如果是从任务继续，需要恢复之前的进度
        let initialCompleted = 0;
        let initialCorrect = 0;
        let initialErrors = [];
        if (currentTaskId && task && task.progress) {
            initialCompleted = task.progress.completed || 0;
            initialCorrect = task.progress.correct || 0;
            initialErrors = task.progress.errors || [];
        }
        
        this.practiceLog = {
            totalWords: words.length,
            correctCount: initialCorrect, // 初始正确数
            errorCount: initialErrors.length, // 初始错误数
            totalTime: 0,
            startTime: Date.now(),
            wordTimes: [],
            errorWords: [...initialErrors], // 恢复之前的错题列表
            details: [] // 每题详情 {wordId, correct, snapshot}，从当前开始记录
        };
        
        // 保存初始完成数量，用于计算总进度
        this._initialCompletedCount = initialCompleted;
        this._initialCorrectCount = initialCorrect; // 保存初始正确数
        this._initialErrorWords = [...initialErrors]; // 保存初始错题列表（用于复习任务）
        
        this.isActive = true;
        
        // 初始化跳过设置（从localStorage读取或使用默认值）
        const savedAllowSkip = localStorage.getItem('practice_allow_skip');
        if (savedAllowSkip !== null) {
            this.allowSkip = savedAllowSkip === 'true';
        } else {
            this.allowSkip = true; // 默认可以跳过
        }
        this.updateSkipSettingUI();
        
        // 隐藏设置，显示练习界面
        const settingsEl = document.getElementById('practice-settings');
        const practiceAreaEl = document.getElementById('practice-area');
        
        if (settingsEl) {
            settingsEl.classList.add('d-none');
        }
        if (practiceAreaEl) {
            practiceAreaEl.classList.remove('d-none');
            // 确保Canvas初始化
            if (typeof Handwriting !== 'undefined') {
                if (!Handwriting.canvas) {
                    Handwriting.init('handwriting-canvas');
                } else {
                    // 如果已经初始化，重新调整尺寸
                    setTimeout(() => {
                        Handwriting.resizeCanvas();
                    }, 100);
                }
            }
        }
        
        // 开始第一题
        this.showNextWord();
    },
    
    prepareDirectStartUI(message = '正在准备题目...') {
        const settingsEl = document.getElementById('practice-settings');
        const practiceAreaEl = document.getElementById('practice-area');
        if (settingsEl) settingsEl.classList.add('d-none');
        if (practiceAreaEl) practiceAreaEl.classList.remove('d-none');
        const pinyinDisplay = document.getElementById('pinyin-display');
        if (pinyinDisplay) {
            pinyinDisplay.textContent = message;
        }
        const feedbackArea = document.getElementById('feedback-area');
        if (feedbackArea) {
            feedbackArea.innerHTML = '<span class="text-muted small">准备中…</span>';
        }
        if (typeof Handwriting !== 'undefined' && Handwriting.clear) {
            Handwriting.clear();
        }
    },
    
    prepareDirectStart() {
        this._pendingDirectStart = true;
        this.prepareDirectStartUI();
    },

    savePartialIfActive() {
        if (!this.isActive || !this.practiceLog || this.practiceLog.totalWords === 0) return;
        let isDebug = false; try { isDebug = localStorage.getItem('debugMode') === '1'; } catch(e) {}
        try {
            // 先保存练习记录（partial），然后保存错题到按轮视图
            const logPayload = this._buildPracticeLogPayload({ partial: true, isDebug });
            let log = null;
            try {
                log = Storage.addPracticeLog(logPayload);
                
                // 保存错题到按轮视图（使用log.id作为roundId）
                if (log && log.id && this.practiceLog.details && this.practiceLog.details.length > 0) {
                    const errorDetails = this.practiceLog.details.filter(d => !d.correct);
                    if (errorDetails.length > 0 && typeof Storage !== 'undefined' && Storage.saveErrorWordsForRound) {
                        const errorWords = errorDetails.map(d => {
                            const word = this.currentWords.find(w => w.id === d.wordId);
                            return {
                                wordId: d.wordId,
                                word: word ? word.word : '',
                                pinyin: word ? (word.pinyin || '') : '',
                                snapshot: d.snapshot || null
                            };
                        });
                        console.log('[Practice.savePartialIfActive] 保存错题到按轮视图，roundId:', log.id, '错题数:', errorWords.length);
                        Storage.saveErrorWordsForRound(log.id, errorWords);
                    } else {
                        console.log('[Practice.savePartialIfActive] 没有错题需要保存到按轮视图');
                    }
                } else {
                    console.warn('[Practice.savePartialIfActive] 无法保存错题到按轮视图：', {
                        hasLog: !!log,
                        hasLogId: !!(log && log.id),
                        hasDetails: !!(this.practiceLog && this.practiceLog.details),
                        detailsLength: this.practiceLog?.details?.length || 0
                    });
                }
            } catch (e) {
                console.warn('保存未完成练习记录失败:', e);
            }
            
            // 使用草稿保存而不是写入正式练习记录，避免生成重复的按轮记录
            this.saveAutosaveDraft();
            
            // 如果有任务ID，更新任务进度
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(true); // true表示中断
            }
        } catch(e) {
            console.warn('保存未完成练习失败:', e);
        } finally {
            this.isActive = false;
        }
    },
    
    /**
     * 更新任务进度
     * @param {boolean} paused - 是否暂停（中断）
     */
    updateTaskProgress(paused = false) {
        if (!this.currentTaskId || !this.practiceLog || typeof TaskList === 'undefined') return;
        
        const task = TaskList.getTask(this.currentTaskId);
        if (!task) return;
        
        // completed应该是所有答过的题目数量（无论对错）
        // details数组包含了当前会话中答过的题目
        // 需要加上之前的完成数量（_initialCompletedCount）
        const details = this.practiceLog.details || [];
        const currentSessionCompleted = details.length; // 当前会话中答过的题目数量
        const previousCompleted = this._initialCompletedCount || 0; // 之前已完成的题目数量
        const completed = previousCompleted + currentSessionCompleted; // 总完成数量
        
        // 正确数需要加上初始正确数
        // practiceLog.correctCount 是从 initialCorrect 开始的，所以当前会话的正确数 = correctCount - initialCorrect
        const previousCorrect = this._initialCorrectCount || 0;
        const totalCorrectCount = this.practiceLog.correctCount || 0;
        const currentSessionCorrect = totalCorrectCount - previousCorrect; // 当前会话正确数
        const totalCorrect = previousCorrect + currentSessionCorrect; // 总正确数
        
        // 错题列表需要合并初始错题和当前错题
        const previousErrors = this._initialErrorWords || [];
        const currentErrors = this.practiceLog.errorWords || [];
        // 合并错题列表（去重，只保留wordId）
        const previousErrorIds = previousErrors.map(e => typeof e === 'string' ? e : (e.wordId || e.id || e));
        const currentErrorIds = currentErrors.map(e => typeof e === 'string' ? e : (e.wordId || e.id || e));
        const allErrorIds = new Set([...previousErrorIds, ...currentErrorIds]);
        const errors = Array.from(allErrorIds);
        
        const updates = {
            progress: {
                total: task.progress.total,
                completed: completed, // 所有答过的题目（无论对错）= 之前的 + 当前的
                correct: totalCorrect, // 总正确数 = 之前的 + 当前的
                errors: errors // 合并后的错题列表
            }
        };
        
        if (paused) {
            updates.status = TaskList.STATUS.PAUSED;
        } else if (completed >= task.progress.total) {
            // 只有当completed真正等于或超过total时才标记为完成
            // 注意：completed是已答题目数，不应该因为更新进度就结束任务
            // 任务结束应该由finish()方法触发，而不是updateTaskProgress
            updates.status = TaskList.STATUS.COMPLETED;
        } else {
            updates.status = TaskList.STATUS.IN_PROGRESS;
        }
        
        TaskList.updateTask(this.currentTaskId, updates);
        
        // 更新任务清单UI（如果任务清单页面可见）
        if (typeof TaskListUI !== 'undefined') {
            TaskListUI.updateBadge();
            // 如果任务清单页面当前可见，刷新显示
            const taskListPage = document.getElementById('tasklist');
            if (taskListPage && !taskListPage.classList.contains('d-none')) {
                TaskListUI.render();
            }
        }
    },
    
    /** autosave draft of current progress to localStorage */
    saveAutosaveDraft() {
        if (!this.practiceLog) return;
        const snapshot = {
            totalWords: this.practiceLog.totalWords,
            correctCount: this.practiceLog.correctCount,
            errorCount: this.practiceLog.errorCount,
            totalTime: this.practiceLog.totalTime,
            averageTime: this.practiceLog.totalWords > 0 ? this.practiceLog.totalTime / this.practiceLog.totalWords : 0,
            errorWords: this.practiceLog.errorWords,
            details: this.practiceLog.details,
            status: 'partial'
        };
        if (typeof Storage !== 'undefined' && Storage.setPracticeAutosave) {
            Storage.setPracticeAutosave(snapshot);
        }
    },
    
    /**
     * 根据范围获取题目
     */
    getWordsByRange(range) {
        const wordBank = Storage.getWordBank();
        
        switch (range) {
            case 'error':
                const errorWords = Storage.getErrorWordsFiltered();
                return wordBank.filter(w => errorWords.some(ew => ew.wordId === w.id));
            case 'grade':
                // TODO: 实现按年级筛选
                return wordBank;
            default:
                return wordBank;
        }
    },
    
    /**
     * 显示下一题
     */
    async showNextWord() {
        // 清除重做状态（切换到新题目时）
        this.clearRetryTimer();
        this._isRetryingError = false;
        this._hasClearedCanvasInRetry = false; // 重置清空标志
        
        // 检查是否还有题目未答
        // 如果有任务，需要检查任务进度，确保不会因为currentIndex等于words.length就结束
        if (this.currentIndex >= this.currentWords.length) {
            // 如果有任务，检查任务是否真的完成了
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                const task = TaskList.getTask(this.currentTaskId);
                if (task && task.progress) {
                    const completed = this._initialCompletedCount + (this.practiceLog.details?.length || 0);
                    // 只有当真正完成所有题目时才结束
                    if (completed >= task.progress.total) {
            this.finish();
            return;
                    } else {
                        // 任务未完成，但currentIndex已经超出，说明有问题
                        console.error('[Practice.showNextWord] currentIndex超出范围，但任务未完成', {
                            currentIndex: this.currentIndex,
                            wordsLength: this.currentWords.length,
                            completed: completed,
                            total: task.progress.total
                        });
                        // 重置currentIndex到最后一个有效索引
                        this.currentIndex = this.currentWords.length - 1;
                    }
                } else {
                    this.finish();
                    return;
                }
            } else {
                this.finish();
                return;
            }
        }
        
        const word = this.currentWords[this.currentIndex];
        
        // 保存当前题目到历史（如果是从下一题来的）
        if (this.currentIndex > 0 && this.history.length < this.currentIndex) {
            // 说明是正常前进，保存上一题的信息
            const prevWord = this.currentWords[this.currentIndex - 1];
            this.history.push({
                word: prevWord,
                index: this.currentIndex - 1
            });
            // 限制历史记录最大长度为100，防止内存泄漏
            if (this.history.length > 100) {
                this.history = this.history.slice(-100);
            }
        }
        
        // 显示拼音和词组
        const pinyinDisplay = document.getElementById('pinyin-display');
        if (!pinyinDisplay) {
            console.error('pinyin-display元素不存在');
            return;
        }
        
        let displayText = word.pinyin || '';
        console.log('[Practice.showNextWord] WordGroups检查:', JSON.stringify({
            wordGroupsDefined: typeof WordGroups !== 'undefined',
            word: word.word,
            pinyin: word.pinyin,
            windowWordGroups: typeof window.WordGroups !== 'undefined',
            globalWordGroups: typeof globalThis.WordGroups !== 'undefined'
        }, null, 2));
        
        if (typeof WordGroups !== 'undefined') {
            // 确保词组数据已加载
            console.log('[Practice.showNextWord] WordGroups状态:', JSON.stringify({
                _loaded: WordGroups._loaded,
                _loading: WordGroups._loading,
                groupsCount: Object.keys(WordGroups.groups).length,
                hasWord: word.word in WordGroups.groups
            }, null, 2));
            
            // 确保词组数据已加载（如果未加载，先加载）
            if (!WordGroups._loaded && WordGroups.load) {
                try {
                    console.log('[Practice.showNextWord] 开始加载词组数据...');
                    await WordGroups.load();
                    console.log('[Practice.showNextWord] 词组数据加载完成:', JSON.stringify({
                        _loaded: WordGroups._loaded,
                        groupsCount: Object.keys(WordGroups.groups).length,
                        hasWord: word.word in WordGroups.groups
                    }, null, 2));
                } catch (e) {
                    console.error('显示题目时加载词组数据失败:', e);
                }
            }
            // 获取词组显示文本（将字替换为拼音，例如：fēng叶，fēng树，fēng林）
            const groupsText = WordGroups.getDisplayText(word.word, word.pinyin || '');
            // 如果返回了有效文本，使用它；否则使用拼音或字本身
            if (groupsText && groupsText.trim()) {
                displayText = groupsText;
            } else {
                // 如果词组返回空，使用拼音或字本身
                console.warn('[Practice.showNextWord] 词组返回空，使用拼音或字:', word.pinyin || word.word);
                displayText = word.pinyin || word.word || '';
            }
        } else {
            // 如果没有WordGroups，使用拼音或字本身
            console.warn('[Practice.showNextWord] WordGroups未定义，使用拼音或字');
            displayText = word.pinyin || word.word || '';
        }
        
        // 确保displayText不为空
        if (!displayText || !displayText.trim()) {
            displayText = word.word || '';
        }
        
        // 使用textContent确保正确显示（清除之前的图标和HTML）
        // 出题时显示透明占位符，保持布局稳定（与判定时的图标同宽）
        // 使用主题颜色，支持深色模式
        pinyinDisplay.innerHTML = '<span style="opacity: 0; font-size: 1.2em; margin-right: 0.5rem;">✓</span><span style="color: var(--bs-body-color); font-weight: 600;">' + displayText + '</span>';
        console.log('[Practice] 显示题目:', JSON.stringify({
            word: word.word,
            pinyin: word.pinyin || '(空)',
            displayText: displayText,
            wordId: word.id
        }, null, 2));
        
        // 切换字时强制重置提交限制（容错机制：确保新字可以立即提交）
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0; // 重置连续拦截计数
        this.isSubmitting = false; // 确保提交状态已清除
        
        // 记录日志，便于调试
        if (typeof Debug !== 'undefined') {
            Debug.log('info', `切换到新题目，已重置提交限制: wordId=${word.id}, word=${word.word}`, 'practice');
        }
        
        // 更新进度
        document.getElementById('progress-badge').textContent = 
            `${this.currentIndex + 1}/${this.currentWords.length}`;
        
        // 更新答题数可视化
        this.updateProgressVisual();
        
        // 清除画布
        Handwriting.clear();
        
        // 清除反馈
        document.getElementById('feedback-area').innerHTML = '';
        
        // 保存当前显示文本和字，用于后续反馈时替换
        this._currentDisplayText = displayText;
        this._currentWord = word.word;
        
        // 恢复提交按钮状态
        const submitBtn = document.getElementById('submit-answer-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = submitBtn._originalHtml || '<i class="bi bi-check-circle"></i> 提交';
            submitBtn.style.pointerEvents = 'auto';
            submitBtn.style.userSelect = 'auto';
        }
        
        // 开始计时
        this._currentWordStartTime = Date.now();
        this.startTimer(this._currentWordStartTime);
    },
    
    /**
     * 更新可见的调试信息显示
     */
    updateDebugInfo(message) {
        const debugInfoEl = document.getElementById('debug-info-text');
        const debugInfoContainer = document.getElementById('practice-debug-info');
        if (debugInfoEl) {
            debugInfoEl.textContent = message;
            // 确保调试信息区域可见
            if (debugInfoContainer) {
                debugInfoContainer.classList.remove('d-none');
                debugInfoContainer.style.display = 'block';
            }
        }
    },
    
    /**
     * 更新答题数可视化
     */
    updateProgressVisual() {
        const container = document.getElementById('progress-visual');
        if (!container) return;
        
        const total = this.currentWords.length;
        const completed = this.practiceLog.details?.length || 0;
        const correct = this.practiceLog.correctCount || 0;
        const error = this.practiceLog.errorCount || 0;
        const remaining = total - completed;
        
        container.innerHTML = '';
        
        // 显示已完成的格子（绿色=正确，红色=错误）
        for (let i = 0; i < completed; i++) {
            const detail = this.practiceLog.details[i];
            const square = document.createElement('div');
            square.style.width = '8px';
            square.style.height = '8px';
            square.style.backgroundColor = detail?.correct ? '#10b981' : '#ef4444'; // 绿色或红色
            square.style.borderRadius = '1px';
            square.style.margin = '0'; // 去掉间距
            // 如果已经是错误状态，标记为已锁定，不可更改
            if (!detail?.correct) {
                square.setAttribute('data-locked', 'true');
            }
            container.appendChild(square);
        }
        
        // 显示未完成的灰色格子
        for (let i = 0; i < remaining; i++) {
            const square = document.createElement('div');
            square.style.width = '8px';
            square.style.height = '8px';
            square.style.backgroundColor = '#e5e7eb'; // 灰色
            square.style.borderRadius = '1px';
            square.style.margin = '0'; // 去掉间距
            container.appendChild(square);
        }
        
        // 数字在最后（通过progress-badge显示，这里不需要额外显示）
    },
    
    /**
     * 开始计时器
     */
    startTimer(startTime) {
        let remaining = this.timeLimit;
        const timerProgress = document.getElementById('timer-progress');
        const timerPauseIcon = document.getElementById('timer-pause-icon');
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 更新环形进度
        const circumference = 2 * Math.PI * 26; // r=26
        const progress = (this.timeLimit - remaining) / this.timeLimit;
        const offset = circumference - (progress * circumference);
        if (timerProgress) {
            timerProgress.style.strokeDasharray = `${circumference} ${circumference}`;
            timerProgress.style.strokeDashoffset = offset;
        }
        
        // 更新暂停图标
        if (timerPauseIcon) {
            timerPauseIcon.className = 'bi bi-pause-fill';
        }
        
        this.timer = setInterval(() => {
            remaining--;
            
            // 更新环形进度
            const progress = (this.timeLimit - remaining) / this.timeLimit;
            const offset = circumference - (progress * circumference);
            if (timerProgress) {
                timerProgress.style.strokeDashoffset = offset;
            }
            
            if (remaining <= 0) {
                clearInterval(this.timer);
                this.timeUp(startTime);
            }
        }, 1000);
    },

    pause() {
        if (!this.isActive) return;
        // 如果已经暂停，再次调用pause应该不做任何操作（防止重复暂停）
        if (this.isPaused) {
            console.log('[Practice.pause] 已经处于暂停状态，忽略重复调用');
            return;
        }
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isPaused = true;
        const timerPauseIcon = document.getElementById('timer-pause-icon');
        if (timerPauseIcon) {
            timerPauseIcon.className = 'bi bi-play-fill';
        }
        console.log('[Practice.pause] 已暂停');
    },

    resume() {
        if (!this.isActive) return;
        // 如果没有暂停，调用resume应该不做任何操作（防止重复继续）
        if (!this.isPaused) {
            console.log('[Practice.resume] 未处于暂停状态，忽略调用');
            return;
        }
        this.isPaused = false;
        const timerPauseIcon = document.getElementById('timer-pause-icon');
        if (timerPauseIcon) {
            timerPauseIcon.className = 'bi bi-pause-fill';
        }
        const wordStartTime = this._currentWordStartTime || Date.now();
        this.startTimer(wordStartTime);
        console.log('[Practice.resume] 已继续');
    },
    
    /**
     * 时间到
     */
    async timeUp(startTime) {
        const wordTime = (Date.now() - startTime) / 1000;
        this.practiceLog.wordTimes.push(wordTime);
        
        const word = this.currentWords[this.currentIndex];
        let snapshot = null;
        if (this.mode === 'normal') {
            // 获取当前快照（有内容则识别，无内容直接判错）
            const hasInk = (typeof Handwriting !== 'undefined' && Handwriting.hasContent && Handwriting.hasContent());
            if (hasInk) {
                snapshot = Handwriting.getSnapshot();
                // 自动提交并判断对错
                try {
                    if (typeof Debug !== 'undefined') {
                        Debug.log('info', `超时自动识别字符: ${word.word}`, 'recognition');
                        Debug.log('info', `图片快照大小: ${(snapshot.length / 1024).toFixed(2)}KB`, 'recognition');
                    }
                    const result = await Recognition.recognize(snapshot, word.word);
                    // 记录时间
                    this.practiceLog.totalTime += wordTime;
                    if (result.success && result.passed) {
                        this.practiceLog.correctCount++;
                        this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot, displayText: this._currentDisplayText });
                        this.updateProgressVisual();
                        this.showFeedback(true, word, '');
                        
                        // 如果是复习计划中的字，更新复习计划状态
                        this.updateReviewPlanIfNeeded(word.id, true);
                    } else {
                        this.practiceLog.errorCount++;
                        await this.recordError(word, snapshot);
                        this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
                        this.updateProgressVisual();
                        this.showFeedback(false, word, result.recognized || '时间到');
                        
                        // 如果是复习计划中的字，更新复习计划状态
                        this.updateReviewPlanIfNeeded(word.id, false);
                    }
                } catch (e) {
                    this.practiceLog.errorCount++;
                    await this.recordError(word, snapshot);
                    this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
                    this.updateProgressVisual();
                    this.showFeedback(false, word, '时间到');
                }
            } else {
                // 无内容：直接判错
                this.practiceLog.errorCount++;
                await this.recordError(word, null);
                this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
                this.updateProgressVisual();
                this.showFeedback(false, word, '时间到');
                
                // 更新任务进度（如果有任务）
                if (this.currentTaskId && typeof TaskList !== 'undefined') {
                    this.updateTaskProgress(false);
                }
            }
        } else {
            // 纸质模式：不记录错题/详情
        }
        
        // 2秒后下一题
        this.scheduleNextWord(2000, () => {
            // 保存当前题目到历史（超时也算）
            if (this.currentIndex < this.currentWords.length) {
                this.history.push({
                    word: word,
                    index: this.currentIndex,
                    snapshot: snapshot
                });
                // 限制历史记录最大长度为100，防止内存泄漏
                if (this.history.length > 100) {
                    this.history = this.history.slice(-100);
                }
            }
            this.currentIndex++;
            this.showNextWord();
        });
        
        // 持续草稿保存
        this.saveAutosaveDraft();
    },
    
    /**
     * 提交答案
     */
    async submitAnswer(options = {}) {
        const { bypassCooldown = false } = options;
        const word = this.currentWords[this.currentIndex];
        this.logDebugEvent('submit_click', { bypassCooldown, wordId: word?.id });
        
        // 防重复提交：同一个字10秒内只能提交一次
        const now = Date.now();
        // 如果切换了字，重置提交时间
        if (this.lastSubmitWordId !== word.id) {
            this.lastSubmitTime = 0;
            this.lastSubmitWordId = word.id;
            this.consecutiveBlockCount = 0; // 切换字时重置连续拦截计数
        }
        
        const timeSinceLastSubmit = now - this.lastSubmitTime;
        if (!bypassCooldown && timeSinceLastSubmit < 3000 && this.lastSubmitTime > 0 && this.lastSubmitWordId === word.id) {
            // 容错机制：如果连续3次被拦截，自动清除限制（可能是bug导致）
            this.consecutiveBlockCount++;
            if (this.consecutiveBlockCount >= 3) {
                console.warn('[Practice] 检测到连续3次提交被拦截，自动清除限制（容错机制）', {
                    wordId: word.id,
                    word: word.word,
                    lastSubmitTime: this.lastSubmitTime,
                    timeSinceLastSubmit: timeSinceLastSubmit,
                    consecutiveBlockCount: this.consecutiveBlockCount
                });
                // 强制清除限制
                this.lastSubmitTime = 0;
                this.lastSubmitWordId = null;
                this.consecutiveBlockCount = 0;
                // 继续执行提交，不返回
            } else {
                const remainingSeconds = Math.ceil((3000 - timeSinceLastSubmit) / 1000);
                const remainingSeconds = Math.ceil((3000 - timeSinceLastSubmit) / 1000);
                console.warn('[Practice] 提交被拦截', {
                    wordId: word.id,
                    word: word.word,
                    remainingSeconds: remainingSeconds,
                    consecutiveBlockCount: this.consecutiveBlockCount
                });
                this.logDebugEvent('submit_blocked', {
                    remainingSeconds,
                    timeSinceLastSubmit,
                    lastSubmitTime: this.lastSubmitTime,
                    consecutiveBlockCount: this.consecutiveBlockCount,
                    lastSubmitWordId: this.lastSubmitWordId
                });
                alert(`请等待 ${remainingSeconds} 秒后再提交`);
                return;
            }
        } else {
            // 提交未被拦截，重置连续拦截计数
            this.consecutiveBlockCount = 0;
            if (bypassCooldown) {
                this.lastSubmitTime = 0;
            }
        }
        
        // 如果正在提交中，忽略
        if (this.isSubmitting) {
            return;
        }
        
        if (this.mode === 'normal') {
            const hasInk = typeof Handwriting !== 'undefined' && Handwriting.hasContent && Handwriting.hasContent();
            if (!hasInk) {
                // 没有笔迹：直接判为错题，不调用API
                console.log('[Practice.submitAnswer] ⏭️ 画布为空，跳过识别API，直接判错');
                console.log('[Practice.submitAnswer] 🚫 不会调用 Recognition.recognize()');
                this.updateDebugInfo('⏭️ 画布为空，跳过识别API，直接判错');
                if (typeof Debug !== 'undefined') {
                    Debug.log('info', '画布为空，跳过识别API，不会调用Recognition.recognize()', 'practice');
                }
                await this.handleEmptySubmission(word);
                return;
            }
        }
        const snapshot = this.mode === 'normal' ? Handwriting.getSnapshot() : null;
        const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 设置提交状态和按钮loading
        this.isSubmitting = true;
        this.lastSubmitTime = now;
        this.lastSubmitWordId = word.id; // 记录当前提交的字ID
        this.logDebugEvent('submit_start', { wordId: word.id, hasSnapshot: !!snapshot, wordTime });
        const submitBtn = document.getElementById('submit-answer-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>识别中...';
        
        // 显示识别中（只有正常模式且有笔迹时才显示）
        if (this.mode === 'normal' && snapshot) {
            console.log('[Practice.submitAnswer] ✅ 画布有内容，开始调用识别API');
            console.log('[Practice.submitAnswer] 📡 API调用路径: Recognition.recognize()');
            console.log('[Practice.submitAnswer] 📊 快照大小:', (snapshot.length / 1024).toFixed(2), 'KB');
            this.updateDebugInfo(`✅ 画布有内容，正在调用识别API（快照: ${(snapshot.length / 1024).toFixed(2)}KB）`);
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `画布有内容，开始识别API调用，快照大小: ${(snapshot.length / 1024).toFixed(2)}KB`, 'practice');
            }
        document.getElementById('feedback-area').innerHTML = 
            '<div class="loading"></div> 识别中...';
        } else {
            console.log('[Practice.submitAnswer] ⚠️ 不显示"识别中"提示 - 模式:', this.mode, '快照:', snapshot ? '有' : '无');
            console.log('[Practice.submitAnswer] 🚫 不会调用 Recognition.recognize()');
            this.updateDebugInfo('🚫 不会调用识别API（模式或快照问题）');
        }
        
        try {
            // 调试日志
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `开始识别字符: ${word.word}`, 'recognition');
                Debug.log('info', `图片快照大小: ${(snapshot.length / 1024).toFixed(2)}KB`, 'recognition');
            }
            
            let result = { success: true, passed: false, recognized: '' };
            if (this.mode === 'normal') {
                // 调用识别
                result = await Recognition.recognize(snapshot, word.word);
            } else {
                // 纸质模式：直接通过到下一题
                result = { success: true, passed: true, recognized: '' };
            }
            
            // 调试日志
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `识别结果: ${JSON.stringify(result)}`, 'recognition');
            }
            
            if (!result.success) {
                const error = new Error(result.error || '识别失败');
                if (typeof Debug !== 'undefined') {
                    Debug.logError(error, '识别返回失败');
                }
                throw error;
            }
            
            // 记录时间
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            
            if (result.passed) {
                // 正确
                if (this.mode === 'normal') {
                    // 如果是在重做错题模式下答对了，清除重做状态
                    const wasRetrying = this._isRetryingError;
                    if (wasRetrying) {
                        this.clearRetryTimer();
                        this._isRetryingError = false;
                    }
                    
                    // 检查是否已存在该题目的记录
                    const existingIdx = this.practiceLog.details.findIndex(d => d.wordId === word.id);
                    
                    if (wasRetrying) {
                        // 重做模式下答对：不新增记录，不改变统计，保持原有错误记录
                        // 不更新快照（只保留第一次写错的字迹）
                        // 不增加正确计数，不减少错误计数，不新增记录
                        // 同步到题库管理的掌握状态：依然标记为错题
                        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                            Storage.setWordMasteryStatus(word.id, 'error');
                            // 确保在错题本中（如果不在，添加进去，但不传递快照，因为答对时不应该更新快照）
                            if (typeof Storage !== 'undefined' && Storage.addErrorWord) {
                                Storage.addErrorWord(word.id, word.word, word.pinyin || '', null);
                            }
                        }
                    } else {
                        // 非重做模式下答对：正常处理
                        if (existingIdx >= 0) {
                            const oldDetail = this.practiceLog.details[existingIdx];
                            // 如果旧记录是错误，需要调整计数（减少错题数）
                            if (!oldDetail.correct) {
                                this.practiceLog.errorCount = Math.max(0, this.practiceLog.errorCount - 1);
                            }
                            this.practiceLog.details.splice(existingIdx, 1);
                        }
                    this.practiceLog.correctCount++;
                    // 保存详情（保留正确也保留快照）
                        this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot, displayText: this._currentDisplayText });
                        
                        // 同步到题库管理的掌握状态
                        // 规则：错题可以覆盖已掌握，但已掌握不能覆盖错题（除非是复习任务中最后一次做对）
                        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                            const currentStatus = Storage.getWordMasteryStatus(word.id);
                            const isReviewTask = this.currentTaskId && typeof TaskList !== 'undefined' && (() => {
                                const task = TaskList.getTask(this.currentTaskId);
                                return task && task.type === TaskList.TYPE.REVIEW;
                            })();
                            
                            // 如果当前是错题状态，且不是复习任务，则不能覆盖为已掌握
                            if (currentStatus === 'error' && !isReviewTask) {
                                // 保持错题状态，不覆盖
                                Storage.setWordMasteryStatus(word.id, 'error');
                            } else {
                                // 其他情况：标记为已掌握
                                Storage.setWordMasteryStatus(word.id, 'mastered');
                                // 从错题本移除
                                if (typeof Storage !== 'undefined' && Storage.removeErrorWord) {
                                    Storage.removeErrorWord(word.id);
                                }
                            }
                        }
                        this.updateProgressVisual();
                    }
                    
                    this.showFeedback(true, word, '');
                } else {
                    // 纸质模式：不反馈对错，快速进入下一题
                    document.getElementById('feedback-area').innerHTML = '';
                }
            } else {
                // 错误
                if (this.mode === 'normal') {
                    // 检查是否已存在该题目的记录，如果存在则移除旧的（防止重复）
                    const existingIdx = this.practiceLog.details.findIndex(d => d.wordId === word.id);
                    if (existingIdx >= 0) {
                        const oldDetail = this.practiceLog.details[existingIdx];
                        // 如果旧记录是正确的，需要调整计数
                        if (oldDetail.correct) {
                            this.practiceLog.correctCount = Math.max(0, this.practiceLog.correctCount - 1);
                        }
                        this.practiceLog.details.splice(existingIdx, 1);
                    }
                    this.practiceLog.errorCount++;
                    await this.recordError(word, snapshot);
                    this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
                    
                    // 同步到题库管理的掌握状态：答错的题目标记为错题
                    // 规则：错题可以覆盖已掌握状态
                    if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                        Storage.setWordMasteryStatus(word.id, 'error');
                    }
                    
                    this.updateProgressVisual();
                    this.showFeedback(false, word, result.recognized);
                    
                    // 进入错题重做模式：显示正确答案，8秒后清空画布
                    this.enterRetryMode(word);
                } else {
                    document.getElementById('feedback-area').innerHTML = '';
                }
            }
            // 持续草稿保存
            this.saveAutosaveDraft();
            
            // 更新任务进度（如果有任务，在答题后立即更新）
            // 此时details已经包含了当前答过的题目，所以进度应该立即更新
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
            
            // 恢复按钮状态
            this.isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
            
            // 如果答对了，继续下一题（但重做模式下需要等待用户确认）
            // 如果答错了，只有在重做模式下才不进入下一题（等待用户重新提交）
            // 如果答错了且不在重做模式（第一次答错），已经调用了 enterRetryMode，不应该进入下一题
            if (result.passed) {
                // 答对了，继续下一题
                // 在重做模式下，即使答对了，也应该等待用户确认（延迟更长）
                const wasRetrying = this._isRetryingError;
                const delay = wasRetrying ? 3000 : (this.mode === 'normal' ? 2000 : 300);
                this.scheduleNextWord(delay, () => {
                    // 保存当前题目到历史（限制历史记录长度，防止内存泄漏）
                if (this.currentIndex < this.currentWords.length) {
                    this.history.push({
                        word: word,
                        index: this.currentIndex,
                        snapshot: snapshot
                    });
                        // 限制历史记录最大长度为100，防止内存泄漏
                        if (this.history.length > 100) {
                            this.history = this.history.slice(-100);
                        }
                }
                this.currentIndex++;
                    
                    // 检查是否是最后一题（在递增后检查）
                    // 注意：currentIndex 已经递增，所以如果 currentIndex >= totalWords，说明已经处理完所有题目
                    if (this.currentIndex >= this.currentWords.length) {
                        // 最后一题已提交，直接结束
                        this.isProcessingNextQuestion = false; // 重置处理状态
                        this.finish();
                        return;
                    }
                    
                    this.isProcessingNextQuestion = false; // 重置处理状态
                this.showNextWord();
                });
            } else {
                // 答错了
                // 如果不在重做模式（第一次答错），已经调用了 enterRetryMode，不应该进入下一题
                // 如果在重做模式（重做时又答错），也不应该进入下一题，会再次调用 enterRetryMode
                // 两种情况都不进入下一题，等待用户重新提交
            }
        this._currentWordStartTime = null;
        } catch (error) {
            console.error('提交失败:', error);
            
            // 恢复按钮状态
            this.isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
            
            // 详细的调试日志
            if (typeof Debug !== 'undefined') {
                Debug.logError(error, '练习提交异常');
                Debug.log('error', `错误完整信息: ${JSON.stringify({
                    name: error.name,
                    message: error.message,
                    stack: error.stack,
                    toString: error.toString()
                })}`, 'error');
            }
            
            // 显示错误（简化显示，详细错误在调试面板）
            let displayMsg = error.message;
            let errorClass = 'text-danger';
            let errorIcon = 'bi-exclamation-triangle';
            
            // 针对配额错误，使用更友好的提示
            if (error.isQuotaError) {
                errorClass = 'text-warning';
                errorIcon = 'bi-hourglass-split';
                // 配额错误通常消息已经包含完整信息，直接使用
                displayMsg = error.message;
            } else if (error.message.includes('load failed') || error.message.includes('Failed to fetch')) {
                displayMsg = '网络连接失败，请检查调试面板查看详情';
            } else if (error.errorInfo) {
                // 使用错误信息中的友好提示
                displayMsg = `${error.errorInfo.title}\n\n${error.errorInfo.message}`;
            }
            
            // 将换行符转换为HTML换行
            const displayMsgHtml = displayMsg.replace(/\n/g, '<br>');
            
            document.getElementById('feedback-area').innerHTML = 
                `<div class="${errorClass}">
                    <i class="bi ${errorIcon}"></i> ${displayMsgHtml}
                    ${error.isQuotaError ? '' : '<br><small class="text-muted">点击导航栏"调试"按钮查看详细错误信息</small>'}
                </div>`;
        }
    },
    
    /**
     * 不会（直接显示正确答案，不调用API）
     * 绕过提交限制，允许随时跳过
     */
    async skipAnswer() {
        // 检查是否允许跳过
        if (!this.allowSkip) {
            // 检查当前题目是否已答对
            const currentWordId = this.currentWords[this.currentIndex]?.id;
            const currentDetail = this.practiceLog.details?.find(d => d.wordId === currentWordId);
            if (!currentDetail || !currentDetail.correct) {
                alert('当前题目尚未答对，无法跳过。请答对后再继续。');
                return;
            }
        }
        
        // 防止重复点击：如果正在处理中，直接返回
        if (this.isSkipping) {
            return;
        }
        this.isSkipping = true;
        
        const word = this.currentWords[this.currentIndex];
        
        // 绕过提交限制：清除限制状态，允许跳过
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this.isSubmitting = false;
        
        const snapshot = this.mode === 'normal' && Handwriting.hasContent() ? Handwriting.getSnapshot() : null;
        const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 检查是否已存在该题目的记录，如果存在则移除旧的（防止重复）
        const existingIdx = this.practiceLog.details.findIndex(d => d.wordId === word.id);
        if (existingIdx >= 0) {
            const oldDetail = this.practiceLog.details[existingIdx];
            // 如果旧记录是正确的，需要调整计数
            if (oldDetail.correct) {
                this.practiceLog.correctCount = Math.max(0, this.practiceLog.correctCount - 1);
            } else {
                // 如果旧记录是错误，需要调整计数（避免重复计数）
                this.practiceLog.errorCount = Math.max(0, this.practiceLog.errorCount - 1);
            }
            this.practiceLog.details.splice(existingIdx, 1);
        }
        
        // 记录为错误（不会）
        this.practiceLog.errorCount++;
        this.practiceLog.wordTimes.push(wordTime);
        this.practiceLog.totalTime += wordTime;
        
        // 如果有笔迹，保存快照
        if (snapshot) {
            await this.recordError(word, snapshot);
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
        } else {
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
        }
        
        // 更新进度可视化（确保红色方块显示）
        this.updateProgressVisual();
        
        // 同步到题库管理的掌握状态：答错的题目标记为错题（错题可以覆盖已掌握）
        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
            Storage.setWordMasteryStatus(word.id, 'error');
        }
        
        // 更新任务进度（如果有任务，在答题后立即更新）
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false);
        }
        
        // 显示反馈（错误）- 这会显示正确答案在田字格中
        this.showFeedback(false, word, '');
        
        // 持续草稿保存
        this.saveAutosaveDraft();
        
        if (this.allowSkip) {
            // 允许跳过：直接进入下一题，不进入重做模式
            this._currentWordStartTime = null;
            this.isSkipping = false; // 重置跳过状态
            // 停止当前题目的计时器（下一题会重新启动）
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
            
            // 延迟1秒后进入下一题：短暂停留给用户看正确答案，然后自动跳转
            this.scheduleNextWord(1000, () => {
                if (this.currentIndex < this.currentWords.length) {
                    this.history.push({
                        word: word,
                        index: this.currentIndex,
                        snapshot: null
                    });
                    // 限制历史记录最大长度为100，防止内存泄漏
                    if (this.history.length > 100) {
                        this.history = this.history.slice(-100);
                    }
                }
                this.currentIndex++;
                if (this.currentIndex >= this.currentWords.length) {
                    this.finish();
                    return;
                }
                this.showNextWord();
            });
        } else {
            // 不允许跳过：进入错题重做模式：显示正确答案，8秒后清空画布
            this.enterRetryMode(word);
            // 不进入下一题，等待用户重新提交
            this._currentWordStartTime = null;
            this.isSkipping = false; // 重置跳过状态
        }
    },
    
    /**
     * 显示反馈
     * 正确：拼音提示替换为绿色汉字
     * 错误：拼音提示替换为红色汉字，并在田字格中显示楷体红字
     */
    showFeedback(isCorrect, word, recognized) {
        const feedbackArea = document.getElementById('feedback-area');
        const pinyinDisplay = document.getElementById('pinyin-display');
        
        // 清空反馈区域（不显示红框内容）
        feedbackArea.innerHTML = '';
        
        if (pinyinDisplay) {
            const icon = isCorrect 
                ? '<i class="bi bi-check-circle-fill text-success me-2" style="font-size: 1.2em;"></i>' 
                : '<i class="bi bi-x-circle-fill text-danger me-2" style="font-size: 1.2em;"></i>';
            // 使用主题颜色，支持深色模式，加粗，拼音和中文粗细保持一致
            const color = isCorrect ? 'text-success' : 'text-danger';
            const defaultStyle = 'color: var(--bs-body-color); font-weight: 600;';
            
            // 优先使用原始拼音提示文本，而不是替换后的文本
            // 只在错误时显示正确答案，但保持拼音提示格式
            let displayText = this._currentDisplayText || word.pinyin || word.word;
            const correctWord = word.word;
            let wordPinyin = word.pinyin || '';
            if (!wordPinyin && typeof WordGroups !== 'undefined' && WordGroups._generatePinyin) {
                wordPinyin = WordGroups._generatePinyin(correctWord);
            }
            
            let replacements = 0;
            // 正确答案用绿色加粗，错误答案用红色加粗，但默认显示用黑色加粗
            const wrapText = () => `<span class="${color} fw-bold">${correctWord}</span>`;
            
            // 调试信息
            console.log('[Practice.showFeedback] 调试信息:', {
                isCorrect,
                correctWord,
                wordPinyin,
                displayText: displayText.substring(0, 50),
                currentDisplayText: this._currentDisplayText?.substring(0, 50)
            });
            
            if (wordPinyin && wordPinyin.trim()) {
                const escaped = wordPinyin.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 不使用单词边界\b，因为中文字符后可能跟着拼音，拼音后可能跟着中文字符
                // 改用更灵活的匹配：拼音前后不能是字母数字（避免匹配到其他拼音的一部分）
                const regex = new RegExp(`(?<=[^a-zA-Z0-9]|^)${escaped}(?=[^a-zA-Z0-9]|$)`, 'gi');
                const beforeReplace = displayText;
                displayText = displayText.replace(regex, () => {
                    replacements++;
                    return wrapText();
                });
                if (beforeReplace !== displayText) {
                    console.log('[Practice.showFeedback] 通过拼音匹配替换成功');
        } else {
                    // 如果单词边界匹配失败，尝试不使用边界限制（更宽松的匹配）
                    const regex2 = new RegExp(escaped, 'gi');
                    const beforeReplace2 = displayText;
                    displayText = displayText.replace(regex2, () => {
                        replacements++;
                        return wrapText();
                    });
                    if (beforeReplace2 !== displayText) {
                        console.log('[Practice.showFeedback] 通过拼音匹配替换成功（宽松模式）');
                    }
                }
            }
            
            if (replacements === 0) {
                const escapedWord = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordRegex = new RegExp(escapedWord, 'g');
                const beforeReplace = displayText;
                displayText = displayText.replace(wordRegex, () => {
                    replacements++;
                    return wrapText();
                });
                if (beforeReplace !== displayText) {
                    console.log('[Practice.showFeedback] 通过汉字匹配替换成功');
                }
            }
            
            // 如果仍然没有替换（找不到拼音或汉字），保留原始提示文本，并在其中替换目标字
            // 标准写法：正确答案应该写在提示中，保留原有的词组提示格式
            if (replacements === 0) {
                // 在原始提示文本中查找并替换目标字（保留词组格式）
                const originalText = this._currentDisplayText || word.pinyin || word.word;
                const escapedWord = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordRegex = new RegExp(escapedWord, 'g');
                
                console.log('[Practice.showFeedback] 没有找到匹配，使用原始文本:', {
                    originalText: originalText?.substring(0, 50),
                    correctWord,
                    includes: originalText?.includes(correctWord)
                });
                
                // 如果原始文本包含目标字，替换它（保留词组格式）
                if (originalText && originalText.includes(correctWord)) {
                    displayText = originalText.replace(wordRegex, wrapText());
                    console.log('[Practice.showFeedback] 在原始文本中替换目标字');
                } else {
                    // 如果原始文本不包含目标字（可能是纯拼音词组），保留原始格式并添加正确答案
                    // 例如："xī方, xī边, 东xī" 应该显示为 "xī方, xī边, 东xī 西"（西字为红色加粗）
                    // 或者 "rì出, rì落, rì记" 应该显示为 "rì出, rì落, rì记 日"（日字为红色加粗）
                    // 或者 "tā们, tā的, tā人" 应该显示为 "tā们, tā的, tā人 他"（他字为红色加粗）
                    // 确保添加正确答案，即使原始文本是纯拼音
                    displayText = (originalText || '') + ' ' + wrapText();
                    console.log('[Practice.showFeedback] 添加正确答案到原始文本后');
                }
            }
            
            // 如果是错误反馈，保持原始拼音提示格式，只在末尾添加正确答案
            if (!isCorrect) {
                // 使用原始拼音提示文本，不进行替换
                const originalText = this._currentDisplayText || word.pinyin || word.word;
                const correctWord = word.word;
                // 如果原始文本不包含正确答案，则在末尾添加（用红色加粗显示）
                if (!originalText.includes(correctWord)) {
                    displayText = originalText + ' <span class="text-danger fw-bold">' + correctWord + '</span>';
                }
                // 如果包含，保持替换后的版本（拼音被替换为红色加粗的汉字）
            }
            
            // 确保整个显示文本使用黑色加粗样式（拼音和中文保持一致）
            // 注意：displayText已经包含了HTML（wrapText返回的是HTML），所以直接使用innerHTML
            console.log('[Practice.showFeedback] 最终displayText:', displayText.substring(0, 100));
            pinyinDisplay.innerHTML = icon + `<span style="${defaultStyle}">${displayText}</span>`;
        }
        
        // 错误时在田字格中显示正确答案（楷体红色）
        if (!isCorrect && typeof Handwriting !== 'undefined' && Handwriting.drawCorrectWord) {
                Handwriting.drawCorrectWord(word.word);
            }
    },
    
    /**
     * 立即退出重做模式并恢复新题状态
     * 当用户开始重新书写时调用
     * 注意：不清除 _isRetryingError 标志，因为需要保持错题状态
     */
    exitRetryModeImmediately() {
        if (!this._isRetryingError) {
            return; // 不在重做模式，无需处理
        }
        
        // 如果已经清空过画布，不再重复清空（防止清空用户正在写的笔迹）
        if (this._hasClearedCanvasInRetry) {
            return;
        }
        
        // 清除定时器
        this.clearRetryTimer();
        
        // 清空画布（清除正确答案显示）
        if (typeof Handwriting !== 'undefined' && Handwriting.clear) {
            Handwriting.clear();
        }
        this._hasClearedCanvasInRetry = true; // 标记已清空
        
        // 恢复拼音显示（去掉反馈符号和中文，还原为原始拼音）
        const pinyinDisplay = document.getElementById('pinyin-display');
        if (pinyinDisplay && this._currentDisplayText) {
            // 使用透明占位符保持布局稳定，显示原始拼音文本
            pinyinDisplay.innerHTML = '<span style="opacity: 0; font-size: 1.2em; margin-right: 0.5rem;">✓</span><span style="color: var(--bs-body-color); font-weight: 600;">' + this._currentDisplayText + '</span>';
        }
        
        // 重置提交状态，允许用户重新提交
        this.isSubmitting = false;
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        
        // 清空反馈区域（不显示提示信息）
        const feedbackArea = document.getElementById('feedback-area');
        if (feedbackArea) {
            feedbackArea.innerHTML = '';
        }
        
        // 注意：不清除 _isRetryingError 标志
        // 这样即使用户开始重新书写，在提交答案时仍然知道这是重做模式
        // 从而保持错题状态，不会因为重新写对就判为已掌握
    },
    
    /**
     * 进入错题重做模式
     * 显示正确答案，8秒后清空画布，等待用户重新提交
     */
    enterRetryMode(word) {
        // 设置重做状态
        this._isRetryingError = true;
        this._hasClearedCanvasInRetry = false; // 重置清空标志
        
        // 清除之前的定时器
        this.clearRetryTimer();
        
        // 8秒后清空画布并恢复拼音显示
        this._retryClearTimer = setTimeout(() => {
            // 清空画布（会清除正确答案显示）
            if (typeof Handwriting !== 'undefined' && Handwriting.clear) {
                Handwriting.clear();
            }
            
            // 恢复拼音显示（去掉反馈符号和中文，还原为原始拼音）
            const pinyinDisplay = document.getElementById('pinyin-display');
            if (pinyinDisplay && this._currentDisplayText) {
                // 使用透明占位符保持布局稳定，显示原始拼音文本
                pinyinDisplay.innerHTML = '<span style="opacity: 0; font-size: 1.2em; margin-right: 0.5rem;">✓</span><span style="color: var(--bs-body-color); font-weight: 600;">' + this._currentDisplayText + '</span>';
            }
            
            // 重置提交状态，允许用户重新提交
            this.isSubmitting = false;
            this.lastSubmitTime = 0;
            this.lastSubmitWordId = null;
            
            // 清空反馈区域（不显示提示信息）
            const feedbackArea = document.getElementById('feedback-area');
            if (feedbackArea) {
                feedbackArea.innerHTML = '';
            }
            
            this._retryClearTimer = null;
        }, 8000);
    },
    
    /**
     * 记录错题
     */
    async recordError(word, snapshot, roundId = null) {
        this.practiceLog.errorWords.push(word.id);
        
        // 保存到错题本（无论是否有快照，都记录错题）
        if (typeof Storage !== 'undefined' && Storage.addErrorWord) {
            const errorWord = Storage.addErrorWord(word.id, word.word, word.pinyin || '', snapshot || null, roundId);
            
            // 为错题创建复习计划
            if (errorWord && typeof ReviewPlan !== 'undefined' && ReviewPlan.createPlanForErrorWord) {
                ReviewPlan.createPlanForErrorWord(errorWord);
            }
        }
    },
    
    /**
     * 跳过题目
     */
    async skipQuestion() {
        // 检查是否允许跳过
        if (!this.allowSkip) {
            // 检查当前题目是否已答对
            const currentWordId = this.currentWords[this.currentIndex]?.id;
            const currentDetail = this.practiceLog.details?.find(d => d.wordId === currentWordId);
            if (!currentDetail || !currentDetail.correct) {
                alert('当前题目尚未答对，无法跳过。请答对后再继续。');
                return;
            }
        }
        
        if (confirm('确定要跳过这道题吗？（将记录为错题）')) {
            this.clearPendingNextWordTimer();
            this.lastSubmitTime = 0;
            this.lastSubmitWordId = null;
            this.consecutiveBlockCount = 0;
            this.isSubmitting = false;
            const word = this.currentWords[this.currentIndex];
            await this.recordError(word, null);
            this.practiceLog.errorCount++;
            const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
            this._currentWordStartTime = null;
            
            // 更新任务进度（如果有任务）
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
            
            // 保存当前题目到历史
            if (this.currentIndex < this.currentWords.length) {
                this.history.push({
                    word: word,
                    index: this.currentIndex,
                    snapshot: null
                });
            }
            
            this.currentIndex++;
            this.showNextWord();
            
            // 持续草稿保存
            this.saveAutosaveDraft();
        }
    },
    
    /**
     * 结束练习
     */
    finish(options = {}) {
        if (!this.practiceLog) return;
        const { partial = false } = options;
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.clearPendingNextWordTimer();
        this.isActive = false;
        this.isSubmitting = false;
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this._currentWordStartTime = null;
        let isDebug = false; try { isDebug = localStorage.getItem('debugMode') === '1'; } catch(e) {}
        
        const logPayload = this._buildPracticeLogPayload({ partial, isDebug });
        let log = null;
        try {
            log = Storage.addPracticeLog(logPayload);
            
            // 保存错题到按轮视图（使用log.id作为roundId）
            if (log && log.id && this.practiceLog.details) {
                const errorDetails = this.practiceLog.details.filter(d => !d.correct);
                if (errorDetails.length > 0 && typeof Storage !== 'undefined' && Storage.saveErrorWordsForRound) {
                    const errorWords = errorDetails.map(d => {
                        const word = this.currentWords.find(w => w.id === d.wordId);
                        return {
                            wordId: d.wordId,
                            word: word ? word.word : '',
                            pinyin: word ? (word.pinyin || '') : '',
                            snapshot: d.snapshot || null
                        };
                    });
                    Storage.saveErrorWordsForRound(log.id, errorWords);
                }
            }
        } catch (error) {
            console.error('保存练习记录失败:', error);
            alert('保存练习记录失败，请稍后再试。');
            this.resetToSettings();
            return;
        }
        
        // 如果有任务ID，更新任务进度
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false); // false表示完成
        }
        
        // 跳转到结果页面
        if (log && typeof Main !== 'undefined') {
            Main.showResults(log.id);
        }
        
        // 清除草稿
        if (typeof Storage !== 'undefined' && Storage.clearPracticeAutosave) {
            Storage.clearPracticeAutosave();
        }
        
        // 练习完成后，创建复习任务（基于第一次练习的错题）
        // 只有在非任务模式下，且本次练习有错题时才创建
        if (!this.currentTaskId && log && log.errorWords && log.errorWords.length > 0) {
            // 检查是否存在该练习对应的复习任务（通过originalPracticeLogId关联）
            if (typeof TaskList !== 'undefined' && TaskList.createReviewTaskFromPractice) {
                console.log('[Practice.finish] 创建复习任务，基于练习记录:', log.id, '错题数:', log.errorWords.length);
                TaskList.createReviewTaskFromPractice(log.id, log.errorWords);
            } else {
                console.warn('[Practice.finish] TaskList.createReviewTaskFromPractice 不可用');
            }
        }
        
        // 清除任务ID
        this.currentTaskId = null;
        
        // 练习完成后，触发自动同步
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.syncAfterPractice) {
            // 延迟一点执行，确保所有数据都已保存
            setTimeout(() => {
                SupabaseSync.syncAfterPractice();
            }, 500);
        }
    },
    
    _buildPracticeLogPayload({ partial, isDebug }) {
        const details = (this.practiceLog.details || []).map(item => ({ ...item }));
        const wordTimes = (this.practiceLog.wordTimes || []).slice();
        let totalWords = this.practiceLog.totalWords || 0;
        let correctCount = this.practiceLog.correctCount || 0;
        let errorCount = this.practiceLog.errorCount || 0;
        let totalTime = this.practiceLog.totalTime || 0;
        let errorWords = Array.isArray(this.practiceLog.errorWords) ? [...this.practiceLog.errorWords] : [];
        
        if (partial) {
            const answeredCount = details.length;
            totalWords = answeredCount;
            errorCount = details.filter(d => d.correct === false).length;
            correctCount = answeredCount - errorCount;
            totalTime = wordTimes.reduce((sum, t) => sum + (t || 0), 0);
            errorWords = details.filter(d => d.correct === false).map(d => d.wordId);
        }
        
        const averageTime = totalWords > 0 ? totalTime / totalWords : 0;
        return {
            totalWords,
            correctCount,
            errorCount,
            totalTime,
            averageTime,
            errorWords: [...new Set(errorWords)],
            details,
            wordTimes,
            status: 'completed',
            wasPartial: partial,
            isDebug
        };
    },
    
    resetToSettings() {
        const settingsEl = document.getElementById('practice-settings');
        const practiceAreaEl = document.getElementById('practice-area');
        if (settingsEl) settingsEl.classList.remove('d-none');
        if (practiceAreaEl) practiceAreaEl.classList.add('d-none');
    },
    
    /**
     * 结束练习（手动）
     */
    end() {
        if (confirm('确定要结束练习吗？')) {
            // 如果有任务ID，先更新任务进度（中断状态）
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(true); // true表示中断
            }
            this.finish({ partial: true });
        }
    },
    
    /**
     * 返回上一题
     */
    async showPreviousWord() {
        if (this.history.length === 0) {
            alert('已经是第一题了');
            return;
        }
        
        // 停止当前计时器
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 从历史中取出上一题
        const prevItem = this.history.pop();
        this.currentIndex = prevItem.index;
        
        // 显示上一题
        const word = prevItem.word;
        
        // 显示拼音和词组
        const pinyinDisplay = document.getElementById('pinyin-display');
        if (pinyinDisplay) {
            let displayText = word.pinyin || '';
            if (typeof WordGroups !== 'undefined') {
                // 确保词组数据已加载
                if (!WordGroups._loaded && WordGroups.load) {
                    try {
                        await WordGroups.load();
                    } catch (e) {
                        console.warn('显示上一题时加载词组数据失败:', e);
                    }
                }
                const groupsText = WordGroups.getDisplayText(word.word, word.pinyin || '');
                // 如果返回了有效文本，使用它；否则使用拼音或字本身
                if (groupsText && groupsText.trim()) {
                    displayText = groupsText;
                } else {
                    displayText = word.pinyin || word.word || '';
                }
            } else {
                displayText = word.pinyin || word.word || '';
            }
            
            // 确保displayText不为空
            if (!displayText || !displayText.trim()) {
                displayText = word.word || '';
            }
            
            pinyinDisplay.textContent = displayText;
        }
        
        // 更新进度
        document.getElementById('progress-badge').textContent = 
            `${this.currentIndex + 1}/${this.currentWords.length}`;
        
        // 更新答题数可视化
        this.updateProgressVisual();
        
        // 清除画布
        Handwriting.clear();
        
        // 在反馈区显示正确答案，帮助回看怎么写
        const feedbackArea = document.getElementById('feedback-area');
        if (feedbackArea) {
            feedbackArea.innerHTML = `
                <div class="feedback-error">
                    <i class="bi bi-arrow-90deg-left"></i> 返回上一题
                </div>
                <div class="mt-3 p-3 bg-light rounded border border-primary">
                    <div class="text-center">
                        <div class="text-muted small mb-2">正确答案是：</div>
                        <div class="display-4 fw-bold text-primary">${word.word}</div>
                    </div>
                </div>
            `;
        }
        
        // 可选：如果有快照，后续可在这里增加对比视图（当前不自动展示以免干扰）
        
        // 重新开始计时
        const wordStartTime = Date.now();
        this.startTimer(wordStartTime);
    },
    
    /**
     * 跳转到下一题（手动）
     */
    async showNextQuestion() {
        if (!this.isActive) {
            console.warn('[Practice] 练习未激活，无法跳转下一题');
            return;
        }
        
        // 检查是否允许跳过
        if (!this.allowSkip) {
            // 检查当前题目是否已答对
            const currentWordId = this.currentWords[this.currentIndex]?.id;
            const currentDetail = this.practiceLog.details?.find(d => d.wordId === currentWordId);
            if (!currentDetail || !currentDetail.correct) {
                alert('当前题目尚未答对，无法跳过。请答对后再继续。');
            return;
            }
        }
        
        // 在「可以跳过」模式下，点击「下一题」等同于「不会」：直接按错题处理并自动跳到下一题
        if (this.allowSkip) {
            console.log('[Practice.showNextQuestion] 在可跳过模式下，点击下一题等同于不会，直接调用 skipAnswer');
            // 确保不会因为之前的标记导致锁死
            this.isProcessingNextQuestion = false;
            this.skipAnswer();
            return;
        }
        
        // 不可跳过模式下才需要防抖处理，避免重复调用
        if (this.isProcessingNextQuestion) {
            console.log('[Practice.showNextQuestion] 正在处理中，忽略重复调用');
            return;
        }
        this.isProcessingNextQuestion = true;
        
        // 检查画布是否有内容
        const hasContent = this.mode === 'normal' && typeof Handwriting !== 'undefined' && Handwriting.hasContent && Handwriting.hasContent();
        
        // 添加详细的调试信息
        const debugInfo = {
            timestamp: new Date().toISOString(),
            action: '点击下一题',
            hasContent: hasContent,
            mode: this.mode,
            currentIndex: this.currentIndex,
            totalWords: this.currentWords.length,
            isLastQuestion: this.currentIndex >= this.currentWords.length - 1
        };
        
        console.log('[Practice.showNextQuestion] 🔍 调试信息:', JSON.stringify(debugInfo, null, 2));
        
        if (hasContent) {
            // 画布有内容，提交识别
            console.log('[Practice.showNextQuestion] ✅ 画布有内容，将调用识别API');
            this.updateDebugInfo('✅ 画布有内容，正在调用识别API...');
            this.submitAnswer({ bypassCooldown: true });
            return;
        } else {
            // 画布没有内容
            console.log('[Practice.showNextQuestion] ⏭️ 画布为空，记录为错题并进入重做模式');
            this.updateDebugInfo('⏭️ 画布为空，记录为错题并进入重做模式');
            
            const word = this.currentWords[this.currentIndex];
            await this.handleEmptySubmission(word);
            this.isProcessingNextQuestion = false; // 重置处理状态
            return;
        }
    },
    
    /**
     * 更新跳过设置UI
     */
    updateSkipSettingUI() {
        const skipSettingBtn = document.getElementById('skip-setting-btn');
        if (!skipSettingBtn) return;
        
        const skipOptions = document.querySelectorAll('.skip-option');
        skipOptions.forEach(option => {
            const isSelected = (option.getAttribute('data-value') === 'true') === this.allowSkip;
            if (isSelected) {
                option.classList.add('active');
                // 更新按钮图标和文本
                if (this.allowSkip) {
                    skipSettingBtn.innerHTML = '<i class="bi bi-skip-forward"></i>';
                    skipSettingBtn.title = '跳过设置：可以跳过';
                } else {
                    skipSettingBtn.innerHTML = '<i class="bi bi-skip-forward-fill text-danger"></i>';
                    skipSettingBtn.title = '跳过设置：不可以跳过';
                }
            } else {
                option.classList.remove('active');
            }
        });
    },
    
    /**
     * 数组随机打乱
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    prepareForcedWords(count, options = {}) {
        if (!count || count <= 0) return;
        const { persist = true } = options;
        this.forcedWordCount = count;
        if (persist) {
            try {
                localStorage.setItem('practice_force_word_count', String(count));
            } catch (e) {}
        }
        this.updateForcedWordUI(true, count);
    },

    clearForcedWords(options = {}) {
        const { removeStorage = true } = options;
        this.forcedWordCount = null;
        if (removeStorage) {
            try {
                localStorage.removeItem('practice_force_word_count');
                localStorage.removeItem('practice_force_time_limit');
                localStorage.removeItem('practice_force_mode');
            } catch (e) {}
        }
        this.updateForcedWordUI(false);
    },

    syncForcedWordStateFromStorage() {
        let applied = false;
        try {
            const value = localStorage.getItem('practice_force_word_count');
            if (value) {
                const count = parseInt(value, 10);
                if (!isNaN(count) && count > 0) {
                    this.prepareForcedWords(count, { persist: false });
                    applied = true;
                }
            }
        } catch (e) {}
        const storedTime = parseInt(localStorage.getItem('practice_force_time_limit') || '', 10);
        if (!isNaN(storedTime) && storedTime > 0) {
            const timeInput = document.getElementById('time-limit-input');
            if (timeInput) timeInput.value = storedTime;
        }
        const storedMode = localStorage.getItem('practice_force_mode');
        if (storedMode) {
            const modeSelect = document.getElementById('practice-mode-select-home');
            if (modeSelect) modeSelect.value = storedMode;
        }
        if (!applied) {
            this.updateForcedWordUI(false);
        }
    },

    updateForcedWordUI(enabled, count = 0) {
        const input = document.getElementById('word-count-input');
        const select = document.getElementById('word-count-select-home');
        const hint = document.getElementById('practice-forced-hint');
        if (!input || !select) return;
        if (enabled) {
            input.value = count;
            input.disabled = true;
            select.value = 'all';
            select.disabled = true;
            if (hint) {
                hint.classList.remove('d-none');
                hint.textContent = `本次将练习所选错题 ${count} 个，题目数量已锁定。`;
            }
        } else {
            input.disabled = false;
            select.disabled = false;
            if (hint) {
                hint.classList.add('d-none');
            }
        }
    },

    loadSettings() {
        if (typeof Storage === 'undefined') return;
        const settings = Storage.getSettings() || {};
        const p = settings.practice || {};
        const countSelect = document.getElementById('word-count-select-home');
        const countInput = document.getElementById('word-count-input');
        const timeInput = document.getElementById('time-limit-input');
        const modeHome = document.getElementById('practice-mode-select-home');
        if (p.wordCount !== undefined) {
            if (countSelect) countSelect.value = (p.wordCount === 'all' ? 'all' : String(p.wordCount || '20'));
            if (countInput) countInput.value = (p.wordCount && p.wordCount !== 'all') ? String(p.wordCount) : '';
        }
        if (p.timeLimit !== undefined && timeInput) timeInput.value = p.timeLimit;
        if (p.mode && modeHome) modeHome.value = p.mode;
    },

    /**
     * 诊断函数 - 生成详细的诊断报告
     */
    diagnose() {
        // 获取北京时区时间（UTC+8）
        const now = new Date();
        const beijingTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' }));
        // 格式化为 YYYY-MM-DD HH:mm:ss (北京时间)
        const year = beijingTime.getFullYear();
        const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
        const day = String(beijingTime.getDate()).padStart(2, '0');
        const hours = String(beijingTime.getHours()).padStart(2, '0');
        const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
        const seconds = String(beijingTime.getSeconds()).padStart(2, '0');
        const timestamp = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} (北京时间)`;
        
        const report = {
            timestamp: timestamp,
            browser: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
                isIPad: /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
                touchSupported: 'ontouchstart' in window || navigator.maxTouchPoints > 0
            },
            buttons: {},
            eventListeners: {},
            practiceState: {
                isActive: this.isActive,
                isPaused: this.isPaused,
                currentIndex: this.currentIndex,
                totalWords: this.currentWords.length,
                mode: this.mode,
                isSubmitting: this.isSubmitting
            },
            handwriting: {
                canvasExists: !!document.getElementById('handwriting-canvas'),
                hasContent: typeof Handwriting !== 'undefined' && Handwriting.hasContent ? Handwriting.hasContent() : false
            },
            debugEvents: this.debugEvents || []
        };

        // 检查按钮状态
        const buttonIds = ['next-question-btn', 'prev-question-btn', 'submit-answer-btn', 'skip-answer-btn'];
        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                const rect = btn.getBoundingClientRect();
                report.buttons[id] = {
                    exists: true,
                    disabled: btn.disabled,
                    visible: rect.width > 0 && rect.height > 0,
                    zIndex: window.getComputedStyle(btn).zIndex,
                    position: window.getComputedStyle(btn).position,
                    display: window.getComputedStyle(btn).display,
                    pointerEvents: window.getComputedStyle(btn).pointerEvents,
                    touchAction: window.getComputedStyle(btn).touchAction
                };

                // 检查事件监听器
                const listeners = getEventListeners ? getEventListeners(btn) : null;
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const elementAtPoint = document.elementFromPoint(centerX, centerY);
                
                report.eventListeners[id] = {
                    hasOnClick: !!btn.onclick,
                    hasTouchStart: 'ontouchstart' in btn || listeners?.touchstart?.length > 0,
                    hasTouchEnd: 'ontouchend' in btn || listeners?.touchend?.length > 0,
                    elementFromPoint: elementAtPoint ? {
                        isButton: elementAtPoint === btn || elementAtPoint.closest(`#${id}`),
                        elementTag: elementAtPoint.tagName,
                        elementId: elementAtPoint.id || null
                    } : null
                };
            } else {
                report.buttons[id] = { exists: false };
                report.eventListeners[id] = { exists: false };
            }
        });

        return report;
    }
};

// 绑定按钮事件
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-practice-btn');
    const submitBtn = document.getElementById('submit-answer-btn');
    const skipAnswerBtn = document.getElementById('skip-answer-btn');
    const clearBtn = document.getElementById('clear-canvas-btn');
    const skipBtn = document.getElementById('skip-question-btn');
    const endBtn = document.getElementById('end-practice-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => Practice.start());
    }
    
    if (submitBtn) {
        // 保存原始HTML
        if (!submitBtn._originalHtml) {
            submitBtn._originalHtml = submitBtn.innerHTML;
        }
        const handleSubmit = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[Practice] 提交按钮被点击，事件类型:', e.type, '时间戳:', Date.now());
            Practice.submitAnswer();
            return false;
        };
        submitBtn.addEventListener('click', handleSubmit, { passive: false, capture: true });
        submitBtn.addEventListener('touchstart', handleSubmit, { passive: false, capture: true });
        submitBtn.addEventListener('touchend', handleSubmit, { passive: false, capture: true });
        submitBtn.onclick = handleSubmit;
        submitBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSubmit(e);
        }, { passive: false, capture: true });
        console.log('[Practice] ✅ 提交按钮已绑定 (click, touchstart, touchend, mousedown, onclick, capture模式)');
    }
    
    if (skipAnswerBtn) {
        const handleSkip = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[Practice] 不会按钮被点击，事件类型:', e.type, '时间戳:', Date.now());
            Practice.skipAnswer();
            return false;
        };
        skipAnswerBtn.addEventListener('click', handleSkip, { passive: false, capture: true });
        skipAnswerBtn.addEventListener('touchstart', handleSkip, { passive: false, capture: true });
        skipAnswerBtn.addEventListener('touchend', handleSkip, { passive: false, capture: true });
        skipAnswerBtn.onclick = handleSkip;
        skipAnswerBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSkip(e);
        }, { passive: false, capture: true });
        console.log('[Practice] ✅ 不会按钮已绑定 (click, touchstart, touchend, mousedown, onclick, capture模式)');
    }
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => Handwriting.clear());
    }
    
    if (skipBtn) {
        skipBtn.addEventListener('click', () => Practice.skipQuestion());
    }
    
    if (endBtn) {
        endBtn.addEventListener('click', () => Practice.end());
    }
    const timerPauseBtn = document.getElementById('timer-pause-btn');
    if (timerPauseBtn) {
        timerPauseBtn.addEventListener('click', () => {
            if (Practice.isPaused) Practice.resume(); else Practice.pause();
        });
    }
    
    const prevBtn = document.getElementById('prev-question-btn');
    if (prevBtn) {
        const handlePrev = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[Practice] 上一题按钮被点击，事件类型:', e.type, '时间戳:', Date.now());
            Practice.showPreviousWord();
            return false;
        };
        prevBtn.addEventListener('click', handlePrev, { passive: false, capture: true });
        prevBtn.addEventListener('touchstart', handlePrev, { passive: false, capture: true });
        prevBtn.addEventListener('touchend', handlePrev, { passive: false, capture: true });
        prevBtn.onclick = handlePrev;
        prevBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handlePrev(e);
        }, { passive: false, capture: true });
        console.log('[Practice] ✅ 上一题按钮已绑定 (click, touchstart, touchend, mousedown, onclick, capture模式)');
    }
    
    const nextBtn = document.getElementById('next-question-btn');
    if (nextBtn) {
        const handleNext = (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('[Practice] 下一题按钮被点击，事件类型:', e.type, '时间戳:', Date.now());
            if (!Practice.isActive) {
                console.warn('[Practice] 练习未激活，无法跳转下一题');
                return false;
            }
            // 防止重复调用：如果正在处理中，直接返回
            if (Practice.isProcessingNextQuestion) {
                console.log('[Practice] 正在处理下一题，忽略重复点击');
                return false;
            }
            Practice.showNextQuestion();
            return false;
        };
        nextBtn.addEventListener('click', handleNext, { passive: false, capture: true });
        nextBtn.addEventListener('touchstart', handleNext, { passive: false, capture: true });
        nextBtn.addEventListener('touchend', handleNext, { passive: false, capture: true });
        nextBtn.onclick = handleNext;
        nextBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            handleNext(e);
        }, { passive: false, capture: true });
        console.log('[Practice] ✅ 下一题按钮已绑定 (click, touchstart, touchend, mousedown, onclick, capture模式)');
    }
    
    // 跳过设置下拉菜单
    const skipSettingBtn = document.getElementById('skip-setting-btn');
    if (skipSettingBtn) {
        // 绑定下拉菜单选项点击事件
        const skipOptions = document.querySelectorAll('.skip-option');
        skipOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const allowSkip = option.getAttribute('data-value') === 'true';
                Practice.allowSkip = allowSkip;
                localStorage.setItem('practice_allow_skip', allowSkip ? 'true' : 'false');
                Practice.updateSkipSettingUI();
                // 关闭下拉菜单
                const dropdown = skipSettingBtn.closest('.dropdown');
                if (dropdown) {
                    const bsDropdown = bootstrap.Dropdown.getInstance(skipSettingBtn);
                    if (bsDropdown) {
                        bsDropdown.hide();
                    }
                }
                return false;
            });
        });
    }
    
    // 调试模式：一键做题按钮
    const debugAutoAnswerBtn = document.getElementById('debug-auto-answer-btn');
    if (debugAutoAnswerBtn) {
        const handleDebugAutoAnswer = async () => {
            if (!Practice.isActive) {
                console.warn('[Practice] 练习未激活，无法一键做题');
                return;
            }
            
            const remaining = Practice.currentWords.length - Practice.currentIndex;
            if (remaining <= 1) {
                alert('只剩1题或更少，无需一键做题');
                return;
            }
            
            const confirmMsg = `当前剩余 ${remaining} 题，一键做题将自动完成 ${remaining - 1} 题，留1题。\n\n确定要继续吗？`;
            if (!confirm(confirmMsg)) {
                return;
            }
            
            console.log('[Practice] 开始一键做题，剩余题目:', remaining, '将完成:', remaining - 1);
            
            // 禁用按钮，防止重复点击
            debugAutoAnswerBtn.disabled = true;
            debugAutoAnswerBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 处理中...';
            
            try {
                // 自动完成 N-1 道题
                const targetIndex = Practice.currentWords.length - 1; // 最后一题的索引
                let completed = 0;
                
                while (Practice.currentIndex < targetIndex && Practice.isActive) {
                    const word = Practice.currentWords[Practice.currentIndex];
                    const wordTime = Practice._currentWordStartTime ? (Date.now() - Practice._currentWordStartTime) / 1000 : 0;
                    
                    // 停止计时
                    if (Practice.timer) {
                        clearInterval(Practice.timer);
                        Practice.timer = null;
                    }
                    
                    // 检查是否已存在该题目的记录
                    const existingIdx = Practice.practiceLog.details.findIndex(d => d.wordId === word.id);
                    if (existingIdx >= 0) {
                        const oldDetail = Practice.practiceLog.details[existingIdx];
                        if (oldDetail.correct) {
                            Practice.practiceLog.correctCount = Math.max(0, Practice.practiceLog.correctCount - 1);
                        } else {
                            Practice.practiceLog.errorCount = Math.max(0, Practice.practiceLog.errorCount - 1);
                        }
                        Practice.practiceLog.details.splice(existingIdx, 1);
                    }
                    
                    // 随机决定对错（50%概率正确）
                    const isCorrect = Math.random() > 0.5;
                    
                    if (isCorrect) {
                        Practice.practiceLog.correctCount++;
                        // 同步到题库管理的掌握状态：记录为已掌握
                        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                            Storage.setWordMasteryStatus(word.id, 'mastered');
                        }
                    } else {
                        Practice.practiceLog.errorCount++;
                        // 记录错题到错题本
                        await Practice.recordError(word, null);
                        // 同步到题库管理的掌握状态：记录为错题
                        if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                            Storage.setWordMasteryStatus(word.id, 'error');
                        }
                    }
                    
                    Practice.practiceLog.wordTimes.push(wordTime);
                    Practice.practiceLog.totalTime += wordTime;
                    
                    Practice.practiceLog.details.push({
                        wordId: word.id,
                        correct: isCorrect,
                        snapshot: null,
                        displayText: Practice._currentDisplayText
                    });
                    
                    // 保存当前题目到历史（限制长度防止内存泄漏）
                    if (Practice.currentIndex < Practice.currentWords.length) {
                        Practice.history.push({
                            word: word,
                            index: Practice.currentIndex,
                            snapshot: null
                        });
                        // 限制历史记录最大长度为100，防止内存泄漏
                        if (Practice.history.length > 100) {
                            Practice.history = Practice.history.slice(-100);
                        }
                    }
                    
                    Practice.currentIndex++;
                    Practice._currentWordStartTime = null;
                    completed++;
                    
                    // 更新进度可视化
                    if (Practice.updateProgressVisual) {
                        Practice.updateProgressVisual();
                    }
                    
                    // 更新任务进度（如果有任务）
                    if (Practice.currentTaskId && typeof TaskList !== 'undefined') {
                        Practice.updateTaskProgress(false);
                    }
                    
                    // 短暂延迟，避免UI卡顿
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
                
                console.log('[Practice] 一键做题完成，共完成:', completed, '题');
                
                // 显示下一题（最后一题）
                if (Practice.currentIndex < Practice.currentWords.length) {
                    Practice.showNextWord();
                }
                
            } catch (e) {
                console.error('[Practice] 一键做题出错:', e);
                alert('一键做题出错：' + e.message);
            } finally {
                // 恢复按钮
                debugAutoAnswerBtn.disabled = false;
                debugAutoAnswerBtn.innerHTML = '<i class="bi bi-lightning-fill"></i> 一键做题';
            }
        };
        
        debugAutoAnswerBtn.addEventListener('click', handleDebugAutoAnswer);
        console.log('[Practice] ✅ 调试模式一键做题按钮已绑定');
        
        // 根据调试模式显示/隐藏按钮
        const updateDebugButtonVisibility = () => {
            try {
                const isDebug = localStorage.getItem('debugMode') === '1';
                if (isDebug) {
                    debugAutoAnswerBtn.classList.remove('d-none');
                } else {
                    debugAutoAnswerBtn.classList.add('d-none');
                }
            } catch (e) {
                console.error('[Practice] 更新调试按钮可见性失败:', e);
            }
        };
        
        // 初始检查
        updateDebugButtonVisibility();
        
        // 监听调试模式变化
        window.addEventListener('storage', (e) => {
            if (e.key === 'debugMode') {
                updateDebugButtonVisibility();
            }
        });
        
        // 定期检查（防止storage事件不触发）
        setInterval(updateDebugButtonVisibility, 1000);
    }
    
    const undoBtn = document.getElementById('undo-stroke-btn');
    if (undoBtn) {
        undoBtn.addEventListener('click', () => {
            if (typeof Handwriting !== 'undefined' && Handwriting.undo) {
                Handwriting.undo();
            }
        });
    }

    // 加载上次练习设置
    if (Practice.loadSettings) {
        Practice.loadSettings();
    }
});
