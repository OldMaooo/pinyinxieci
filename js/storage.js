/**
 * 数据存储模块
 * 使用LocalStorage存储所有数据
 */

const Storage = {
    // 存储键名
    KEYS: {
        WORD_BANK: 'wordbank_data',
        PRACTICE_LOGS: 'practice_logs',
        PRACTICE_LOGS_DEBUG: 'practice_logs_debug',
        ERROR_WORDS: 'error_words',
        ERROR_WORDS_DEBUG: 'error_words_debug',
        SETTINGS: 'practice_settings',
        PRACTICE_AUTOSAVE: 'practice_autosave',
        BUILTIN_VERSION: 'builtin_wordbank_version',
        WORD_MASTERY: 'word_mastery_status', // 字的掌握状态：'default' | 'error' | 'mastered'
        REVIEW_PLANS: 'review_plans', // 复习计划
        LOCAL_LAST_MODIFIED: 'local_last_modified' // 本地最后修改时间
    },

    isDebugMode() {
        try {
            return localStorage.getItem('debugMode') === '1';
        } catch (e) {
            return false;
        }
    },
    
    _getList(key) {
        try {
            const data = localStorage.getItem(key);
            if (!data) return [];
            const parsed = JSON.parse(data);
            // 确保返回的是数组
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            console.warn(`[Storage._getList] 解析 ${key} 失败:`, e);
            return [];
        }
    },
    
    _saveList(key, list) {
        localStorage.setItem(key, JSON.stringify(list || []));
        this.updateLocalLastModified();
    },

    /**
     * 更新本地最后修改时间
     */
    updateLocalLastModified() {
        localStorage.setItem(this.KEYS.LOCAL_LAST_MODIFIED, new Date().toISOString());
    },

    /**
     * 获取本地最后修改时间
     */
    getLocalLastModified() {
        return localStorage.getItem(this.KEYS.LOCAL_LAST_MODIFIED);
    },

    /**
     * 初始化数据
     */
    init() {
        // 如果数据不存在，初始化空数据
        if (!this.getWordBank().length) {
            this.saveWordBank([]);
        }
        if (!localStorage.getItem(this.KEYS.PRACTICE_LOGS)) {
            this.savePracticeLogs([]);
        }
        if (!localStorage.getItem(this.KEYS.PRACTICE_LOGS_DEBUG)) {
            this.savePracticeLogs([], { debug: true });
        }
        if (!localStorage.getItem(this.KEYS.ERROR_WORDS)) {
            this.saveErrorWords([]);
        }
        if (!localStorage.getItem(this.KEYS.ERROR_WORDS_DEBUG)) {
            this.saveErrorWords([], { debug: true });
        }
        if (!this.getSettings()) {
            this.saveSettings({
                timeLimitPerWord: 30,
                defaultWordCount: 20,
                recognitionThreshold: 0.85
            });
        }
        if (!localStorage.getItem(this.KEYS.WORD_MASTERY)) {
            this.saveWordMastery({});
        }
        if (!localStorage.getItem(this.KEYS.REVIEW_PLANS)) {
            this.saveAllReviewPlans({});
        }
    },
    
    /**
     * 获取字的掌握状态
     */
    getWordMastery() {
        const data = localStorage.getItem(this.KEYS.WORD_MASTERY);
        return data ? JSON.parse(data) : {};
    },
    
    /**
     * 保存字的掌握状态
     */
    saveWordMastery(masteryStatus) {
        localStorage.setItem(this.KEYS.WORD_MASTERY, JSON.stringify(masteryStatus || {}));
        this.updateLocalLastModified();
        // 标记有待同步的更改（不立即同步，等待练习完成）
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.markPendingSync) {
            SupabaseSync.markPendingSync();
        }
    },
    
    /**
     * 获取单个字的掌握状态
     * @param {string} wordId - 字的ID
     * @returns {string} 'default' | 'error' | 'mastered'
     */
    getWordMasteryStatus(wordId) {
        const mastery = this.getWordMastery();
        return mastery[wordId] || 'default';
    },
    
    /**
     * 设置单个字的掌握状态
     * @param {string} wordId - 字的ID
     * @param {string} status - 'default' | 'error' | 'mastered'
     */
    setWordMasteryStatus(wordId, status) {
        const mastery = this.getWordMastery();
        if (status === 'default') {
            // 删除该记录，使用默认值
            // 但为了在wordbank上下文中能正确显示，我们需要标记为已清除手动设置
            // 使用特殊值 '_cleared' 表示曾经手动设置过但已清除，这样在wordbank中不会回退到自动判断
            // 实际上，删除记录即可，因为wordbank上下文会检查wordMastery[w.id]是否存在
            delete mastery[wordId];
        } else {
            mastery[wordId] = status;
        }
        this.saveWordMastery(mastery);
    },
    
    /**
     * 复习计划管理
     */
    getAllReviewPlans() {
        const data = localStorage.getItem(this.KEYS.REVIEW_PLANS);
        if (!data) return [];
        try {
            const plans = JSON.parse(data);
            if (Array.isArray(plans)) {
                return plans;
            }
            if (typeof plans === 'object' && plans !== null) {
                return Object.values(plans);
            }
            return [];
        } catch (e) {
            console.warn('[Storage.getAllReviewPlans] 解析失败:', e);
            return [];
        }
    },
    
    saveAllReviewPlans(plans) {
        // plans可以是对象（wordId为key）或数组
        let plansObj = {};
        if (Array.isArray(plans)) {
            plans.forEach(plan => {
                if (plan.wordId) {
                    plansObj[plan.wordId] = plan;
                }
            });
        } else {
            plansObj = plans;
        }
        localStorage.setItem(this.KEYS.REVIEW_PLANS, JSON.stringify(plansObj));
        this.updateLocalLastModified();
    },
    
    getReviewPlan(wordId) {
        const plans = this.getAllReviewPlans();
        return plans.find(p => p.wordId === wordId) || null;
    },
    
    saveReviewPlan(plan) {
        if (!plan || !plan.wordId) {
            console.error('[Storage.saveReviewPlan] 无效的计划对象');
            return;
        }
        
        const plans = this.getAllReviewPlans();
        const plansObj = {};
        plans.forEach(p => {
            plansObj[p.wordId] = p;
        });
        plansObj[plan.wordId] = plan;
        this.saveAllReviewPlans(plansObj);
    },
    
    deleteReviewPlan(wordId) {
        const plans = this.getAllReviewPlans();
        const filtered = plans.filter(p => p.wordId !== wordId);
        this.saveAllReviewPlans(filtered);
    },

    /**
     * 题库管理
     */
    getWordBank() {
        const data = localStorage.getItem(this.KEYS.WORD_BANK);
        return data ? JSON.parse(data) : [];
    },

    saveWordBank(wordBank) {
        // 确保保存后三年级上册内置题库仍然存在
        const saved = wordBank || [];
        localStorage.setItem(this.KEYS.WORD_BANK, JSON.stringify(saved));
        this.updateLocalLastModified();
        
        // 异步检查并恢复三年级上册内置题库（如果缺失）
        setTimeout(() => {
            this._ensureGrade3UpBuiltinWordBank();
        }, 100);
    },

    addWord(word) {
        const text = (word && word.word) ? String(word.word).trim() : '';
        if (text.length === 1) {
            console.warn('[Storage.addWord] ⚠️ 正在写入单字词条', {
                word: text,
                grade: word.grade,
                semester: word.semester,
                unit: word.unit
            });
        }
        
        // 如果是三年级上册的字，不允许用户手动添加（只能通过内置题库加载）
        if (word.grade === 3 && (word.semester === '上' || word.semester === '上册') && !word.isBuiltIn && word.source !== 'builtin') {
            console.warn('[Storage.addWord] 三年级上册的字只能通过内置题库加载，不允许用户手动添加:', text);
            // 检查是否已存在于内置题库中
            const existingBuiltin = this.getWordBank().find(w => 
                w.word === word.word && 
                w.grade === 3 && 
                (w.semester === '上' || w.semester === '上册') &&
                this.isBuiltinWord(w)
            );
            if (existingBuiltin) {
                return existingBuiltin;
            }
            // 如果内置题库中没有，可能是内置题库未加载，允许添加但标记为内置
            word.isBuiltIn = true;
            word.source = 'builtin';
        }
        
        const wordBank = this.getWordBank();
        // 检查是否已存在
        const exists = wordBank.find(w => 
            w.word === word.word && 
            w.grade === word.grade && 
            w.semester === word.semester && 
            w.unit === word.unit
        );
        
        if (!exists) {
            const newWord = {
                id: `word_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                ...word,
                isBuiltIn: !!word.isBuiltIn,
                source: word.source || (word.isBuiltIn ? 'builtin' : 'user'),
                addedDate: new Date().toISOString()
            };
            wordBank.push(newWord);
            this.saveWordBank(wordBank);
            return newWord;
        }
        return exists;
    },

    /**
     * 练习记录管理
     */
    getPracticeLogs(options = {}) {
        const debug = options.debug === true;
        const key = debug ? this.KEYS.PRACTICE_LOGS_DEBUG : this.KEYS.PRACTICE_LOGS;
        return this._getList(key);
    },

    /**
     * 获取练习记录（根据当前调试模式过滤）
     * - 调试模式关闭时：自动过滤掉 isDebug=true 的记录
     * - 调试模式开启时：返回全部记录
     */
    getPracticeLogsFiltered() {
        const logs = this.getPracticeLogs();
        if (!this.isDebugMode()) {
            return logs;
        }
        const debugLogs = this.getPracticeLogs({ debug: true }).map(log => ({
            ...log,
            isDebug: true
        }));
        return [...logs, ...debugLogs];
    },

    savePracticeLogs(logs, options = {}) {
        const debug = options.debug === true;
        const key = debug ? this.KEYS.PRACTICE_LOGS_DEBUG : this.KEYS.PRACTICE_LOGS;
        this._saveList(key, logs);
    },

    addPracticeLog(log) {
        const useDebug = log?.isDebug || this.isDebugMode();
        const logs = this.getPracticeLogs({ debug: useDebug });
        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            ...log,
            isDebug: !!useDebug
        };
        logs.push(newLog);
        this.savePracticeLogs(logs, { debug: useDebug });
        return newLog;
    },

    // 练习自动保存草稿
    setPracticeAutosave(draft) {
        try { localStorage.setItem(this.KEYS.PRACTICE_AUTOSAVE, JSON.stringify(draft)); } catch(e) {}
    },
    getPracticeAutosave() {
        try { return JSON.parse(localStorage.getItem(this.KEYS.PRACTICE_AUTOSAVE) || 'null'); } catch(e) { return null; }
    },
    clearPracticeAutosave() {
        try { localStorage.removeItem(this.KEYS.PRACTICE_AUTOSAVE); } catch(e) {}
    },

    /**
     * 错题管理
     */
    _getErrorWordsStore(debug = false) {
        const key = debug ? this.KEYS.ERROR_WORDS_DEBUG : this.KEYS.ERROR_WORDS;
        return this._getList(key);
    },
    
    getErrorWords(options = {}) {
        const result = this._getErrorWordsStore(options.debug === true);
        // 确保返回的是数组
        return Array.isArray(result) ? result : [];
    },

    getErrorWordsFiltered() {
        const normal = this._getErrorWordsStore(false);
        if (!this.isDebugMode()) {
            return normal;
        }
        const debugErrors = this._getErrorWordsStore(true).map(err => ({
            ...err,
            isDebug: true
        }));
        return [...normal, ...debugErrors];
    },

    saveErrorWords(errorWords, options = {}) {
        const debug = options.debug === true;
        const key = debug ? this.KEYS.ERROR_WORDS_DEBUG : this.KEYS.ERROR_WORDS;
        this._saveList(key, errorWords);
        // 标记有待同步的更改（不立即同步，等待练习完成）
        if (typeof SupabaseSync !== 'undefined' && SupabaseSync.markPendingSync) {
            SupabaseSync.markPendingSync();
        }
    },

    addErrorWord(wordId, word, pinyin, snapshot, roundId = null) {
        const useDebug = this.isDebugMode();
        const errorWords = this.getErrorWords({ debug: useDebug });
        let errorWord = errorWords.find(ew => ew.wordId === wordId);
        
        const snapshotData = snapshot ? {
            practiceId: roundId || `log_${Date.now()}`,
            snapshot: snapshot,
            date: new Date().toISOString()
        } : null;

        const now = new Date().toISOString();
        if (errorWord) {
            // 更新已有错题
            errorWord.lastErrorDate = now;
            errorWord.errorCount += 1;
            // 如果还没有markedAt，添加它（用于复习计划）
            if (!errorWord.markedAt) {
                errorWord.markedAt = errorWord.firstErrorDate || now;
            }
            // 如果提供了roundId，更新或添加roundId
            if (roundId) {
                errorWord.roundId = roundId;
            }
            // 只保留第一次写错的快照，不更新已有快照
            // 如果已有快照，就不添加新快照（无论是答对还是答错）
            if (snapshotData) {
                errorWord.handwritingSnapshots = errorWord.handwritingSnapshots || [];
                // 只有在还没有快照的情况下，才添加快照（保留第一次写错的字迹）
                if (errorWord.handwritingSnapshots.length === 0) {
                    errorWord.handwritingSnapshots.push(snapshotData);
                }
            }
        } else {
            // 创建新错题记录
            errorWord = {
                wordId: wordId,
                word: word,
                pinyin: pinyin,
                markedAt: now, // 用于复习计划
                firstErrorDate: now,
                lastErrorDate: now,
                errorCount: 1,
                roundId: roundId || null, // 添加roundId字段
                handwritingSnapshots: snapshotData ? [snapshotData] : []
            };
            errorWords.push(errorWord);
        }
        
        this.saveErrorWords(errorWords, { debug: useDebug });
        return errorWord;
    },
    
    /**
     * 保存错题到指定轮次（用于按轮视图）
     */
    saveErrorWordsForRound(roundId, errorWords) {
        if (!roundId) return;
        const useDebug = this.isDebugMode();
        const allErrorWords = this.getErrorWords({ debug: useDebug });
        // 移除该轮次的其他错题
        const others = allErrorWords.filter(item => item.roundId !== roundId);
        // 为新错题添加roundId
        const newErrorWords = errorWords.map(ew => ({
            ...ew,
            roundId: roundId
        }));
        // 合并保存
        this.saveErrorWords([...others, ...newErrorWords], { debug: useDebug });
    },

    removeErrorWord(wordId) {
        let updated = false;
        const errorWords = this.getErrorWords();
        const filtered = errorWords.filter(ew => ew.wordId !== wordId);
        if (filtered.length !== errorWords.length) {
        this.saveErrorWords(filtered);
            updated = true;
        }
        const debugErrors = this.getErrorWords({ debug: true });
        const filteredDebug = debugErrors.filter(ew => ew.wordId !== wordId);
        if (filteredDebug.length !== debugErrors.length) {
            this.saveErrorWords(filteredDebug, { debug: true });
            updated = true;
        }
        return updated;
    },

    /**
     * 设置管理
     */
    getSettings() {
        const data = localStorage.getItem(this.KEYS.SETTINGS);
        return data ? JSON.parse(data) : {};
    },

    saveSettings(settings) {
        localStorage.setItem(this.KEYS.SETTINGS, JSON.stringify(settings));
    },

    /**
     * 导出所有数据
     */
    exportAll() {
        return {
            version: "1.1", // 升级版本号，包含新字段
            exportDate: new Date().toISOString(),
            wordBank: this.getWordBank(),
            practiceLogs: this.getPracticeLogs(),
            practiceLogsDebug: this.getPracticeLogs({ debug: true }),
            errorWords: this.getErrorWords(),
            errorWordsDebug: this.getErrorWords({ debug: true }),
            wordMastery: this.getWordMastery(), // 掌握状态（已掌握/错题/未练习）
            reviewPlans: this.getAllReviewPlans(), // 复习计划
            taskList: typeof TaskList !== 'undefined' ? TaskList.getAllTasks() : [], // 任务列表
            settings: this.getSettings()
        };
    },
    
    /**
     * 导出同步数据（轻量级，只包含需要同步的数据）
     * 包含：掌握状态、错题、复习计划、任务列表
     * 不包含：题库、练习记录（这些数据较大，且通常不需要同步）
     */
    exportSyncData() {
        // 获取所有掌握状态（包括已掌握、错题、未练习）
        // 注意：'default' 状态的字在 wordMastery 中不存在（被删除了），所以只导出明确设置的状态
        const wordMastery = this.getWordMastery();
        
        // 为了完整性，我们也可以导出所有字的状态（包括未练习的）
        // 但为了保持轻量级，这里只导出明确设置的状态
        // 如果需要导出所有字的状态，可以遍历 wordBank 并添加默认状态
        return {
            version: "1.1",
            type: "sync", // 标记为同步数据
            exportDate: new Date().toISOString(),
            wordBank: this.getWordBank(), // 题库数据（确保所有设备题库一致）
            wordMastery: wordMastery, // 掌握状态（已掌握/错题，不包含未练习的，因为未练习的会被删除）
            errorWords: this.getErrorWords(), // 错题
            reviewPlans: this.getAllReviewPlans(), // 复习计划
            taskList: typeof TaskList !== 'undefined' ? TaskList.getAllTasks() : [] // 任务列表
        };
    },

    /**
     * 导入数据
     */
    importAll(data, merge = false) {
        if (!data || !data.version) {
            throw new Error('无效的数据格式，需要包含 version 字段');
        }

        if (merge) {
            // 合并模式：保留现有数据，合并新数据
            const existingWordBank = this.getWordBank();
            // 确保 existingWordBank 是数组
            const newWordBank = Array.isArray(existingWordBank) ? [...existingWordBank] : [];
            
            // 合并题库（去重）
            if (data.wordBank && Array.isArray(data.wordBank)) {
                data.wordBank.forEach(word => {
                    const exists = newWordBank.find(w => 
                        w.word === word.word && 
                        w.grade === word.grade && 
                        w.semester === word.semester && 
                        w.unit === word.unit
                    );
                    if (!exists) {
                        newWordBank.push(word);
                    }
                });
            }
            
            this.saveWordBank(newWordBank);
            
            // 合并练习记录（保留所有记录）
            if (data.practiceLogs && Array.isArray(data.practiceLogs)) {
                const existingLogs = this.getPracticeLogs();
                const combinedLogs = [...existingLogs];
                
                // 按ID去重，避免重复导入
                const existingIds = new Set(existingLogs.map(log => log.id));
                data.practiceLogs.forEach(log => {
                    if (!existingIds.has(log.id)) {
                        combinedLogs.push(log);
                    }
                });
                
                // 按日期排序
                combinedLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
                this.savePracticeLogs(combinedLogs);
            }
            
            if (data.practiceLogsDebug && Array.isArray(data.practiceLogsDebug)) {
                const existingDebugLogs = this.getPracticeLogs({ debug: true });
                const combinedDebugLogs = [...existingDebugLogs];
                const debugIds = new Set(existingDebugLogs.map(log => log.id));
                data.practiceLogsDebug.forEach(log => {
                    if (!debugIds.has(log.id)) {
                        combinedDebugLogs.push({ ...log, isDebug: true });
                    }
                });
                combinedDebugLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
                this.savePracticeLogs(combinedDebugLogs, { debug: true });
            }
            
            // 合并错题（合并相同字的错题记录）
            if (data.errorWords && Array.isArray(data.errorWords)) {
                const existingErrors = this.getErrorWords();
                const errorMap = new Map();
                
                // 先添加现有错题
                existingErrors.forEach(error => {
                    errorMap.set(error.wordId, error);
                });
                
                // 合并新错题
                data.errorWords.forEach(error => {
                    const existing = errorMap.get(error.wordId);
                    if (existing) {
                        // 合并错误次数和快照
                        existing.errorCount = Math.max(existing.errorCount, error.errorCount);
                        if (error.lastErrorDate && new Date(error.lastErrorDate) > new Date(existing.lastErrorDate)) {
                            existing.lastErrorDate = error.lastErrorDate;
                        }
                        // 合并快照（去重）
                        if (error.handwritingSnapshots) {
                            const snapshotMap = new Map();
                            existing.handwritingSnapshots?.forEach(s => {
                                snapshotMap.set(s.date, s);
                            });
                            error.handwritingSnapshots.forEach(s => {
                                if (!snapshotMap.has(s.date)) {
                                    snapshotMap.set(s.date, s);
                                }
                            });
                            existing.handwritingSnapshots = Array.from(snapshotMap.values());
                        }
                    } else {
                        errorMap.set(error.wordId, error);
                    }
                });
                
                this.saveErrorWords(Array.from(errorMap.values()));
            }
            
            if (data.errorWordsDebug && Array.isArray(data.errorWordsDebug)) {
                const existingDebugErrors = this.getErrorWords({ debug: true });
                const errorMapDebug = new Map(existingDebugErrors.map(error => [error.wordId, error]));
                
                data.errorWordsDebug.forEach(error => {
                    const existing = errorMapDebug.get(error.wordId);
                    if (existing) {
                        existing.errorCount = Math.max(existing.errorCount, error.errorCount);
                        if (error.lastErrorDate && new Date(error.lastErrorDate) > new Date(existing.lastErrorDate)) {
                            existing.lastErrorDate = error.lastErrorDate;
                        }
                        if (error.handwritingSnapshots) {
                            existing.handwritingSnapshots = existing.handwritingSnapshots || [];
                            const snapshotMap = new Map();
                            existing.handwritingSnapshots.forEach(s => snapshotMap.set(s.date, s));
                            error.handwritingSnapshots.forEach(s => {
                                if (!snapshotMap.has(s.date)) {
                                    snapshotMap.set(s.date, s);
                                }
                            });
                            existing.handwritingSnapshots = Array.from(snapshotMap.values());
                        }
                    } else {
                        errorMapDebug.set(error.wordId, error);
                    }
                });
                
                this.saveErrorWords(Array.from(errorMapDebug.values()), { debug: true });
            }
        } else {
            // 替换模式：清空现有数据，使用新数据
            if (data.wordBank && Array.isArray(data.wordBank)) {
                this.saveWordBank(data.wordBank);
            }
            if (data.practiceLogs && Array.isArray(data.practiceLogs)) {
                this.savePracticeLogs(data.practiceLogs);
            } else {
                this.savePracticeLogs([]);
            }
            if (data.practiceLogsDebug && Array.isArray(data.practiceLogsDebug)) {
                this.savePracticeLogs(data.practiceLogsDebug, { debug: true });
            } else {
                this.savePracticeLogs([], { debug: true });
            }
            if (data.errorWords && Array.isArray(data.errorWords)) {
                this.saveErrorWords(data.errorWords);
            } else {
                this.saveErrorWords([]);
            }
            if (data.errorWordsDebug && Array.isArray(data.errorWordsDebug)) {
                this.saveErrorWords(data.errorWordsDebug, { debug: true });
            } else {
                this.saveErrorWords([], { debug: true });
            }
        }
        
        // 导入掌握状态（wordMastery）
        if (data.wordMastery && typeof data.wordMastery === 'object') {
            if (merge) {
                // 合并模式：合并掌握状态
                const existing = this.getWordMastery();
                Object.assign(existing, data.wordMastery);
                this.saveWordMastery(existing);
            } else {
                // 替换模式：直接替换
                this.saveWordMastery(data.wordMastery);
            }
        }
        
        // 导入复习计划（reviewPlans）
        if (data.reviewPlans) {
            if (merge) {
                // 合并模式：合并复习计划
                const existing = this.getAllReviewPlans();
                const existingObj = {};
                existing.forEach(p => { if (p.wordId) existingObj[p.wordId] = p; });
                const newPlans = Array.isArray(data.reviewPlans) ? data.reviewPlans : Object.values(data.reviewPlans);
                newPlans.forEach(p => { if (p.wordId) existingObj[p.wordId] = p; });
                this.saveAllReviewPlans(existingObj);
            } else {
                // 替换模式：直接替换
                this.saveAllReviewPlans(data.reviewPlans);
            }
        }
        
        // 导入任务列表（taskList）
        if (data.taskList && Array.isArray(data.taskList)) {
            if (typeof TaskList !== 'undefined' && TaskList.saveAllTasks) {
                if (merge) {
                    // 合并模式：合并任务列表（去重）
                    const existing = TaskList.getAllTasks();
                    const existingIds = new Set(existing.map(t => t.id));
                    const newTasks = data.taskList.filter(t => !existingIds.has(t.id));
                    TaskList.saveAllTasks([...existing, ...newTasks]);
                } else {
                    // 替换模式：直接替换
                    TaskList.saveAllTasks(data.taskList);
                }
            }
        }
        
        // 设置总是替换（不合并）
        if (data.settings) {
            this.saveSettings(data.settings);
        }
    },
    
    /**
     * 导入同步数据（轻量级，只导入需要同步的数据）
     */
    importSyncData(data, merge = false) {
        if (!data || !data.version) {
            throw new Error('无效的数据格式，需要包含 version 字段');
        }
        
        if (data.type !== 'sync') {
            console.warn('[Storage.importSyncData] 数据格式不是同步数据，尝试导入...');
        }
        
        console.log('[Storage.importSyncData] 开始导入，模式:', merge ? '合并' : '覆盖', {
            hasWordBank: !!data.wordBank,
            hasWordMastery: !!data.wordMastery,
            hasErrorWords: !!data.errorWords,
            hasReviewPlans: !!data.reviewPlans,
            hasTaskList: !!data.taskList
        });
        
        // 导入题库（wordBank）- 确保所有设备题库一致
        // 注意：内置题库（特别是三年级上册）不会被覆盖，会在导入后强制恢复
        if (data.wordBank && Array.isArray(data.wordBank)) {
            // 先保存现有的内置题库（特别是三年级上册）
            const existingWordBank = this.getWordBank();
            const builtinWords = existingWordBank.filter(word => this.isBuiltinWord(word));
            
            if (merge) {
                // 合并模式：合并题库（去重），但排除内置字
                const userWords = existingWordBank.filter(word => !this.isBuiltinWord(word));
                const newWordBank = [...userWords];
                
                data.wordBank.forEach(word => {
                    // 跳过内置字，不允许通过同步覆盖
                    if (this.isBuiltinWord(word)) {
                        console.log('[Storage.importSyncData] 跳过内置字:', word.word);
                        return;
                    }
                    const exists = newWordBank.find(w => 
                        w.word === word.word && 
                        w.grade === word.grade && 
                        w.semester === word.semester && 
                        w.unit === word.unit
                    );
                    if (!exists) {
                        newWordBank.push(word);
                    }
                });
                // 合并内置题库
                this.saveWordBank([...builtinWords, ...newWordBank]);
            } else {
                // 覆盖模式：替换用户题库，但保留内置题库
                const userWordsFromData = data.wordBank.filter(word => !this.isBuiltinWord(word));
                this.saveWordBank([...builtinWords, ...userWordsFromData]);
                console.log('[Storage.importSyncData] 覆盖模式：已保留内置题库，只替换用户题库');
            }
            
            // 导入后强制恢复三年级上册内置题库
            this._ensureGrade3UpBuiltinWordBank();
        } else if (!merge) {
            // 覆盖模式且没有题库数据，保持现有题库不变（避免清空）
            console.log('[Storage.importSyncData] 覆盖模式：导入数据中没有题库，保持现有题库不变');
            // 确保内置题库存在
            this._ensureGrade3UpBuiltinWordBank();
        }
        
        // 导入掌握状态
        if (merge) {
            // 合并模式：合并到现有数据
            if (data.wordMastery && typeof data.wordMastery === 'object') {
                const existing = this.getWordMastery();
                Object.assign(existing, data.wordMastery);
                this.saveWordMastery(existing);
            }
        } else {
            // 覆盖模式：完全替换
            if (data.wordMastery && typeof data.wordMastery === 'object') {
                // 完全替换
                this.saveWordMastery(data.wordMastery);
            } else {
                // 如果导入数据中没有 wordMastery，清空现有数据
                console.log('[Storage.importSyncData] 覆盖模式：导入数据中没有 wordMastery，清空现有掌握状态');
                this.saveWordMastery({});
            }
        }
        
        // 从wordMastery中提取标记为error的条目，构建errorWords数组
        const errorWordsFromMastery = [];
        if (data.wordMastery && typeof data.wordMastery === 'object') {
            const wordBank = this.getWordBank();
            // 确保 wordBank 是数组
            if (Array.isArray(wordBank)) {
                Object.entries(data.wordMastery).forEach(([wordId, status]) => {
                    if (status === 'error') {
                        // 查找对应的字信息
                        const word = wordBank.find(w => w.id === wordId);
                        if (word) {
                            errorWordsFromMastery.push({
                                wordId: wordId,
                                word: word.word,
                                pinyin: word.pinyin || '',
                                errorCount: 1,
                                firstErrorDate: new Date().toISOString(),
                                lastErrorDate: new Date().toISOString(),
                                handwritingSnapshots: []
                            });
                        }
                    }
                });
            } else {
                console.warn('[Storage.importSyncData] wordBank 不是数组，跳过从 wordMastery 提取错题');
            }
        }
        
        // 导入错题（合并模式会去重）
        const allErrorWords = [];
        if (data.errorWords && Array.isArray(data.errorWords)) {
            allErrorWords.push(...data.errorWords);
        }
        // 合并从wordMastery中提取的错题
        if (errorWordsFromMastery.length > 0) {
            const errorMap = new Map();
            // 确保 allErrorWords 是数组
            if (Array.isArray(allErrorWords)) {
                allErrorWords.forEach(error => {
                    if (error && error.wordId) {
                        errorMap.set(error.wordId, error);
                    }
                });
            }
            errorWordsFromMastery.forEach(error => {
                if (!error || !error.wordId) return;
                const existing = errorMap.get(error.wordId);
                if (existing) {
                    // 如果已存在，保留原有数据（可能有快照等更多信息）
                    // 只更新日期
                    if (error.lastErrorDate && new Date(error.lastErrorDate) > new Date(existing.lastErrorDate)) {
                        existing.lastErrorDate = error.lastErrorDate;
                    }
                } else {
                    errorMap.set(error.wordId, error);
                }
            });
            allErrorWords.length = 0;
            allErrorWords.push(...Array.from(errorMap.values()));
        }
        
        if (merge) {
            // 合并模式：合并错题
            if (allErrorWords.length > 0) {
                const existing = this.getErrorWords();
                // 确保 existing 是数组
                if (!Array.isArray(existing)) {
                    console.warn('[Storage.importSyncData] existing errorWords 不是数组，使用空数组');
                    const errorMap = new Map();
                    allErrorWords.forEach(error => {
                        if (error && error.wordId) {
                            errorMap.set(error.wordId, error);
                        }
                    });
                    this.saveErrorWords(Array.from(errorMap.values()));
                } else {
                    const errorMap = new Map(existing.map(error => [error.wordId, error]));
                    allErrorWords.forEach(error => {
                        if (!error || !error.wordId) return;
                        const existing = errorMap.get(error.wordId);
                        if (existing) {
                            // 合并：保留错误次数更大的
                            existing.errorCount = Math.max(existing.errorCount || 0, error.errorCount || 0);
                            if (error.lastErrorDate && new Date(error.lastErrorDate) > new Date(existing.lastErrorDate || 0)) {
                                existing.lastErrorDate = error.lastErrorDate;
                            }
                        } else {
                            errorMap.set(error.wordId, error);
                        }
                    });
                    this.saveErrorWords(Array.from(errorMap.values()));
                }
            }
        } else {
            // 覆盖模式：完全替换错题列表
            if (allErrorWords.length > 0) {
                this.saveErrorWords(allErrorWords);
            } else {
                // 如果导入数据中没有错题，清空现有错题列表
                console.log('[Storage.importSyncData] 覆盖模式：导入数据中没有错题，清空现有错题列表');
                this.saveErrorWords([]);
            }
        }
        
        // 导入复习计划
        if (merge) {
            // 合并模式：合并复习计划
            if (data.reviewPlans) {
                const existing = this.getAllReviewPlans();
                const existingObj = {};
                if (Array.isArray(existing)) {
                    existing.forEach(p => { if (p.wordId) existingObj[p.wordId] = p; });
                }
                const newPlans = Array.isArray(data.reviewPlans) ? data.reviewPlans : (typeof data.reviewPlans === 'object' ? Object.values(data.reviewPlans) : []);
                if (Array.isArray(newPlans)) {
                    newPlans.forEach(p => { if (p.wordId) existingObj[p.wordId] = p; });
                }
                this.saveAllReviewPlans(existingObj);
            }
        } else {
            // 覆盖模式：完全替换复习计划
            if (data.reviewPlans) {
                if (Array.isArray(data.reviewPlans)) {
                    this.saveAllReviewPlans(data.reviewPlans);
                } else if (typeof data.reviewPlans === 'object') {
                    this.saveAllReviewPlans(data.reviewPlans);
                } else {
                    console.warn('[Storage.importSyncData] reviewPlans 格式不正确，跳过导入');
                }
            } else {
                // 如果导入数据中没有复习计划，清空现有复习计划
                console.log('[Storage.importSyncData] 覆盖模式：导入数据中没有复习计划，清空现有复习计划');
                this.saveAllReviewPlans({});
            }
        }
        
        // 导入任务列表
        if (typeof TaskList !== 'undefined' && TaskList.saveAllTasks) {
            if (merge) {
                // 合并模式：合并任务列表
                if (data.taskList && Array.isArray(data.taskList)) {
                    const existing = TaskList.getAllTasks();
                    const existingIds = new Set(existing.map(t => t.id));
                    const newTasks = data.taskList.filter(t => !existingIds.has(t.id));
                    TaskList.saveAllTasks([...existing, ...newTasks]);
                }
            } else {
                // 覆盖模式：完全替换任务列表
                if (data.taskList && Array.isArray(data.taskList)) {
                    TaskList.saveAllTasks(data.taskList);
                } else {
                    // 如果导入数据中没有任务列表，清空现有任务列表
                    console.log('[Storage.importSyncData] 覆盖模式：导入数据中没有任务列表，清空现有任务列表');
                    TaskList.saveAllTasks([]);
                }
            }
        }
        
        // 更新本地修改时间
        this.updateLocalLastModified();
        
        console.log('[Storage.importSyncData] 导入完成');
    },

    /**
     * 内置题库管理
     */
    getBuiltinWordBankVersion() {
        return localStorage.getItem(this.KEYS.BUILTIN_VERSION) || null;
    },

    setBuiltinWordBankVersion(version) {
        if (!version) {
            localStorage.removeItem(this.KEYS.BUILTIN_VERSION);
            return;
        }
        localStorage.setItem(this.KEYS.BUILTIN_VERSION, version);
    },

    isBuiltinWord(word) {
        if (!word) return false;
        if (word.isBuiltIn) return true;
        if (word.source === 'builtin') return true;
        if (typeof word.id === 'string' && /年级/.test(word.id)) {
            return true;
        }
        return false;
    },

    hasBuiltinWordBank() {
        return this.getWordBank().some(word => this.isBuiltinWord(word));
    },

    importBuiltinWordBank(words = [], metadata = {}) {
        console.log('[Storage] importBuiltinWordBank start', {
            incomingCount: words.length,
            metadata
        });
        const current = this.getWordBank();
        const userWords = current.filter(word => !this.isBuiltinWord(word));
        console.log('[Storage] existing wordBank统计', {
            total: current.length,
            builtin: current.length - userWords.length,
            user: userWords.length
        });
        const normalized = words.map((word, index) => ({
            id: word.id || `builtin_${index}_${word.word}`,
            word: word.word,
            pinyin: word.pinyin || '',
            grade: word.grade || 3,
            semester: word.semester || '上',
            unit: typeof word.unit === 'number' ? word.unit : word.unit ?? null,
            unitLabel: word.unitLabel || '',
            unitOrder: typeof word.unitOrder === 'number'
                ? word.unitOrder
                : (typeof word.unit === 'number' ? word.unit : null),
            sectionType: word.sectionType || '',
            sourceTitle: word.sourceTitle || '',
            isBuiltIn: true,
            source: 'builtin',
            builtinVersion: metadata.version || metadata.buildDate || 'unknown',
            addedDate: new Date().toISOString()
        }));
        normalized.forEach(entry => {
            const text = entry.word ? String(entry.word).trim() : '';
            if (text.length === 1) {
                console.warn('[Storage.importBuiltinWordBank] ⚠️ 导入单字词条', {
                    word: text,
                    grade: entry.grade,
                    semester: entry.semester,
                    unit: entry.unit,
                    unitLabel: entry.unitLabel
                });
            }
        });
        const merged = [...userWords, ...normalized];
        this.saveWordBank(merged);
        const versionToken = metadata.version || metadata.buildDate || `len-${normalized.length}`;
        this.setBuiltinWordBankVersion(versionToken);
        console.log('[Storage] importBuiltinWordBank 完成', {
            mergedCount: merged.length,
            builtinVersion: versionToken
        });
    },


    resetBuiltinWordBank() {
        console.log('[Storage] resetBuiltinWordBank -> 清空内置题库并保留自定义词库');
        const current = this.getWordBank();
        const userWords = current.filter(word => !this.isBuiltinWord(word));
        this.saveWordBank(userWords);
        try {
            localStorage.removeItem(this.KEYS.BUILTIN_VERSION);
            localStorage.removeItem('practiceRangeSelection');
            localStorage.removeItem('practice_error_word_ids');
        } catch (err) {
            console.warn('[Storage] resetBuiltinWordBank 清理本地记录失败:', err);
        }
        console.log('[Storage] resetBuiltinWordBank 完成', {
            userWords: userWords.length
        });
        setTimeout(() => {
            if (typeof InitData !== 'undefined' && typeof InitData.loadDefaultWordBank === 'function') {
                console.log('[Storage] resetBuiltinWordBank -> 触发 InitData.loadDefaultWordBank(storage-reset)');
                InitData.loadDefaultWordBank('storage-reset').catch(err => {
                    console.error('[Storage] storage-reset 自动导入失败:', err);
                });
            } else {
                console.warn('[Storage] resetBuiltinWordBank -> InitData 不可用，无法自动导入默认题库');
            }
        }, 50);
    }
};

// 初始化
Storage.init();
