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
    
    /**
     * 开始练习
     */
    async start() {
        const countInput = document.getElementById('word-count-input');
        const countSelect = document.getElementById('word-count-select');
        let wordCount = countInput ? parseInt(countInput.value) : NaN;
        if (isNaN(wordCount)) {
            wordCount = countSelect ? (countSelect.value === 'all' ? 'all' : parseInt(countSelect.value)) : 'all';
        }
        const timeLimit = parseInt(document.getElementById('time-limit-input').value);
        
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
    showNextWord() {
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
        if (typeof WordGroups !== 'undefined') {
            displayText = WordGroups.getDisplayText(word.word, word.pinyin || '');
        }
        
        // 使用textContent确保正确显示
        pinyinDisplay.textContent = displayText;
        console.log('显示词组:', displayText, 'Word:', word.word);
        
        // 更新进度
        document.getElementById('progress-badge').textContent = 
            `${this.currentIndex + 1}/${this.currentWords.length}`;
        
        // 清除画布
        Handwriting.clear();
        
        // 清除反馈
        document.getElementById('feedback-area').innerHTML = '';
        
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
    
    /**
     * 时间到
     */
    async timeUp(startTime) {
        const wordTime = (Date.now() - startTime) / 1000;
        this.practiceLog.wordTimes.push(wordTime);
        
        // 记录为错题
        const word = this.currentWords[this.currentIndex];
        await this.recordError(word, null); // 超时，没有快照
        // 保存详情
        if (this.practiceLog && this.practiceLog.details) {
            this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot: null });
        }
        
        // 显示反馈
        this.showFeedback(false, word, '时间到');
        
        // 2秒后下一题
        setTimeout(() => {
            // 保存当前题目到历史（超时也算）
            if (this.currentIndex < this.currentWords.length) {
                this.history.push({
                    word: word,
                    index: this.currentIndex,
                    snapshot: null // 超时没有快照
                });
            }
            this.currentIndex++;
            this.showNextWord();
        }, 2000);
    },
    
    /**
     * 提交答案
     */
    async submitAnswer() {
        if (!Handwriting.hasContent()) {
            alert('请先书写');
            return;
        }
        
        const word = this.currentWords[this.currentIndex];
        const snapshot = Handwriting.getSnapshot();
        const wordStartTime = this.practiceLog.wordTimes.length > 0 ? 
            Date.now() - (this.practiceLog.wordTimes[this.practiceLog.wordTimes.length - 1] * 1000 + this.practiceLog.startTime) : 
            Date.now() - this.practiceLog.startTime;
        const wordTime = wordStartTime / 1000;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
        }
        
        // 显示识别中
        document.getElementById('feedback-area').innerHTML = 
            '<div class="loading"></div> 识别中...';
        
        try {
            // 调试日志
            if (typeof Debug !== 'undefined') {
                Debug.log('info', `开始识别字符: ${word.word}`, 'recognition');
                Debug.log('info', `图片快照大小: ${(snapshot.length / 1024).toFixed(2)}KB`, 'recognition');
            }
            
            // 调用识别
            const result = await Recognition.recognize(snapshot, word.word);
            
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
                this.practiceLog.correctCount++;
                // 保存详情（保留正确也保留快照）
                this.practiceLog.details.push({ wordId: word.id, correct: true, snapshot });
                this.showFeedback(true, word, '');
            } else {
                // 错误
                this.practiceLog.errorCount++;
                await this.recordError(word, snapshot);
                this.practiceLog.details.push({ wordId: word.id, correct: false, snapshot });
                this.showFeedback(false, word, result.recognized);
            }
            
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
        } catch (error) {
            console.error('提交失败:', error);
            
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
            if (error.message.includes('load failed') || error.message.includes('Failed to fetch')) {
                displayMsg = '网络连接失败，请检查调试面板查看详情';
            }
            
            document.getElementById('feedback-area').innerHTML = 
                `<div class="text-danger">
                    <i class="bi bi-exclamation-triangle"></i> 识别出错: ${displayMsg}
                    <br><small class="text-muted">点击导航栏"调试"按钮查看详细错误信息</small>
                </div>`;
        }
    },
    
    /**
     * 显示反馈
     */
    showFeedback(isCorrect, word, recognized) {
        const feedbackArea = document.getElementById('feedback-area');
        
        if (isCorrect) {
            feedbackArea.innerHTML = `
                <div class="feedback-correct">
                    <i class="bi bi-check-circle-fill"></i> 正确！
                </div>
            `;
        } else {
            // 在田字格中显示正确答案
            if (typeof Handwriting !== 'undefined' && Handwriting.drawCorrectWord) {
                Handwriting.drawCorrectWord(word.word);
            }
            
            // 简化正确答案显示：仅红色大字，减少高度
            const recognizedInfo = (recognized && recognized !== '时间到') ? `<small class="text-muted ms-2">(识别：${recognized})</small>` : '';
            feedbackArea.innerHTML = `
                <div class="fw-bold text-danger" style="font-size: 2rem; line-height: 1;">
                    ${word.word}${recognizedInfo}
                </div>
            `;
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
    showPreviousWord() {
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
                displayText = WordGroups.getDisplayText(word.word, word.pinyin || '');
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
        if (p.wordCount !== undefined) {
            if (countSelect) countSelect.value = (p.wordCount === 'all' ? 'all' : String(p.wordCount || '20'));
            if (countInput) countInput.value = (p.wordCount && p.wordCount !== 'all') ? String(p.wordCount) : '';
        }
        if (p.timeLimit !== undefined && timeInput) timeInput.value = p.timeLimit;
    }
};

// 绑定按钮事件
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('start-practice-btn');
    const submitBtn = document.getElementById('submit-answer-btn');
    const clearBtn = document.getElementById('clear-canvas-btn');
    const skipBtn = document.getElementById('skip-question-btn');
    const endBtn = document.getElementById('end-practice-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => Practice.start());
    }
    
    if (submitBtn) {
        submitBtn.addEventListener('click', () => Practice.submitAnswer());
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
    
    const prevBtn = document.getElementById('prev-question-btn');
    if (prevBtn) {
        prevBtn.addEventListener('click', () => Practice.showPreviousWord());
    }

    // 加载上次练习设置
    if (Practice.loadSettings) {
        Practice.loadSettings();
    }
});
