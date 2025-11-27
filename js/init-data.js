/**
 * 初始化数据模块（完整版）
 * 包含所有107个字的数据
 */

const InitData = {
    BUILTIN_FILES: [
        'data/wordbank/一年级上册.json',
        'data/wordbank/一年级下册.json',
        'data/wordbank/二年级上册.json',
        'data/wordbank/二年级下册.json',
        'data/wordbank/三年级上册.json',
        'data/wordbank/三年级下册.json',
        'data/wordbank/四年级上册.json',
        'data/wordbank/四年级下册.json',
        'data/wordbank/五年级上册.json',
        'data/wordbank/五年级下册.json',
        'data/wordbank/六年级上册.json',
        'data/wordbank/六年级下册.json'
    ],
    /**
     * 加载默认题库数据
     */
    async loadDefaultWordBank(context = 'auto') {
        console.log(`[InitData] (${context}) 开始加载默认题库…`);
        try {
            await this.loadBuiltinWordBank(context);
            console.log(`[InitData] (${context}) ✅ 内置题库加载完成`);
        } catch (error) {
            console.warn(`[InitData] (${context}) 内置题库加载失败，回退到 legacy 文件：`, error);
            await this.loadLegacyWordBank(context);
        }
        
        if (typeof WordBank !== 'undefined') {
            console.log('[InitData] 通知 WordBank 刷新列表');
            WordBank.loadWordBank();
        }
        if (typeof Statistics !== 'undefined') {
            console.log('[InitData] 通知 Statistics 刷新首页统计');
            Statistics.updateHomeStats();
        }
        if (typeof PracticeRange !== 'undefined' && typeof PracticeRange.refresh === 'function') {
            console.log('[InitData] 通知 PracticeRange 刷新练习范围');
            PracticeRange.refresh();
        }
    },

    async loadBuiltinWordBank(context = 'auto') {
        if (typeof Storage === 'undefined' || !Storage.importBuiltinWordBank) {
            throw new Error('Storage.importBuiltinWordBank 不可用');
        }

        const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : Date.now();
        const timestamp = `?v=${version}&t=${Date.now()}`;
        const collectedWords = [];
        const signatureTokens = [];
        const singleWordMap = {};

        for (const file of this.BUILTIN_FILES) {
            try {
                console.log(`[InitData] (${context}) 正在拉取 ${file}`);
                const resp = await fetch(`${file}${timestamp}`, { cache: 'no-cache' });
                if (!resp.ok) {
                    console.warn(`[InitData] (${context}) 无法加载 ${file}: HTTP ${resp.status}`);
                    continue;
                }
                const data = await resp.json();
                const words = Array.isArray(data) ? data : (data.wordBank || []);
                if (words.length === 0) continue;
                const versionToken = data.version || data.buildDate || words.length;
                signatureTokens.push(`${file}:${versionToken}`);

                console.log(`[InitData] (${context}) ✅ 读取 ${file} 成功，包含 ${words.length} 个字`);
                words.forEach(word => {
                    collectedWords.push({
                        word: word.word,
                        pinyin: word.pinyin || '',
                        grade: this.normalizeGrade(word.grade),
                        semester: this.normalizeSemester(word.semester),
                        unit: typeof word.unit === 'number' ? word.unit : (word.unitOrder || null),
                        unitLabel: word.unitLabel || word.sourceTitle || '',
                        sectionType: word.sectionType || '',
                        sourceTitle: word.sourceTitle || '',
                        isBuiltIn: true,
                        source: 'builtin'
                    });
                    if (word.word && String(word.word).trim().length === 1) {
                        const entry = singleWordMap[file] || { count: 0, samples: [] };
                        entry.count += 1;
                        if (entry.samples.length < 5) {
                            entry.samples.push(word.word);
                        }
                        singleWordMap[file] = entry;
                    }
                });
            } catch (err) {
                console.warn(`[InitData] 加载 ${file} 失败:`, err);
            }
        }

        if (Object.keys(singleWordMap).length) {
            const summary = {};
            Object.keys(singleWordMap).forEach(file => {
                summary[file] = {
                    count: singleWordMap[file].count,
                    samples: singleWordMap[file].samples
                };
            });
            console.warn('[InitData] ⚠️ 单字词条统计（每个文件展示前5个示例）:', summary);
        }

        if (!collectedWords.length) {
            console.error('[InitData] 未能加载任何内置题库文件，signatureTokens=', signatureTokens);
            throw new Error('未能加载任何内置题库');
        }

        const signature = signatureTokens.join('|');
        const currentSignature = typeof Storage.getBuiltinWordBankVersion === 'function'
            ? Storage.getBuiltinWordBankVersion()
            : null;
        const currentWordCount = typeof Storage.getWordBank === 'function'
            ? (Storage.getWordBank() || []).length
            : 0;
        const shouldForceImport = currentWordCount === 0;

        if (!shouldForceImport &&
            typeof Storage.hasBuiltinWordBank === 'function' &&
            Storage.hasBuiltinWordBank() &&
            currentSignature === signature) {
            console.log('[InitData] 内置题库版本未变化，跳过导入');
            return;
        }

        Storage.importBuiltinWordBank(collectedWords, {
            version: signature,
            buildDate: new Date().toISOString()
        });
        console.log(`[InitData] 已导入内置题库 ${collectedWords.length} 个字，版本签名: ${signature}`);
    },

    async loadLegacyWordBank(context = 'auto') {
        console.log(`[InitData] (${context}) 使用 legacy 备份文件加载默认题库`);
        const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : Date.now();
        const timestamp = `?v=${version}&t=${Date.now()}`;
        let resp = await fetch(`data/wordbank/三年级上册.json${timestamp}`, { cache: 'no-cache' });
            if (!resp.ok) {
            resp = await fetch(`data/三年级上册写字表.json${timestamp}`, { cache: 'no-cache' });
            }
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const wordsToImport = Array.isArray(data) ? data : (data.wordBank || []);
        let imported = 0;
            wordsToImport.forEach(word => {
            const result = Storage.addWord({
                word: word.word,
                pinyin: word.pinyin || '',
                grade: this.normalizeGrade(word.grade),
                semester: this.normalizeSemester(word.semester),
                unit: word.unit || 1,
                isBuiltIn: true,
                source: 'builtin'
            });
            if (result) imported++;
        });
        console.log(`[InitData] (${context}) ✅ 回退导入 ${imported} 个生字（legacy 文件）`);
    },

    normalizeGrade(grade) {
        if (typeof grade === 'number') return grade;
        if (typeof grade === 'string') {
            const match = grade.match(/([一二三四五六])年级/);
            if (match) {
                const map = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
                return map[match[1]] || 3;
            }
            const num = parseInt(grade, 10);
            if (!isNaN(num)) return num;
        }
        return 3;
    },

    normalizeSemester(semester) {
        if (!semester) return '上';
        if (typeof semester === 'string' && semester.includes('下')) return '下';
        return '上';
    },

    /**
     * 加载词组数据
     */
    async loadWordGroups() {
        if (typeof WordGroups !== 'undefined' && WordGroups.load) {
            try {
                await WordGroups.load();
            } catch (e) {
                console.warn('加载词组数据失败:', e);
            }
        }
    },
    
    /**
     * 初始化
     */
    init() {
        // 延迟加载，确保Storage模块已初始化
        setTimeout(() => {
            this.loadDefaultWordBank();
            // 同时加载词组数据
            this.loadWordGroups();
        }, 300);
    }
};
