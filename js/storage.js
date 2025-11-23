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
        BUILTIN_VERSION: 'builtin_wordbank_version'
    },

    isDebugMode() {
        try {
            return localStorage.getItem('debugMode') === '1';
        } catch (e) {
            return false;
        }
    },
    
    _getList(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : [];
    },
    
    _saveList(key, list) {
        localStorage.setItem(key, JSON.stringify(list || []));
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
    },

    /**
     * 题库管理
     */
    getWordBank() {
        const data = localStorage.getItem(this.KEYS.WORD_BANK);
        return data ? JSON.parse(data) : [];
    },

    saveWordBank(wordBank) {
        localStorage.setItem(this.KEYS.WORD_BANK, JSON.stringify(wordBank || []));
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
        return this._getErrorWordsStore(options.debug === true);
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
    },

    addErrorWord(wordId, word, pinyin, snapshot) {
        const useDebug = this.isDebugMode();
        const errorWords = this.getErrorWords({ debug: useDebug });
        let errorWord = errorWords.find(ew => ew.wordId === wordId);
        
        const snapshotData = snapshot ? {
            practiceId: `log_${Date.now()}`,
            snapshot: snapshot,
            date: new Date().toISOString()
        } : null;

        if (errorWord) {
            // 更新已有错题
            errorWord.lastErrorDate = new Date().toISOString();
            errorWord.errorCount += 1;
            if (snapshotData) {
                errorWord.handwritingSnapshots = errorWord.handwritingSnapshots || [];
            errorWord.handwritingSnapshots.push(snapshotData);
            }
        } else {
            // 创建新错题记录
            errorWord = {
                wordId: wordId,
                word: word,
                pinyin: pinyin,
                firstErrorDate: new Date().toISOString(),
                lastErrorDate: new Date().toISOString(),
                errorCount: 1,
                handwritingSnapshots: snapshotData ? [snapshotData] : []
            };
            errorWords.push(errorWord);
        }
        
        this.saveErrorWords(errorWords, { debug: useDebug });
        return errorWord;
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
            version: "1.0",
            exportDate: new Date().toISOString(),
            wordBank: this.getWordBank(),
            practiceLogs: this.getPracticeLogs(),
            practiceLogsDebug: this.getPracticeLogs({ debug: true }),
            errorWords: this.getErrorWords(),
            errorWordsDebug: this.getErrorWords({ debug: true }),
            settings: this.getSettings()
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
            const newWordBank = [...existingWordBank];
            
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
        
        // 设置总是替换（不合并）
        if (data.settings) {
            this.saveSettings(data.settings);
        }
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
