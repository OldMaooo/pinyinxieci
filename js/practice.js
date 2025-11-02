/**
 * 练习模块
 * 管理练习流程
 */

const Practice = {
    currentWords: [],
    currentIndex: 0,
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
    
    /**
     * 开始练习
     */
    async start() {
        const wordCount = parseInt(document.getElementById('word-count-select').value);
        const timeLimit = parseInt(document.getElementById('time-limit-input').value);
        const range = document.getElementById('practice-range-select').value;
        
        this.timeLimit = timeLimit;
        
        // 获取题目
        let words = this.getWordsByRange(range);
        
        if (words.length === 0) {
            alert('题库为空，请先导入题库');
            return;
        }
        
        // 随机选择或限制数量
        if (wordCount !== 'all') {
            words = this.shuffleArray(words).slice(0, wordCount);
        }
        
        this.currentWords = words;
        this.currentIndex = 0;
        
        // 初始化练习记录
        this.practiceLog = {
            totalWords: words.length,
            correctCount: 0,
            errorCount: 0,
            totalTime: 0,
            startTime: Date.now(),
            wordTimes: [],
            errorWords: []
        };
        
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
        
        // 显示拼音和词组
        const pinyinDisplay = document.getElementById('pinyin-display');
        if (typeof WordGroups !== 'undefined') {
            pinyinDisplay.textContent = WordGroups.getDisplayText(word.word, word.pinyin || '');
        } else {
            pinyinDisplay.textContent = word.pinyin || '';
        }
        
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
        
        // 显示反馈
        this.showFeedback(false, word, '时间到');
        
        // 2秒后下一题
        setTimeout(() => {
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
            // 调用识别
            const result = await Recognition.recognize(snapshot, word.word);
            
            if (!result.success) {
                throw new Error(result.error || '识别失败');
            }
            
            // 记录时间
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            
            if (result.passed) {
                // 正确
                this.practiceLog.correctCount++;
                this.showFeedback(true, word, '');
            } else {
                // 错误
                this.practiceLog.errorCount++;
                await this.recordError(word, snapshot);
                this.showFeedback(false, word, result.recognized);
            }
            
            // 2秒后下一题
            setTimeout(() => {
                this.currentIndex++;
                this.showNextWord();
            }, 2000);
        } catch (error) {
            console.error('提交失败:', error);
            document.getElementById('feedback-area').innerHTML = 
                `<div class="text-danger">识别出错: ${error.message}</div>`;
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
            feedbackArea.innerHTML = `
                <div class="feedback-error">
                    <i class="bi bi-x-circle-fill"></i> 错误
                </div>
                <div class="mt-2">
                    <strong>正确答案：</strong> ${word.word}
                    ${recognized ? `<br><strong>识别结果：</strong> ${recognized}` : ''}
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
        
        // 保存练习记录
        const log = Storage.addPracticeLog({
            totalWords: this.practiceLog.totalWords,
            correctCount: this.practiceLog.correctCount,
            errorCount: this.practiceLog.errorCount,
            totalTime: this.practiceLog.totalTime,
            averageTime: this.practiceLog.totalWords > 0 ? 
                this.practiceLog.totalTime / this.practiceLog.totalWords : 0,
            errorWords: this.practiceLog.errorWords
        });
        
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
     * 数组随机打乱
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
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
});
