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
    timer: null,
    timeLimit: 30,
    isActive: false,
    isPaused: false,
    mode: 'normal',
    lastSubmitTime: 0, // 上次提交时间，用于防重复提交
    isSubmitting: false, // 是否正在提交中
    
    /**
     * 开始练习
     */
    async start() {
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
        const countSelect = document.getElementById('word-count-select');
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
        
        // 获取题目（支持错题集一键练习）
        let words = [];
        const errorOnly = localStorage.getItem('practice_error_only') === '1';
        if (errorOnly) {
            const errorWords = Storage.getErrorWords();
            const wordBank = Storage.getWordBank();
            words = wordBank.filter(w => errorWords.some(ew => ew.wordId === w.id));
            // 重置标记
            localStorage.removeItem('practice_error_only');
        } else if (typeof PracticeRange !== 'undefined' && PracticeRange.getSelectedWords) {
            // 仅读取练习页容器中的选择，避免与首页重复
            words = PracticeRange.getSelectedWords('practice-range-container');
        } else {
            // 降级：使用原来的范围选择
            const range = document.getElementById('practice-range-select')?.value || 'all';
            words = this.getWordsByRange(range);
        }
        
        if (words.length === 0) {
            alert('请先选择练习范围！\n\n在"练习范围"区域勾选要练习的单元。');
            return;
        }
        
        // 随机选择或限制数量
        if (wordCount !== 'all') {
            words = this.shuffleArray(words).slice(0, wordCount);
        }
        
        this.currentWords = words;
        this.currentIndex = 0;
        this.history = []; // 重置历史记录
        
        // 初始化练习记录
        this.practiceLog = {
            totalWords: words.length,
            correctCount: 0,
            errorCount: 0,
            totalTime: 0,
            startTime: Date.now(),
            wordTimes: [],
            errorWords: [],
            details: [] // 每题详情 {wordId, correct, snapshot}
        };
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

    savePartialIfActive() {
        if (!this.isActive || !this.practiceLog || this.practiceLog.totalWords === 0) return;
        let isDebug = false; try { isDebug = localStorage.getItem('debugMode') === '1'; } catch(e) {}
        try {
            const log = {
                totalWords: this.practiceLog.totalWords,
                correctCount: this.practiceLog.correctCount,
                errorCount: this.practiceLog.errorCount,
                totalTime: this.practiceLog.totalTime,
                averageTime: (this.practiceLog.totalWords > 0 ? this.practiceLog.totalTime / this.practiceLog.totalWords : 0),
                errorWords: this.practiceLog.errorWords,
                details: this.practiceLog.details || [],
                status: 'partial',
                isDebug
            };
            Storage.addPracticeLog(log);
        } catch(e) {
            console.warn('保存未完成练习失败:', e);
        } finally {
            this.isActive = false;
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
                const errorWords = Storage.getErrorWords();
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
        if (this.currentIndex >= this.currentWords.length) {
            this.finish();
            return;
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
        pinyinDisplay.textContent = displayText;
        console.log('[Practice] 显示题目:', JSON.stringify({
            word: word.word,
            pinyin: word.pinyin || '(空)',
            displayText: displayText,
            wordId: word.id
        }, null, 2));
        
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
        const wordStartTime = Date.now();
        this.startTimer(wordStartTime);
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
                        this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot });
                        this.showFeedback(true, word, '');
                    } else {
                        this.practiceLog.errorCount++;
                        await this.recordError(word, snapshot);
                        this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot });
                        this.showFeedback(false, word, result.recognized || '时间到');
                    }
                } catch (e) {
                    this.practiceLog.errorCount++;
                    await this.recordError(word, snapshot);
                    this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot });
                    this.showFeedback(false, word, '时间到');
                }
            } else {
                // 无内容：直接判错
                this.practiceLog.errorCount++;
                await this.recordError(word, null);
                this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null });
                this.showFeedback(false, word, '时间到');
            }
        } else {
            // 纸质模式：不记录错题/详情
        }
        
        // 2秒后下一题
        setTimeout(() => {
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
        }, 2000);
        
        // 持续草稿保存
        this.saveAutosaveDraft();
    },
    
    /**
     * 提交答案
     */
    async submitAnswer() {
        // 防重复提交：10秒内只能提交一次
        const now = Date.now();
        const timeSinceLastSubmit = now - this.lastSubmitTime;
        if (timeSinceLastSubmit < 10000 && this.lastSubmitTime > 0) {
            const remainingSeconds = Math.ceil((10000 - timeSinceLastSubmit) / 1000);
            alert(`请等待 ${remainingSeconds} 秒后再提交`);
            return;
        }
        
        // 如果正在提交中，忽略
        if (this.isSubmitting) {
            return;
        }
        
        if (this.mode === 'normal' && !Handwriting.hasContent()) {
            alert('请先书写');
            return;
        }
        
        const word = this.currentWords[this.currentIndex];
        const snapshot = this.mode === 'normal' ? Handwriting.getSnapshot() : null;
        const wordStartTime = this.practiceLog.wordTimes.length > 0 ? 
            Date.now() - (this.practiceLog.wordTimes[this.practiceLog.wordTimes.length - 1] * 1000 + this.practiceLog.startTime) : 
            Date.now() - this.practiceLog.startTime;
        const wordTime = wordStartTime / 1000;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 设置提交状态和按钮loading
        this.isSubmitting = true;
        this.lastSubmitTime = now;
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
                    this.practiceLog.correctCount++;
                    // 保存详情（保留正确也保留快照）
                    this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot });
                    this.showFeedback(true, word, '');
                } else {
                    // 纸质模式：不反馈对错，快速进入下一题
                    document.getElementById('feedback-area').innerHTML = '';
                }
            } else {
                // 错误
                if (this.mode === 'normal') {
                    this.practiceLog.errorCount++;
                    await this.recordError(word, snapshot);
                    this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot });
                    this.showFeedback(false, word, result.recognized);
                } else {
                    document.getElementById('feedback-area').innerHTML = '';
                }
            }
            // 持续草稿保存
            this.saveAutosaveDraft();
            
            // 恢复按钮状态
            this.isSubmitting = false;
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
            
            // 2秒后下一题
            setTimeout(() => {
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
            }, this.mode === 'normal' ? 2000 : 300);
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
     */
    async skipAnswer() {
        const word = this.currentWords[this.currentIndex];
        const snapshot = this.mode === 'normal' && Handwriting.hasContent() ? Handwriting.getSnapshot() : null;
        const wordStartTime = this.practiceLog.wordTimes.length > 0 ? 
            Date.now() - (this.practiceLog.wordTimes[this.practiceLog.wordTimes.length - 1] * 1000 + this.practiceLog.startTime) : 
            Date.now() - this.practiceLog.startTime;
        const wordTime = wordStartTime / 1000;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 记录为错误（不会）
        this.practiceLog.errorCount++;
        this.practiceLog.wordTimes.push(wordTime);
        this.practiceLog.totalTime += wordTime;
        
        // 如果有笔迹，保存快照
        if (snapshot) {
            await this.recordError(word, snapshot);
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot });
        } else {
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null });
        }
        
        // 显示反馈（错误）
        this.showFeedback(false, word, '');
        
        // 持续草稿保存
        this.saveAutosaveDraft();
        
        // 2秒后下一题
        setTimeout(() => {
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
        }, 2000);
    },
    
    /**
     * 显示反馈
     * 错误时：不显示feedback-area，将正确的字代入拼音显示中（红字）
     * 正确时：不显示feedback-area，将正确的字代入拼音显示中（绿字）
     */
    showFeedback(isCorrect, word, recognized) {
        const feedbackArea = document.getElementById('feedback-area');
        const pinyinDisplay = document.getElementById('pinyin-display');
        
        // 清空反馈区域（不显示红框内容）
        feedbackArea.innerHTML = '';
        
        // 在拼音显示区域中，将正确的字替换到词组中，并在左边显示对钩/叉
        if (pinyinDisplay && this._currentDisplayText) {
            // 添加对钩或叉的图标
            const icon = isCorrect 
                ? '<i class="bi bi-check-circle-fill text-success me-2" style="font-size: 1.2em;"></i>' 
                : '<i class="bi bi-x-circle-fill text-danger me-2" style="font-size: 1.2em;"></i>';
            
            // 获取当前显示的文本（词组，例如：dú书, 阅dú, 朗dú）
            let displayText = this._currentDisplayText;
            const correctWord = word.word;
            
            // 获取字的拼音（用于在词组中查找并替换）
            let wordPinyin = word.pinyin || '';
            if (!wordPinyin && typeof WordGroups !== 'undefined' && WordGroups._generatePinyin) {
                // 如果没有拼音，尝试生成
                wordPinyin = WordGroups._generatePinyin(correctWord);
            }
            
            // 将词组中的拼音替换为正确的字，并用颜色标记
            if (wordPinyin && wordPinyin.trim()) {
                // 转义拼音中的特殊字符，用于正则表达式
                const escapedPinyin = wordPinyin.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                // 使用正则表达式替换拼音为正确的字
                // 匹配拼音（前后可能有空格、逗号等分隔符）
                const pinyinRegex = new RegExp(`\\b${escapedPinyin}\\b`, 'gi');
                displayText = displayText.replace(pinyinRegex, (match) => {
                    // 用带颜色的字替换拼音
                    const color = isCorrect ? 'text-success' : 'text-danger';
                    return `<span class="${color} fw-bold">${correctWord}</span>`;
                });
            } else {
                // 如果没有拼音，直接在文本末尾添加正确的字
                const color = isCorrect ? 'text-success' : 'text-danger';
                displayText = displayText + ` <span class="${color} fw-bold">${correctWord}</span>`;
            }
            
            // 更新拼音显示区域：在左边添加图标，然后显示文本（使用innerHTML以支持HTML标签）
            pinyinDisplay.innerHTML = icon + displayText;
        }
        
        // 错误时在田字格中显示正确答案
        if (!isCorrect && typeof Handwriting !== 'undefined' && Handwriting.drawCorrectWord) {
            Handwriting.drawCorrectWord(word.word);
        }
    },
    
    /**
     * 记录错题
     */
    async recordError(word, snapshot) {
        this.practiceLog.errorWords.push(word.id);
        
        // 保存到错题本
        if (snapshot) {
            Storage.addErrorWord(word.id, word.word, word.pinyin || '', snapshot);
        }
    },
    
    /**
     * 跳过题目
     */
    async skipQuestion() {
        if (confirm('确定要跳过这道题吗？（将记录为错题）')) {
            const word = this.currentWords[this.currentIndex];
            await this.recordError(word, null);
            this.practiceLog.errorCount++;
            
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
    finish() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        let isDebug = false; try { isDebug = localStorage.getItem('debugMode') === '1'; } catch(e) {}
        
        // 保存练习记录
        const log = Storage.addPracticeLog({
            totalWords: this.practiceLog.totalWords,
            correctCount: this.practiceLog.correctCount,
            errorCount: this.practiceLog.errorCount,
            totalTime: this.practiceLog.totalTime,
            averageTime: this.practiceLog.totalWords > 0 ? 
                this.practiceLog.totalTime / this.practiceLog.totalWords : 0,
            errorWords: this.practiceLog.errorWords,
            details: this.practiceLog.details || [],
            status: 'completed',
            isDebug
        });
        this.isActive = false;
        
        // 跳转到结果页面
        if (typeof Main !== 'undefined') {
            Main.showResults(log.id);
        }
        
        // 清除草稿
        if (typeof Storage !== 'undefined' && Storage.clearPracticeAutosave) {
            Storage.clearPracticeAutosave();
        }
    },
    
    /**
     * 结束练习（手动）
     */
    end() {
        if (confirm('确定要结束练习吗？')) {
            this.finish();
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
        
        // 如果当前有未提交的笔迹，自动提交并判断
        if (this.mode === 'normal' && typeof Handwriting !== 'undefined' && Handwriting.hasContent && Handwriting.hasContent()) {
            this.submitAnswer();
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

    loadSettings() {
        if (typeof Storage === 'undefined') return;
        const settings = Storage.getSettings() || {};
        const p = settings.practice || {};
        const countSelect = document.getElementById('word-count-select');
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
