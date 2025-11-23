/**
 * 练习模块
 * 管理练习流程
 */

const Practice = {
    currentWords: [],
    currentIndex: 0,
    // 记录之前的题目历史（用于返回上一题）
    history: [],
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
        await this.recordError(word, null);
        this.practiceLog.errorCount++;
        this.practiceLog.wordTimes.push(wordTime);
        this.practiceLog.totalTime += wordTime;
        this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
        this.showFeedback(false, word, '');
        if (typeof Handwriting !== 'undefined' && Handwriting.clear) {
            Handwriting.clear();
        }
        this.saveAutosaveDraft();
        
        // 更新任务进度（如果有任务，在答题后立即更新）
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false);
        }
        
        this.scheduleNextWord(2000, () => {
            if (this.currentIndex < this.currentWords.length) {
                this.history.push({
                    word: word,
                    index: this.currentIndex,
                    snapshot: null
                });
            }
            this.currentIndex++;
            this.showNextWord();
        });
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
    consecutiveBlockCount: 0, // 连续被拦截的次数，用于容错机制
    _nextWordTimer: null,
    clearPendingNextWordTimer() {
        if (this._nextWordTimer) {
            clearTimeout(this._nextWordTimer);
            this._nextWordTimer = null;
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
        const timeLimit = parseInt(document.getElementById('time-limit-input').value);
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
                words = wordBank.filter(w => task.wordIds.includes(w.id));
                
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
        // 注意：任务模式下不应该应用wordCount限制，应该使用所有题目
        if (!currentTaskId && !forcedMode && wordCount !== 'all') {
            words = this.shuffleArray(words).slice(0, wordCount);
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
        
        this.history = []; // 重置历史记录
        
        // 重置提交限制相关状态（容错机制）
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this.isSubmitting = false;
        
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
            correctCount: initialCorrect,
            errorCount: initialErrors.length,
            totalTime: 0,
            startTime: Date.now(),
            wordTimes: [],
            errorWords: [...initialErrors], // 恢复之前的错题列表
            details: [] // 每题详情 {wordId, correct, snapshot}，从当前开始记录
        };
        
        // 保存初始完成数量，用于计算总进度
        this._initialCompletedCount = initialCompleted;
        
        this.isActive = true;
        
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
        
        const correct = this.practiceLog.correctCount || 0;
        const errors = this.practiceLog.errorWords || [];
        
        const updates = {
            progress: {
                total: task.progress.total,
                completed: completed, // 所有答过的题目（无论对错）= 之前的 + 当前的
                correct: correct,
                errors: errors
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
        // 默认使用黑色加粗样式
        pinyinDisplay.innerHTML = '<span style="opacity: 0; font-size: 1.2em; margin-right: 0.5rem;">✓</span><span style="color: #212529; font-weight: 600;">' + displayText + '</span>';
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
        
        // 清除画布
        Handwriting.clear();
        
        // 清除反馈
        document.getElementById('feedback-area').innerHTML = '';
        
        // 保存当前显示文本和字，用于后续反馈时替换
        this._currentDisplayText = displayText;
        this._currentWord = word.word;
        
        // 开始计时
        this._currentWordStartTime = Date.now();
        this.startTimer(this._currentWordStartTime);
    },
    
    /**
     * 开始计时器
     */
    startTimer(startTime) {
        let remaining = this.timeLimit;
        const timerBadge = document.getElementById('timer-badge');
        
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        timerBadge.textContent = `${remaining}秒`;
        
        this.timer = setInterval(() => {
            remaining--;
            timerBadge.textContent = `${remaining}秒`;
            
            if (remaining <= 0) {
                clearInterval(this.timer);
                this.timeUp(startTime);
            }
        }, 1000);
    },

    pause() {
        if (!this.isActive || this.isPaused) return;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.isPaused = true;
        const btn = document.getElementById('pause-practice-btn');
        if (btn) btn.textContent = '继续';
    },

    resume() {
        if (!this.isActive || !this.isPaused) return;
        this.isPaused = false;
        const btn = document.getElementById('pause-practice-btn');
        if (btn) btn.textContent = '暂停';
        const wordStartTime = Date.now();
        this.startTimer(wordStartTime);
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
                        this.showFeedback(true, word, '');
                        
                        // 如果是复习计划中的字，更新复习计划状态
                        this.updateReviewPlanIfNeeded(word.id, true);
                    } else {
                        this.practiceLog.errorCount++;
                        await this.recordError(word, snapshot);
                        this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
                        this.showFeedback(false, word, result.recognized || '时间到');
                        
                        // 如果是复习计划中的字，更新复习计划状态
                        this.updateReviewPlanIfNeeded(word.id, false);
                    }
                } catch (e) {
                    this.practiceLog.errorCount++;
                    await this.recordError(word, snapshot);
                    this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot, displayText: this._currentDisplayText });
                    this.showFeedback(false, word, '时间到');
                }
            } else {
                // 无内容：直接判错
                this.practiceLog.errorCount++;
                await this.recordError(word, null);
                this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null, displayText: this._currentDisplayText });
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
        
        // 防重复提交：同一个字10秒内只能提交一次
        const now = Date.now();
        // 如果切换了字，重置提交时间
        if (this.lastSubmitWordId !== word.id) {
            this.lastSubmitTime = 0;
            this.lastSubmitWordId = word.id;
            this.consecutiveBlockCount = 0; // 切换字时重置连续拦截计数
        }
        
        const timeSinceLastSubmit = now - this.lastSubmitTime;
        if (!bypassCooldown && timeSinceLastSubmit < 10000 && this.lastSubmitTime > 0 && this.lastSubmitWordId === word.id) {
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
                const remainingSeconds = Math.ceil((10000 - timeSinceLastSubmit) / 1000);
                console.warn('[Practice] 提交被拦截', {
                    wordId: word.id,
                    word: word.word,
                    remainingSeconds: remainingSeconds,
                    consecutiveBlockCount: this.consecutiveBlockCount
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
        const submitBtn = document.getElementById('submit-answer-btn');
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>识别中...';
        
        // 显示识别中
        document.getElementById('feedback-area').innerHTML = 
            '<div class="loading"></div> 识别中...';
        
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
                    // 检查是否已存在该题目的记录，如果存在则移除旧的（防止重复）
                    const existingIdx = this.practiceLog.details.findIndex(d => d.wordId === word.id);
                    if (existingIdx >= 0) {
                        const oldDetail = this.practiceLog.details[existingIdx];
                        // 如果旧记录是错误，需要调整计数
                        if (!oldDetail.correct) {
                            this.practiceLog.errorCount = Math.max(0, this.practiceLog.errorCount - 1);
                        }
                        this.practiceLog.details.splice(existingIdx, 1);
                    }
                    this.practiceLog.correctCount++;
                    // 保存详情（保留正确也保留快照）
                    this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot, displayText: this._currentDisplayText });
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
                    this.showFeedback(false, word, result.recognized);
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
            
            // 2秒后下一题
            this.scheduleNextWord(this.mode === 'normal' ? 2000 : 300, () => {
                // 保存当前题目到历史
                if (this.currentIndex < this.currentWords.length) {
                    this.history.push({
                        word: word,
                        index: this.currentIndex,
                        snapshot: snapshot
                    });
                }
                this.currentIndex++;
                this.showNextWord();
            });
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
        
        // 显示反馈（错误）
        this.showFeedback(false, word, '');
        
        // 持续草稿保存
        this.saveAutosaveDraft();
        
        // 更新任务进度（如果有任务，在答题后立即更新）
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false);
        }
        
        // 2秒后下一题
        this.scheduleNextWord(2000, () => {
            // 保存当前题目到历史
            if (this.currentIndex < this.currentWords.length) {
                this.history.push({
                    word: word,
                    index: this.currentIndex,
                    snapshot: snapshot
                });
            }
            this.currentIndex++;
            this.isSkipping = false; // 重置跳过状态
            this.showNextWord();
        });
        this._currentWordStartTime = null;
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
            // 默认使用黑色，加粗，拼音和中文粗细保持一致
            const color = isCorrect ? 'text-success' : 'text-danger';
            const defaultStyle = 'color: #212529; font-weight: 600;';
            
            let displayText = this._currentDisplayText || word.pinyin || word.word;
            const correctWord = word.word;
            let wordPinyin = word.pinyin || '';
            if (!wordPinyin && typeof WordGroups !== 'undefined' && WordGroups._generatePinyin) {
                wordPinyin = WordGroups._generatePinyin(correctWord);
            }
            
            let replacements = 0;
            // 正确答案用绿色加粗，错误答案用红色加粗，但默认显示用黑色加粗
            const wrapText = () => `<span class="${color} fw-bold">${correctWord}</span>`;
            
            if (wordPinyin && wordPinyin.trim()) {
                const escaped = wordPinyin.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
                displayText = displayText.replace(regex, () => {
                    replacements++;
                    return wrapText();
                });
            }
            
            if (replacements === 0) {
                const escapedWord = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordRegex = new RegExp(escapedWord, 'g');
                displayText = displayText.replace(wordRegex, () => {
                    replacements++;
                    return wrapText();
                });
            }
            
            // 如果仍然没有替换（找不到拼音或汉字），保留原始提示文本，并在其中替换目标字
            // 标准写法：正确答案应该写在提示中，保留原有的词组提示格式
            if (replacements === 0) {
                // 在原始提示文本中查找并替换目标字（保留词组格式）
                const originalText = this._currentDisplayText || word.pinyin || word.word;
                const escapedWord = correctWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const wordRegex = new RegExp(escapedWord, 'g');
                
                // 如果原始文本包含目标字，替换它（保留词组格式）
                if (originalText.includes(correctWord)) {
                    displayText = originalText.replace(wordRegex, wrapText());
                } else {
                    // 如果原始文本不包含目标字（可能是纯拼音词组），保留原始格式并添加正确答案
                    // 例如："xī方, xī边, 东xī" 应该显示为 "xī方, xī边, 东xī 西"（西字为红色加粗）
                    // 或者 "rì出, rì落, rì记" 应该显示为 "rì出, rì落, rì记 日"（日字为红色加粗）
                    displayText = originalText + ' ' + wrapText();
                }
            }
            
            // 确保整个显示文本使用黑色加粗样式（拼音和中文保持一致）
            pinyinDisplay.innerHTML = icon + `<span style="${defaultStyle}">${displayText}</span>`;
        }
        
        // 错误时在田字格中显示正确答案（楷体红色）
        if (!isCorrect && typeof Handwriting !== 'undefined' && Handwriting.drawCorrectWord) {
            Handwriting.drawCorrectWord(word.word);
        }
    },
    
    /**
     * 记录错题
     */
    async recordError(word, snapshot) {
        this.practiceLog.errorWords.push(word.id);
        
        // 保存到错题本（无论是否有快照，都记录错题）
        if (typeof Storage !== 'undefined' && Storage.addErrorWord) {
            const errorWord = Storage.addErrorWord(word.id, word.word, word.pinyin || '', snapshot || null);
            
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
        
        // 清除任务ID
        this.currentTaskId = null;
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
    showNextQuestion() {
        if (this.currentIndex >= this.currentWords.length - 1) {
            alert('已经是最后一题了');
            return;
        }
        this.lastSubmitTime = 0;
        this.lastSubmitWordId = null;
        this.consecutiveBlockCount = 0;
        this.isSubmitting = false;
        
        // 如果当前有未提交的笔迹，自动提交并判断
        if (this.mode === 'normal' && typeof Handwriting !== 'undefined' && Handwriting.hasContent && Handwriting.hasContent()) {
            this.submitAnswer({ bypassCooldown: true });
            return;
        }

        // 停止当前计时器
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 保存当前题目到历史
        const word = this.currentWords[this.currentIndex];
        if (this.currentIndex < this.currentWords.length) {
            this.history.push({
                word: word,
                index: this.currentIndex,
                snapshot: null
            });
        }
        
        this.currentIndex++;
        this.showNextWord();
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
        submitBtn.addEventListener('click', () => Practice.submitAnswer());
    }
    
    if (skipAnswerBtn) {
        skipAnswerBtn.addEventListener('click', () => Practice.skipAnswer());
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
    const pauseBtn = document.getElementById('pause-practice-btn');
    if (pauseBtn) {
        pauseBtn.addEventListener('click', () => {
            if (Practice.isPaused) Practice.resume(); else Practice.pause();
        });
    }
    
    const prevBtn = document.getElementById('prev-question-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => Practice.showPreviousWord());
    }
    
    const nextBtn = document.getElementById('next-question-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => Practice.showNextQuestion());
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
