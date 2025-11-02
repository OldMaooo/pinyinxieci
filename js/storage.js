/**
 * 数据存储模块
 * 使用LocalStorage存储所有数据
 */

const Storage = {
    // 存储键名
    KEYS: {
        WORD_BANK: 'wordbank_data',
        PRACTICE_LOGS: 'practice_logs',
        ERROR_WORDS: 'error_words',
        SETTINGS: 'practice_settings'
    },

    /**
     * 初始化数据
     */
    init() {
        // 如果数据不存在，初始化空数据
        if (!this.getWordBank().length) {
            this.saveWordBank([]);
        }
        if (!this.getPracticeLogs()) {
            this.savePracticeLogs([]);
        }
        if (!this.getErrorWords()) {
            this.saveErrorWords([]);
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
        localStorage.setItem(this.KEYS.WORD_BANK, JSON.stringify(wordBank));
    },

    addWord(word) {
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
    getPracticeLogs() {
        const data = localStorage.getItem(this.KEYS.PRACTICE_LOGS);
        return data ? JSON.parse(data) : [];
    },

    savePracticeLogs(logs) {
        localStorage.setItem(this.KEYS.PRACTICE_LOGS, JSON.stringify(logs));
    },

    addPracticeLog(log) {
        const logs = this.getPracticeLogs();
        const newLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            ...log
        };
        logs.push(newLog);
        this.savePracticeLogs(logs);
        return newLog;
    },

    /**
     * 错题管理
     */
    getErrorWords() {
        const data = localStorage.getItem(this.KEYS.ERROR_WORDS);
        return data ? JSON.parse(data) : [];
    },

    saveErrorWords(errorWords) {
        localStorage.setItem(this.KEYS.ERROR_WORDS, JSON.stringify(errorWords));
    },

    addErrorWord(wordId, word, pinyin, snapshot) {
        const errorWords = this.getErrorWords();
        let errorWord = errorWords.find(ew => ew.wordId === wordId);
        
        const snapshotData = {
            practiceId: `log_${Date.now()}`,
            snapshot: snapshot,
            date: new Date().toISOString()
        };

        if (errorWord) {
            // 更新已有错题
            errorWord.lastErrorDate = new Date().toISOString();
            errorWord.errorCount += 1;
            errorWord.handwritingSnapshots.push(snapshotData);
        } else {
            // 创建新错题记录
            errorWord = {
                wordId: wordId,
                word: word,
                pinyin: pinyin,
                firstErrorDate: new Date().toISOString(),
                lastErrorDate: new Date().toISOString(),
                errorCount: 1,
                handwritingSnapshots: [snapshotData]
            };
            errorWords.push(errorWord);
        }
        
        this.saveErrorWords(errorWords);
        return errorWord;
    },

    removeErrorWord(wordId) {
        const errorWords = this.getErrorWords();
        const filtered = errorWords.filter(ew => ew.wordId !== wordId);
        this.saveErrorWords(filtered);
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
            errorWords: this.getErrorWords(),
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
        } else {
            // 替换模式：清空现有数据，使用新数据
            if (data.wordBank && Array.isArray(data.wordBank)) {
                this.saveWordBank(data.wordBank);
            }
            if (data.practiceLogs && Array.isArray(data.practiceLogs)) {
                this.savePracticeLogs(data.practiceLogs);
            }
            if (data.errorWords && Array.isArray(data.errorWords)) {
                this.saveErrorWords(data.errorWords);
            }
        }
        
        // 设置总是替换（不合并）
        if (data.settings) {
            this.saveSettings(data.settings);
        }
    }
};

// 初始化
Storage.init();
