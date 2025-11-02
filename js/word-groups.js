/**
 * 词组数据模块（测试版 - 仅3个字）
 * 测试通过后再扩展
 */

const WordGroups = {
    // 测试用词组库（仅3个字）
    groups: {
        "恒": ["恒星", "永恒", "恒定"],
        "厘": ["厘米", "厘清", "厘定"],
        "坡": ["山坡", "土坡", "斜坡"]
    },
    
    /**
     * 获取字的词组
     */
    getGroups(word) {
        return this.groups[word] || [];
    },
    
    /**
     * 获取格式化的词组显示文本（目标字用下划线代替）
     */
    getDisplayText(word, pinyin) {
        const groups = this.getGroups(word);
        if (groups.length === 0) {
            // 如果没有词组，只显示拼音
            return pinyin;
        }
        
        // 把词组中的目标字替换为下划线
        // 例如：恒星 → __星，永恒 → 永__，恒定 → __定
        const processedGroups = groups.slice(0, 3).map(group => {
            return group.replace(new RegExp(word, 'g'), '___');
        });
        
        // 格式：拼音 (___星，永___，___定)
        const groupsText = processedGroups.join('，');
        return `${pinyin} (${groupsText})`;
    }
};