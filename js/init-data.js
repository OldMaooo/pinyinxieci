/**
 * 初始化数据模块（完整版）
 * 包含所有107个字的数据
 */

const InitData = {
    // 如果本地已有人为导入数据，则不再自动导入
    // 否则优先从 data/三年级上册写字表.json 加载完整数据作为默认样本
    
    /**
     * 加载默认题库数据
     */
    async loadDefaultWordBank() {
        // 检查是否已经导入过
        const existingWords = Storage.getWordBank();
        if (existingWords && existingWords.length > 0) {
            console.log('题库已有数据，跳过自动导入');
            return;
        }

        // 优先加载自动构建的 wordbank 版本（包含完整单元）
        try {
            // 添加版本号参数解决浏览器缓存问题
            const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : Date.now();
            const timestamp = `?v=${version}&t=${Date.now()}`;
            let resp = await fetch(`data/wordbank/三年级上册.json${timestamp}`, { cache: 'no-cache' });
            if (!resp.ok) {
                // 兼容旧文件名
                resp = await fetch(`data/三年级上册写字表.json${timestamp}`, { cache: 'no-cache' });
            }
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            const wordsToImport = Array.isArray(data) ? data : (data.wordBank || []);
            const fileVersion = data.version || data.buildDate || `len-${wordsToImport.length}`;
            const currentVersion = typeof Storage.getBuiltinWordBankVersion === 'function' ? Storage.getBuiltinWordBankVersion() : null;
            const hasBuiltin = typeof Storage.hasBuiltinWordBank === 'function' ? Storage.hasBuiltinWordBank() : false;

            if (hasBuiltin && currentVersion === fileVersion) {
                console.log(`[InitData] 内置题库已是最新版本 ${fileVersion}，跳过导入`);
                return;
            }

            if (typeof Storage.importBuiltinWordBank === 'function') {
                Storage.importBuiltinWordBank(wordsToImport, { version: fileVersion, buildDate: data.buildDate });
                console.log(`✅ 自动导入 ${wordsToImport.length} 个生字（版本 ${fileVersion}）`);
            } else {
                // 回退：使用逐条添加（旧版本逻辑）
                let imported = 0;
                wordsToImport.forEach(word => {
                    const result = Storage.addWord({
                        word: word.word,
                        pinyin: word.pinyin || '',
                        grade: word.grade || 3,
                        semester: word.semester || '上',
                        unit: word.unit || 1,
                        isBuiltIn: true,
                        source: 'builtin'
                    });
                    if (result) imported++;
                });
                console.log(`✅ 自动导入 ${imported} 个生字（兼容旧逻辑）`);
            }
        } catch (e) {
            console.warn('加载 data/三年级上册写字表.json 失败，退回内置少量样本：', e);
            // 退回空导入，提示用户使用导入功能加载数据
        }
        
        // 更新界面
        if (typeof WordBank !== 'undefined') {
            WordBank.loadWordBank();
        }
        if (typeof Statistics !== 'undefined') {
            Statistics.updateHomeStats();
        }
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
