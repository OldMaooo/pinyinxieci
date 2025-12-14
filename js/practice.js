/**
 * 练习模块
 * 管理练习流程
 */

var Practice = {
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
                ...payload
            });
            // 限制日志长度，保留最近 500 条
            if (this.debugEvents.length > 500) {
                this.debugEvents = this.debugEvents.slice(-500);
            }
        } catch (e) {
            console.error('[Practice] logDebugEvent error:', e);
        }
    },

    isActive: false,      // 是否正在练习
    isPaused: false,      // 是否暂停
    currentWords: [],     // 当前练习的生字列表
    currentIndex: 0,      // 当前生字索引
    timer: null,          // 计时器
    timeLeft: 0,          // 剩余时间
    totalTime: 0,         // 总时间限制
    
    // 状态锁
    isSubmitting: false,         // 是否正在提交（防重复点击）
    isProcessingNextQuestion: false, // 是否正在处理下一题（防重复点击）
    isSkipping: false,           // 是否正在跳过（防重复点击）
    allowSkip: true,             // 是否允许跳过（从 localStorage 读取）
    
    // 内部定时器引用（用于清理）
    _nextWordTimer: null,        // 下一题自动跳转定时器
    _retryClearTimer: null,      // 重做模式清空画布定时器
    _hasClearedCanvasInRetry: false, // 重做模式是否已清空画布
    _currentWordStartTime: null, // 当前题目开始时间（用于计算单题耗时）
    
    // 页面访问权限控制
    _practicePageAllowanceExpiry: 0, // 允许进入练习页面的过期时间
    allowPracticePageOnce() {
        // 设置2秒的有效期，允许在这段时间内多次检查通过（解决 Main.showPage 设置 hash 导致 hashchange 二次触发检查的问题）
        this._practicePageAllowanceExpiry = Date.now() + 2000;
    },
    consumePracticePageAllowance() {
        // 只要在有效期内，都返回 true
        return Date.now() < this._practicePageAllowanceExpiry;
    },

    // 历史记录
    history: [], // {word, index, snapshot}
    
    // 任务相关
    currentTaskId: null,
    practiceLog: {
        startTime: null,
        endTime: null,
        totalWords: 0,
        correctCount: 0,
        errorCount: 0,
        details: [], // {wordId, correct, snapshot, displayText}
        wordTimes: [], // 每道题的耗时
        totalTime: 0 // 总耗时
    },

    // 任务模式下的初始状态（用于正确计算进度）
    _initialCorrectCount: 0,
    _initialErrorWords: [],

    init() {
        this.bindEvents();
        // 初始化跳过设置
        const savedSkip = localStorage.getItem('practice_allow_skip');
        if (savedSkip !== null) {
            this.allowSkip = savedSkip === 'true';
        }
        this.updateSkipSettingUI();
        console.log('[Practice] 初始化完成，跳过设置:', this.allowSkip);
    },

    start(words, options = {}) {
        this.logDebugEvent('start_practice', { wordCount: words.length, options });
        
        if (!words || words.length === 0) {
            alert('没有可练习的生字');
            return;
        }

        // 清理之前的定时器和状态
        this.cleanupTimers();

        this.isActive = true;
        this.isPaused = false;
        this.currentWords = words;
        
        // 如果是继续任务，设置当前索引；否则从0开始
        if (options.startIndex) {
            this.currentIndex = options.startIndex;
            console.log('[Practice] 继续任务，从索引', this.currentIndex, '开始');
        } else {
            this.currentIndex = 0;
        }
        
        this.totalTime = options.timeLimit || 0;
        
        // 任务相关
        this.currentTaskId = options.taskId || null;
        
        // 初始化练习日志
        this.practiceLog = {
            startTime: Date.now(),
            endTime: null,
            totalWords: words.length,
            correctCount: options.initialCorrectCount || 0, // 继承之前的正确数
            errorCount: 0,
            details: options.initialDetails || [], // 继承之前的详情
            wordTimes: options.initialWordTimes || [], // 继承之前的耗时
            totalTime: options.initialTotalTime || 0 // 继承之前的总耗时
        };
        
        // 保存初始状态用于进度计算
        this._initialCorrectCount = options.initialCorrectCount || 0;
        // 如果有之前的错题，提取出来
        this._initialErrorWords = [];
        if (options.initialDetails) {
            options.initialDetails.forEach(d => {
                if (!d.correct) {
                    const word = words.find(w => w.id === d.wordId);
                    if (word) this._initialErrorWords.push(word);
                }
            });
        }
        
        // 历史记录初始化
        this.history = [];
        
        // 显示练习区域
        document.getElementById('practice-range-container').classList.add('d-none');
        document.getElementById('practice-area').classList.remove('d-none');
        
        // 初始化进度条
        this.updateProgressVisual();
        
        // 显示第一个生字
        this.showCurrentWord();
        
        // 更新任务进度（初始状态）
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false); // 不保存，只是更新UI和内存状态
        }
    },

    pause() {
        if (!this.isActive || this.isPaused) return;
        this.isPaused = true;
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 更新UI
        const icon = document.getElementById('timer-pause-icon');
        if (icon) {
            icon.className = 'bi bi-play-fill';
            // 闪烁效果提示暂停
            const btn = document.getElementById('timer-pause-btn');
            if (btn) btn.classList.add('btn-warning');
        }
        
        // 禁用画布
        if (typeof Handwriting !== 'undefined') {
            Handwriting.disable();
        }
        
        // 如果是任务，保存部分进度（状态为暂停）
        this.savePartialIfActive(true); // true 表示暂停
    },

    resume() {
        if (!this.isActive || !this.isPaused) return;
        this.isPaused = false;
        
        // 恢复计时器
        if (this.totalTime > 0 && this.timeLeft > 0) {
            this.startTimer();
        }
        
        // 更新UI
        const icon = document.getElementById('timer-pause-icon');
        if (icon) {
            icon.className = 'bi bi-pause-fill';
            const btn = document.getElementById('timer-pause-btn');
            if (btn) btn.classList.remove('btn-warning');
        }
        
        // 启用画布
        if (typeof Handwriting !== 'undefined') {
            Handwriting.enable();
        }
        
        // 如果是任务，更新状态为进行中
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            TaskList.updateTask(this.currentTaskId, {
                status: TaskList.STATUS.IN_PROGRESS
            });
        }
    },

    finish() {
        this.isActive = false;
        this.practiceLog.endTime = Date.now();
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        // 清理内部定时器
        this.cleanupTimers();

        // 隐藏练习区域
        document.getElementById('practice-area').classList.add('d-none');
        
        // 保存练习记录
        if (typeof Storage !== 'undefined') {
            Storage.savePracticeLog(this.practiceLog);
        }
        
        // 如果是任务，更新任务状态为完成
        if (this.currentTaskId && typeof TaskList !== 'undefined') {
            this.updateTaskProgress(false); // 确保最后一次进度已更新
            TaskList.completeTask(this.currentTaskId, this.practiceLog);
            
            // 尝试创建复习任务（如果是普通练习且有错题）
            // 注意：这里需要传入当前的 practiceLogId，但 Storage.savePracticeLog 没有返回 ID
            // 不过 createReviewTaskFromPractice 会自己查找最近的 log
            // 为了准确，我们最好在 Storage.savePracticeLog 中返回 ID，但现在先不改 Storage
            // 暂时通过 log 对象传递（log 对象被引用修改了？）没有。
            // 重新获取一下最新的 log
            const logs = Storage.getPracticeLogs();
            if (logs.length > 0) {
                const lastLog = logs[0];
                // 确保是刚刚保存的这个
                if (lastLog.endTime === this.practiceLog.endTime) {
                    TaskList.createReviewTaskFromPractice(lastLog);
                }
            }
        }
        
        // 自动同步
        if (typeof SupabaseSync !== 'undefined' && document.getElementById('supabase-auto-sync-switch')?.checked) {
            SupabaseSync.syncData();
        }

        // 显示结算页面（复用统计模态框或新建）
        // 暂时简单alert，后续优化
        // alert(`练习结束！\n共${this.practiceLog.totalWords}字\n正确：${this.practiceLog.correctCount}\n错误：${this.practiceLog.errorCount}`);
        
        // 跳转到错题本或首页
        if (this.practiceLog.errorCount > 0) {
            if (typeof Main !== 'undefined') Main.showPage('errorbook');
        } else {
            if (typeof Main !== 'undefined') Main.showPage('home');
        }
    },

    showCurrentWord() {
        if (this.currentIndex >= this.currentWords.length) {
            this.finish();
            return;
        }

        const word = this.currentWords[this.currentIndex];
        // 记录开始时间
        this._currentWordStartTime = Date.now();
        
        // 更新UI
        const pinyinEl = document.getElementById('practice-pinyin');
        const wordEl = document.getElementById('practice-word');
        const hintEl = document.getElementById('practice-hint'); // 词组提示元素
        
        if (pinyinEl) {
            // 使用 pinyin-pro 生成拼音，带声调
            const { pinyin } = window.pinyinPro;
            pinyinEl.textContent = pinyin(word.word);
        }
        
        // 在练习模式下，汉字部分通常不显示，或者显示为填空
        // 这里我们清空汉字显示，让用户写
        if (wordEl) {
            wordEl.textContent = ''; // 或者 '?'
            // 存储当前字的正确答案，用于比对
            wordEl.dataset.answer = word.word;
        }

        // 显示词组提示
        if (hintEl) {
            if (typeof WordGroups !== 'undefined') {
                const group = WordGroups.getGroupForWord(word.word);
                if (group) {
                    // 将目标字替换为下划线或方框
                    const maskedGroup = group.replace(new RegExp(word.word, 'g'), '___');
                    hintEl.textContent = `提示：${maskedGroup}`;
                    hintEl.classList.remove('d-none');
                } else {
                    hintEl.classList.add('d-none');
                }
            } else {
                hintEl.classList.add('d-none');
            }
        }
        
        // 清空画布
        if (typeof Handwriting !== 'undefined') {
            Handwriting.clear();
            Handwriting.resizeCanvas(); // 确保尺寸正确
            Handwriting.enable(); // 确保启用
            // 设置背景文字（田字格中显示淡淡的字，可选）
            // Handwriting.setBackgroundText(word.word); 
            // 练习模式通常不显示背景字，除非是描红模式
        }
        
        // 重置倒计时
        if (this.totalTime > 0) {
            this.timeLeft = this.totalTime;
            this.updateTimerVisual();
            this.startTimer();
        }
        
        // 更新进度指示器
        this.updateProgressVisual();
        
        // 重置状态锁
        this.isSubmitting = false;
        this.isProcessingNextQuestion = false;
        this.isSkipping = false;
        
        // 确保跳过设置UI正确
        this.updateSkipSettingUI();
    },

    startTimer() {
        if (this.timer) clearInterval(this.timer);
        
        this.timer = setInterval(() => {
            if (this.isPaused) return;
            
            this.timeLeft--;
            this.updateTimerVisual();
            
            if (this.timeLeft <= 0) {
                clearInterval(this.timer);
                this.timer = null;
                // 超时处理：自动提交或提示
                // 这里选择自动判错并进入下一题
                // this.handleTimeout();
                // 或者只是停止计时，等待用户操作
            }
        }, 1000);
    },

    updateTimerVisual() {
        const circle = document.getElementById('timer-progress');
        const text = document.getElementById('timer-text'); // 如果有数字显示
        
        if (circle && this.totalTime > 0) {
            const percentage = this.timeLeft / this.totalTime;
            const circumference = 2 * Math.PI * 26; // r=26
            const dashoffset = circumference * (1 - percentage);
            circle.style.strokeDasharray = `${circumference} ${circumference}`;
            circle.style.strokeDashoffset = dashoffset;
            
            // 颜色变化
            if (percentage < 0.2) {
                circle.style.stroke = '#dc3545'; // 红色警告
            } else {
                circle.style.stroke = '#0dcaf0'; // 正常颜色
            }
        }
    },
    
    // 更新答题进度可视化（圆点）
    updateProgressVisual() {
        const container = document.getElementById('progress-visual');
        const badge = document.getElementById('progress-badge');
        
        if (badge) {
            badge.textContent = `${this.currentIndex + 1}/${this.currentWords.length}`;
        }
        
        if (container) {
            container.innerHTML = '';
            // 最多显示10个点，如果题目多，显示当前附近的
            // 这里简单实现，只显示进度条或数字即可，圆点可能太多
            // 暂时不实现圆点，用 Badge 足够
        }
    },

    // 提交答案
    async submitAnswer() {
        this.logDebugEvent('submit_click');
        
        if (!this.isActive || this.isPaused) return;
        
        // 防止重复提交
        if (this.isSubmitting || this.isProcessingNextQuestion) {
            this.logDebugEvent('submit_blocked', { reason: 'already_submitting' });
            return;
        }
        
        this.isSubmitting = true;
        this.logDebugEvent('submit_start');
        
        try {
            // 停止计时
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }

            // 获取手写识别结果
            if (typeof Handwriting === 'undefined' || typeof Recognition === 'undefined') {
                console.error('Handwriting or Recognition module missing');
                this.isSubmitting = false;
                return;
            }

            // 检查是否有笔画
            if (Handwriting.strokes.length === 0) {
                // 空画布处理
                this.handleEmptySubmission();
                return; // handleEmptySubmission 会处理 isSubmitting 状态
            }

            const strokes = Handwriting.getStrokes();
            // 获取当前题目的目标字
            const currentWord = this.currentWords[this.currentIndex].word;
            
            // 调用识别API
            const result = await Recognition.recognize(strokes);
            
            // 验证结果
            // 检查识别出的候选字中是否包含目标字
            // result.candidates 是数组 ['字', '字', ...]
            const isCorrect = result.candidates.includes(currentWord);
            
            await this.handleResult(isCorrect, result.candidates[0]); // 传入首选字用于显示（如果是错的）
        } catch (e) {
            console.error('[Practice] Submit error:', e);
            alert('识别出错，请重试');
            this.isSubmitting = false;
            // 恢复计时器
            this.startTimer();
        }
    },
    
    // 处理空画布提交
    handleEmptySubmission() {
        this.logDebugEvent('empty_submission');
        
        // 如果允许跳过，直接算错并进入下一题（不进入重做模式）
        if (this.allowSkip) {
            this.logDebugEvent('skip_allowed_action');
            // 记录错题
            const word = this.currentWords[this.currentIndex];
            const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
            
            this.practiceLog.errorCount++;
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            
            this.practiceLog.details.push({
                wordId: word.id,
                correct: false,
                snapshot: null,
                displayText: ''
            });
            
            // 记录错题到错题本
            this.recordError(word, null);
            
            // 显示正确答案（不进入重做交互，只是展示一下）
            Handwriting.showGuide(word.word);
            Handwriting.disable();
            
            // 更新任务进度
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
            
            // 1秒后自动下一题
            if (this._nextWordTimer) clearTimeout(this._nextWordTimer);
            this._nextWordTimer = setTimeout(() => {
                this.showNextWord();
                // 重置状态
                this.isSubmitting = false;
                this.isProcessingNextQuestion = false;
            }, 1000);
            
            return;
        }

        // 不允许跳过：进入重做模式
        this.logDebugEvent('retry_mode_enter');
        // 显示提示：请书写
        const feedbackEl = document.getElementById('practice-feedback');
        if (feedbackEl) {
            feedbackEl.textContent = '请书写';
            feedbackEl.className = 'text-warning fade-in';
            setTimeout(() => {
                if (feedbackEl) feedbackEl.textContent = '';
            }, 2000);
        }
        
        // 记录为错题（如果还没记录过）
        this.recordCurrentAsErrorIfNotRecorded();
        
        // 进入重做模式：显示正确答案轮廓（描红）
        const currentWord = this.currentWords[this.currentIndex].word;
        Handwriting.showGuide(currentWord);
        
        // 清空画布（保留轮廓）
        Handwriting.clearStrokesOnly(); 
        
        // 标记正在重做
        this._isRetryingError = true;
        this.isSubmitting = false; // 允许再次提交
        
        // 恢复计时（重做也要计时吗？通常不需要，或者重新开始倒计时）
        // 这里不恢复计时，给用户足够时间练习
    },
    
    // 记录当前题为错题（如果本题还没有记录过）
    // 用于重做模式前，确保这道题被记为错误
    async recordCurrentAsErrorIfNotRecorded() {
        const word = this.currentWords[this.currentIndex];
        // 检查本轮 details 中是否已有该词的记录
        const hasRecord = this.practiceLog.details.some(d => d.wordId === word.id);
        
        if (!hasRecord) {
            const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
            
            this.practiceLog.errorCount++;
            this.practiceLog.wordTimes.push(wordTime);
            this.practiceLog.totalTime += wordTime;
            
            this.practiceLog.details.push({
                wordId: word.id,
                correct: false,
                snapshot: null,
                displayText: '' // 未写
            });
            
            // 记录到错题本
            await this.recordError(word, null);
            
            // 更新任务进度
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
        }
    },

    async handleResult(isCorrect, recognizedWord) {
        const word = this.currentWords[this.currentIndex];
        const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
        
        // 获取当前笔迹截图（可选）
        // const snapshot = Handwriting.getSnapshot(); 
        
        if (isCorrect) {
            // 如果是重做模式下答对的，不增加 correctCount，因为已经记为 error 了
            // 或者：correctCount 记录的是"一次性做对"的数量？
            // 通常：一次做对才算 correct，重做做对不算
            if (!this._isRetryingError) {
                this.practiceLog.correctCount++;
                // 同步到题库管理的掌握状态：记录为已掌握
                if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                    Storage.setWordMasteryStatus(word.id, 'mastered');
                }
            } else {
                // 重做做对了，清除重做标记
                this._isRetryingError = false;
            }

            // 显示反馈：正确
            Handwriting.showFeedback(true);
            
            // 记录日志（如果是非重做模式）
            if (!this._isRetryingError) {
                 this.practiceLog.wordTimes.push(wordTime);
                 this.practiceLog.totalTime += wordTime;
                 this.practiceLog.details.push({
                     wordId: word.id,
                     correct: true,
                     snapshot: null,
                     displayText: recognizedWord
                 });
            }
            
            // 更新任务进度
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
            
            // 延迟后进入下一题
            if (this._nextWordTimer) clearTimeout(this._nextWordTimer);
            this._nextWordTimer = setTimeout(() => {
                this.showNextWord();
                // 重置提交状态
                this.isSubmitting = false;
            }, 1000);
            
        } else {
            // 答错
            
            // 如果允许跳过：记录错题 -> 显示正确答案 -> 下一题
            if (this.allowSkip) {
                 this.practiceLog.errorCount++;
                 this.practiceLog.wordTimes.push(wordTime);
                 this.practiceLog.totalTime += wordTime;
                 
                 this.practiceLog.details.push({
                     wordId: word.id,
                     correct: false,
                     snapshot: null,
                     displayText: recognizedWord
                 });
                 
                 // 记录到错题本
                 await this.recordError(word, recognizedWord);
                 
                 // 同步到题库管理的掌握状态：记录为错题
                 if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                     Storage.setWordMasteryStatus(word.id, 'error');
                 }
                 
                 // 更新任务进度
                if (this.currentTaskId && typeof TaskList !== 'undefined') {
                    this.updateTaskProgress(false);
                }

                 // 显示反馈：错误
                 Handwriting.showFeedback(false);
                 // 显示正确答案
                 Handwriting.showGuide(word.word);
                 
                 // 1秒后下一题
                if (this._nextWordTimer) clearTimeout(this._nextWordTimer);
                 this._nextWordTimer = setTimeout(() => {
                     this.showNextWord();
                     this.isSubmitting = false;
                 }, 1000);
                 
                 return;
            }
            
            // 不允许跳过：进入重做模式
            
            // 记录错题（仅第一次答错时记录）
            if (!this._isRetryingError) {
                 this.practiceLog.errorCount++;
                 this.practiceLog.wordTimes.push(wordTime);
                 this.practiceLog.totalTime += wordTime;
                 
                 this.practiceLog.details.push({
                     wordId: word.id,
                     correct: false,
                     snapshot: null,
                     displayText: recognizedWord
                 });
                 
                 // 记录到错题本
                 await this.recordError(word, recognizedWord);
                 
                 // 同步到题库管理的掌握状态：记录为错题
                 if (typeof Storage !== 'undefined' && Storage.setWordMasteryStatus) {
                     Storage.setWordMasteryStatus(word.id, 'error');
                 }
                 
                 // 更新任务进度
                 if (this.currentTaskId && typeof TaskList !== 'undefined') {
                    this.updateTaskProgress(false);
                 }
            }

            // 显示反馈：错误
            Handwriting.showFeedback(false);
            
            // 标记进入重做模式
            this._isRetryingError = true;
            this.isSubmitting = false; // 允许再次提交
            
            // 显示正确答案轮廓（描红）
            Handwriting.showGuide(word.word);
            
            // 延迟后清空画布让用户重写（保留轮廓）
            if (this._retryClearTimer) clearTimeout(this._retryClearTimer);
            this._retryClearTimer = setTimeout(() => {
                Handwriting.clearStrokesOnly();
                // 重启计时？视需求而定
            }, 1000); // 1秒后清空错误笔迹
        }
    },
    
    async recordError(word, wrongContent) {
        if (typeof Storage !== 'undefined') {
            await Storage.addErrorWord(word, wrongContent);
        }
    },

    showNextWord() {
        this.currentIndex++;
        this.showCurrentWord();
    },

    showPreviousWord() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.showCurrentWord();
        }
    },
    
    // 显示下一题（按钮点击）
    showNextQuestion() {
        this.logDebugEvent('next_question_click');
        
        // 如果正在处理下一题或正在提交，忽略
        if (this.isProcessingNextQuestion || this.isSubmitting) {
            this.logDebugEvent('next_question_blocked', { reason: 'busy' });
            return;
        }
        
        // 如果当前是空画布（相当于点击了下一题但没写字）
        if (typeof Handwriting !== 'undefined' && Handwriting.strokes.length === 0) {
            this.isProcessingNextQuestion = true; // 锁定状态
            this.handleEmptySubmission(); // 复用空提交逻辑（包含重做/跳过逻辑）
            return;
        }
        
        // 如果已经写了字但没提交，相当于提交
        if (typeof Handwriting !== 'undefined' && Handwriting.strokes.length > 0) {
            this.submitAnswer();
        }
    },
    
    // 跳过/不会（按钮点击）
    skipAnswer() {
        this.logDebugEvent('skip_click');
        
        if (this.isProcessingNextQuestion || this.isSubmitting) {
             this.logDebugEvent('skip_blocked', { reason: 'busy' });
             return;
        }
        
        this.isProcessingNextQuestion = true;
        
        // 停止计时
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        
        const word = this.currentWords[this.currentIndex];
        
        // 1. 如果允许跳过：直接算错 -> 下一题
        if (this.allowSkip) {
             this.logDebugEvent('skip_allowed_action');
             
             // 记录错题
             const wordTime = this._currentWordStartTime ? (Date.now() - this._currentWordStartTime) / 1000 : 0;
             this.practiceLog.errorCount++;
             this.practiceLog.wordTimes.push(wordTime);
             this.practiceLog.totalTime += wordTime;
             
             this.practiceLog.details.push({
                 wordId: word.id,
                 correct: false,
                 snapshot: null,
                 displayText: '跳过'
             });
             
             // 记录到错题本
             this.recordError(word, '跳过');
             
             // 更新任务进度
            if (this.currentTaskId && typeof TaskList !== 'undefined') {
                this.updateTaskProgress(false);
            }
             
             // 显示正确答案
             Handwriting.showGuide(word.word);
             
             // 1秒后下一题
             if (this._nextWordTimer) clearTimeout(this._nextWordTimer);
             this._nextWordTimer = setTimeout(() => {
                 this.showNextWord();
                 this.isProcessingNextQuestion = false;
             }, 1000);
             
             return;
        }
        
        // 2. 如果不允许跳过：进入重做模式
        this.logDebugEvent('retry_mode_enter_skip');
        
        // 显示提示
        const feedbackEl = document.getElementById('practice-feedback');
        if (feedbackEl) {
            feedbackEl.textContent = '请抄写正确答案';
            feedbackEl.className = 'text-warning fade-in';
            setTimeout(() => {
                if (feedbackEl) feedbackEl.textContent = '';
            }, 2000);
        }
        
        // 记录错题
        this.recordCurrentAsErrorIfNotRecorded();
        
        // 进入重做
        this._isRetryingError = true;
        this.isProcessingNextQuestion = false; // 解锁，允许提交
        
        // 显示正确答案
        Handwriting.showGuide(word.word);
        Handwriting.clearStrokesOnly();
    },
    
    // 跳过题目（外部调用？）
    skipQuestion() {
        this.skipAnswer();
    },
    
    // 强制跳过（不管设置，用于调试或特殊情况）
    forceSkip() {
         this.showNextWord();
    },

    bindEvents() {
        const pauseBtn = document.getElementById('timer-pause-btn');
        if (pauseBtn) {
            pauseBtn.onclick = () => {
                if (this.isPaused) {
                    this.resume();
                } else {
                    this.pause();
                }
            };
        }
        
        const submitBtn = document.getElementById('submit-answer-btn');
        if (submitBtn) {
            submitBtn.onclick = () => this.submitAnswer();
        }
        
        const skipBtn = document.getElementById('skip-answer-btn');
        if (skipBtn) {
            // 不会/跳过
            skipBtn.onclick = () => this.skipAnswer();
        }
        
        // 更新跳过设置UI状态
        const skipSettingBtn = document.getElementById('skip-setting-btn');
        if (skipSettingBtn) {
            // 这里只做UI初始化，事件绑定在 DOMContentLoaded
        }
        
        // 上一题按钮（调试用或后续功能）
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
    },
    
    // 更新跳过设置UI
    updateSkipSettingUI() {
        const btn = document.getElementById('skip-setting-btn');
        if (btn) {
            if (this.allowSkip) {
                // 允许跳过：绿色勾选，或者普通图标
                btn.innerHTML = '<i class="bi bi-skip-forward"></i>';
                btn.classList.remove('btn-outline-danger');
                btn.classList.add('btn-outline-secondary');
                btn.title = '当前：可以跳过';
            } else {
                // 不允许跳过：红色图标
                btn.innerHTML = '<i class="bi bi-skip-forward-fill text-danger"></i>';
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-outline-danger');
                btn.title = '当前：必须做对';
            }
        }
        
        // 更新菜单项选中状态
        const items = document.querySelectorAll('.skip-option');
        items.forEach(item => {
            const val = item.getAttribute('data-value') === 'true';
            if (val === this.allowSkip) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    },

    cleanupTimers() {
        if (this._nextWordTimer) {
            clearTimeout(this._nextWordTimer);
            this._nextWordTimer = null;
        }
        if (this._retryClearTimer) {
            clearTimeout(this._retryClearTimer);
            this._retryClearTimer = null;
        }
    },
    
    updateTaskProgress(save = true) {
        if (!this.currentTaskId) return;
        
        const progress = Math.floor(((this.currentIndex) / this.currentWords.length) * 100);
        
        // 计算累计正确数和错误数
        // 注意：correctCount 是本轮练习的，需要加上初始的
        const totalCorrect = (this._initialCorrectCount || 0) + this.practiceLog.correctCount;
        
        // 错误单词列表
        // 1. 获取本轮错题
        const currentErrorWords = [];
        this.practiceLog.details.forEach(d => {
            if (!d.correct) {
                const word = this.currentWords.find(w => w.id === d.wordId);
                if (word) currentErrorWords.push(word);
            }
        });
        
        // 2. 合并初始错题（去重）
        const allErrorWords = [...(this._initialErrorWords || [])];
        currentErrorWords.forEach(w => {
            if (!allErrorWords.some(ew => ew.id === w.id)) {
                allErrorWords.push(w);
            }
        });
        
        const updates = {
            progress: progress,
            lastPracticeTime: Date.now(),
            // 更新统计信息
            correctCount: totalCorrect,
            errorCount: allErrorWords.length,
            errorWords: allErrorWords
        };
        
        // 只有当需要保存时才调用 Storage
        // 避免过于频繁写入 localStorage
        if (save && typeof TaskList !== 'undefined') {
            TaskList.updateTask(this.currentTaskId, updates);
        } else if (typeof TaskList !== 'undefined') {
            // 更新内存中的状态，但不写入
            // TaskList.updateTaskMemoryOnly(this.currentTaskId, updates); 
            // 暂时没有 updateTaskMemoryOnly，还是直接写吧，频率也不高（每题一次）
            TaskList.updateTask(this.currentTaskId, updates);
        }
    },
    
    // 保存部分进度（如暂停或退出时）
    savePartialIfActive(isPaused = false) {
        if (this.isActive && this.currentTaskId) {
            this.updateTaskProgress(true);
            
            // 如果暂停，更新状态
            if (isPaused && typeof TaskList !== 'undefined') {
                TaskList.updateTask(this.currentTaskId, {
                    status: TaskList.STATUS.PAUSED
                });
            }
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    // 延迟初始化，确保其他模块已加载
    setTimeout(() => {
        if (typeof Practice !== 'undefined') {
            Practice.init();
        }
    }, 100);
    
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
    const savedSkip = localStorage.getItem('practice_allow_skip');
    if (savedSkip !== null && typeof Practice !== 'undefined') {
        Practice.allowSkip = savedSkip === 'true';
        if (Practice.updateSkipSettingUI) {
            Practice.updateSkipSettingUI();
        }
    }
});