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
****
    /**
     * 加载默认题库数据
     */
    async loadDefaultWordBank() {
        try {
            await this.loadBuiltinWordBank();
        } catch (error) {
            console.warn('[InitData] 内置题库加载失败，回退到 legacy 文件：', error);
            await this.loadLegacyWordBank();
        }
        
        if (typeof WordBank !== 'undefined') {
            WordBank.loadWordBank();
        }
        if (typeof Statistics !== 'undefined') {
            Statistics.updateHomeStats();
        }
        if (typeof PracticeRange !== 'undefined' && typeof PracticeRange.refresh === 'function') {
            PracticeRange.refresh();
        }
    },

    async loadBuiltinWordBank() {
        if (typeof Storage === 'undefined' || !Storage.importBuiltinWordBank) {
            throw new Error('Storage.importBuiltinWordBank 不可用');
        }

        const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : Date.now();
        const timestamp = `?v=${version}&t=${Date.now()}`;
        const collectedWords = [];
        const signatureTokens = [];

        for (const file of this.BUILTIN_FILES) {
            try {
                const resp = await fetch(`${file}${timestamp}`, { cache: 'no-cache' });
                if (!resp.ok) {
                    console.warn(`[InitData] 无法加载 ${file}: HTTP ${resp.status}`);
                    continue;
                }
                const data = await resp.json();
                const words = Array.isArray(data) ? data : (data.wordBank || []);
                if (words.length === 0) continue;
                const versionToken = data.version || data.buildDate || words.length;
                signatureTokens.push(`${file}:${versionToken}`);

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
                });
            } catch (err) {
                console.warn(`[InitData] 加载 ${file} 失败:`, err);
            }
        }

        if (!collectedWords.length) {
            throw new Error('未能加载任何内置题库');
        }

        const signature = signatureTokens.join('|');
        const currentSignature = typeof Storage.getBuiltinWordBankVersion === 'function'
            ? Storage.getBuiltinWordBankVersion()
            : null;

        if (typeof Storage.hasBuiltinWordBank === 'function' &&
            Storage.hasBuiltinWordBank() &&
            currentSignature === signature) {
            console.log('[InitData] 内置题库版本未变化，跳过导入');
            return;
        }

        Storage.importBuiltinWordBank(collectedWords, {
            version: signature,
            buildDate: new Date().toISOString()
        });
        console.log(`[InitData] 已导入内置题库 ${collectedWords.length} 个字`);
    },

    async loadLegacyWordBank() {
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
        console.log(`✅ 回退导入 ${imported} 个生字（legacy 文件）`);
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
