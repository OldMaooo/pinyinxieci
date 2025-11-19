const fs = require('fs');
const path = require('path');

// 加载现有的词组库，分析模式
const existingGroups = JSON.parse(fs.readFileSync('data/word-groups-all.json', 'utf-8'));
const grade3Groups = JSON.parse(fs.readFileSync('data/word-groups-grade3-up.json', 'utf-8'));

// 分析常用前缀和后缀模式
const prefixPatterns = new Map();
const suffixPatterns = new Map();

Object.keys(grade3Groups).forEach(word => {
  const groups = grade3Groups[word];
  groups.forEach(group => {
    if (group.startsWith(word)) {
      const suffix = group.substring(word.length);
      if (suffix.length === 1) {
        suffixPatterns.set(suffix, (suffixPatterns.get(suffix) || 0) + 1);
      }
    } else if (group.endsWith(word)) {
      const prefix = group.substring(0, group.length - word.length);
      if (prefix.length === 1) {
        prefixPatterns.set(prefix, (prefixPatterns.get(prefix) || 0) + 1);
      }
    }
  });
});

// 获取最常用的前缀和后缀
const commonPrefixes = Array.from(prefixPatterns.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(e => e[0]);

const commonSuffixes = Array.from(suffixPatterns.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 20)
  .map(e => e[0]);

console.log('常用前缀:', commonPrefixes.join('、'));
console.log('常用后缀:', commonSuffixes.join('、'));

// 加载所有wordbank文件
const allWordbankFiles = [
  '一年级上册.json', '一年级下册.json',
  '二年级上册.json', '二年级下册.json',
  '三年级上册.json', '三年级下册.json',
  '四年级上册.json', '四年级下册.json',
  '五年级上册.json', '五年级下册.json',
  '六年级上册.json', '六年级下册.json'
];

const allWordEntries = [];
allWordbankFiles.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join('data/wordbank', file), 'utf-8'));
  if (data && Array.isArray(data.wordBank)) {
    data.wordBank.forEach(entry => {
      const word = (entry.word || '').trim();
      if (word && word.length >= 2) {
        allWordEntries.push({ word, entry });
      }
    });
  }
});

// 获取1-3年级缺少词组的字
const grade1to3Files = [
  '一年级上册.json', '一年级下册.json',
  '二年级上册.json', '二年级下册.json',
  '三年级上册.json', '三年级下册.json'
];

const grade1to3Words = new Set();
grade1to3Files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join('data/wordbank', file), 'utf-8'));
  if (data && Array.isArray(data.wordBank)) {
    data.wordBank.forEach(entry => {
      const word = (entry.word || '').trim();
      if (word && word.length >= 1) {
        grade1to3Words.add(word);
      }
    });
  }
});

const missingWords = Array.from(grade1to3Words).filter(w => 
  !existingGroups[w] || existingGroups[w].length === 0
);

console.log(`\n需要生成词组的字: ${missingWords.length} 个`);

// 智能生成词组
function generateSmartGroups(word) {
  const groups = [];
  const seen = new Set();
  
  // 1. 从wordbank中查找包含该字的真实词语（包括所有年级）
  allWordEntries.forEach(({ word: other }) => {
    if (other.length >= 2 && other.includes(word) && !seen.has(other)) {
      if (other.startsWith(word) || other.endsWith(word)) {
        groups.unshift(other);
      } else {
        groups.push(other);
      }
      seen.add(other);
    }
  });
  
  // 如果已经找到足够的词组，直接返回
  if (groups.length >= 2) {
    return groups.slice(0, 4);
  }
  
  // 3. 如果只找到1个，基于模式生成更多
  if (groups.length === 1) {
    const found = groups[0];
    if (found.startsWith(word)) {
      const suffix = found.substring(word.length);
      // 尝试其他常用后缀
      commonSuffixes.forEach(s => {
        if (s !== suffix && !seen.has(word + s)) {
          groups.push(word + s);
          seen.add(word + s);
          if (groups.length >= 4) return;
        }
      });
    } else if (found.endsWith(word)) {
      const prefix = found.substring(0, found.length - word.length);
      // 尝试其他常用前缀
      commonPrefixes.forEach(p => {
        if (p !== prefix && !seen.has(p + word)) {
          groups.push(p + word);
          seen.add(p + word);
          if (groups.length >= 4) return;
        }
      });
    }
    if (groups.length >= 2) {
      return groups.slice(0, 4);
    }
  }
  
  // 4. 从已有词组库中查找包含该字的词语
  Object.keys(existingGroups).forEach(otherWord => {
    const otherGroups = existingGroups[otherWord];
    otherGroups.forEach(group => {
      if (group.includes(word) && group.length >= 2 && !seen.has(group)) {
        if (group.startsWith(word) || group.endsWith(word)) {
          groups.unshift(group);
        } else {
          groups.push(group);
        }
        seen.add(group);
      }
    });
  });
  
  if (groups.length >= 2) {
    return groups.slice(0, 4);
  }
  
  // 5. 如果还是找不到，返回空数组（不使用不合理的智能组合）
  return [];
}

// 生成词组
let generated = 0;
let failed = 0;

console.log('\n开始生成词组...\n');

missingWords.forEach((word, idx) => {
  const groups = generateSmartGroups(word);
  if (groups.length >= 2) {
    existingGroups[word] = groups;
    generated++;
    if ((idx + 1) % 100 === 0 || idx === missingWords.length - 1) {
      console.log(`进度: ${idx + 1}/${missingWords.length} - ✅ "${word}": [${groups.join(', ')}]`);
    }
  } else {
    failed++;
    if ((idx + 1) % 100 === 0 || idx === missingWords.length - 1) {
      console.log(`进度: ${idx + 1}/${missingWords.length} - ⚠️ "${word}": 无法生成词组`);
    }
  }
});

// 保存
fs.writeFileSync('data/word-groups-all.json', JSON.stringify(existingGroups, null, 2));

console.log(`\n✅ 完成！`);
console.log(`成功生成: ${generated} 个字的词组`);
console.log(`无法生成: ${failed} 个字（将使用拼音显示）`);
console.log(`覆盖率: ${((grade1to3Words.size - failed) / grade1to3Words.size * 100).toFixed(1)}%`);

