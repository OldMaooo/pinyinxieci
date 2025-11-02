/**
 * 初始化数据模块（测试版 - 仅3个字）
 * 测试通过后再扩展
 */

const InitData = {
    // 测试用题库数据（仅3个字）
    defaultWordBank: [
        {"word":"恒","pinyin":"héng","grade":3,"semester":"上","unit":9},
        {"word":"厘","pinyin":"lí","grade":3,"semester":"上","unit":9},
        {"word":"坡","pinyin":"pō","grade":3,"semester":"上","unit":1}
    ],
    
    /**
     * 加载默认题库数据
     */
    loadDefaultWordBank() {
        // 检查是否已经导入过
        const existingWords = Storage.getWordBank();
        if (existingWords && existingWords.length > 0) {
            console.log('题库已有数据，跳过自动导入');
            return;
        }

        // 导入数据
        let imported = 0;
        this.defaultWordBank.forEach(word => {
            const result = Storage.addWord({
                word: word.word,
                pinyin: word.pinyin || '',
                grade: word.grade || 3,
                semester: word.semester || '上',
                unit: word.unit || 1
            });
            if (result) imported++;
        });

        console.log(`✅ 自动导入 ${imported} 个生字（测试版）`);
        
        // 更新界面
        if (typeof WordBank !== 'undefined') {
            WordBank.loadWordBank();
        }
        if (typeof Statistics !== 'undefined') {
            Statistics.updateHomeStats();
        }
    },

    /**
     * 初始化
     */
    init() {
        // 延迟加载，确保Storage模块已初始化
        setTimeout(() => {
            this.loadDefaultWordBank();
        }, 300);
    }
};