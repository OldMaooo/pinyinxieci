/**
 * 为字库生成词组数据
 * 每个字生成最多4个常用词组（优先二字词）
 */

const fs = require('fs');
const path = require('path');

// 读取三年级上册字库
const wordbankPath = path.join(__dirname, '../data/wordbank/三年级上册.json');
const wordbank = JSON.parse(fs.readFileSync(wordbankPath, 'utf8'));

// 提取所有不重复的字
const uniqueWords = [...new Set(wordbank.wordBank.map(w => w.word))].sort();

console.log(`共 ${uniqueWords.length} 个字需要生成词组`);

// 为每个字生成词组（这里使用常见词组库）
// 实际应用中，可以从公开词库（THUOCL、搜狗细胞词库等）加载
const wordGroups = {};

// 常见词组库（示例，实际应该从更大规模的词库加载）
const commonGroups = {
    // 这里可以扩展为从文件加载的词库
};

// 为每个字生成词组
uniqueWords.forEach(word => {
    // 如果已有数据，跳过
    // 这里生成常用词组（实际应该从词库匹配）
    const groups = generateGroupsForWord(word);
    if (groups.length > 0) {
        wordGroups[word] = groups.slice(0, 4); // 最多4个
    }
});

console.log(`已为 ${Object.keys(wordGroups).length} 个字生成词组`);

// 输出到文件
const outputPath = path.join(__dirname, '../data/word-groups-grade3-up.json');
fs.writeFileSync(outputPath, JSON.stringify(wordGroups, null, 2), 'utf8');
console.log(`✅ 已保存到: ${outputPath}`);

// 生成词组的函数（简化版，实际应该从词库匹配）
function generateGroupsForWord(word) {
    // 这里应该从词库中查找包含该字的常用词
    // 暂时返回空数组，需要实际词库数据
    return [];
}







