const fs = require('fs');
const path = require('path');

const WORD_BANK_DIR = 'data/wordbank';
const OUTPUT_FILE = 'data/word-groups-all.json';

function loadJson(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function extractWordsFromWordbank() {
  const wordbankFiles = [
    '一年级上册.json',
    '一年级下册.json',
    '二年级上册.json',
    '二年级下册.json',
    '三年级上册.json',
    '三年级下册.json',
    '四年级上册.json',
    '四年级下册.json',
    '五年级上册.json',
    '五年级下册.json',
    '六年级上册.json',
    '六年级下册.json'
  ];

  const allWords = new Set();
  const allWordEntries = [];

  wordbankFiles.forEach(file => {
    const filePath = path.join(WORD_BANK_DIR, file);
    const data = loadJson(filePath);
    if (!data) {
      console.warn(`[build_all_word_groups] 文件不存在: ${filePath}`);
      return;
    }
    const entries = Array.isArray(data.wordBank) ? data.wordBank : [];
    entries.forEach(entry => {
      const word = (entry.word || '').trim();
      if (word && word.length >= 1) {
        allWords.add(word);
        allWordEntries.push({ word, entry });
      }
    });
  });

  return { allWords: Array.from(allWords), allWordEntries };
}

function loadExistingGroups() {
  const existingFiles = [
    'data/word-groups-grade3-up.json'
  ];
  const merged = {};
  existingFiles.forEach(file => {
    const data = loadJson(file);
    if (data && typeof data === 'object') {
      Object.assign(merged, data);
    }
  });
  return merged;
}

function generateFallbackGroups(word, allWordEntries) {
  const groups = [];
  const seen = new Set();
  
  // 只从题库中查找包含该字的真实词语，不使用简单的前缀/后缀组合
  allWordEntries.forEach(({ word: other, entry }) => {
    if (other.length >= 2 && other.includes(word) && !seen.has(other)) {
      groups.push(other);
      seen.add(other);
    }
  });
  
  // 如果找不到真实词语，返回空数组（让前端使用拼音显示）
  // 不再使用简单的前缀/后缀组合，避免生成"大厨"、"小厨"等不合理词组
  return groups.slice(0, 4);
}

function main() {
  console.log('[build_all_word_groups] 开始扫描所有wordbank文件...');
  const { allWords, allWordEntries } = extractWordsFromWordbank();
  console.log(`[build_all_word_groups] 发现 ${allWords.length} 个不重复生字`);

  console.log('[build_all_word_groups] 加载现有词组数据...');
  const existingGroups = loadExistingGroups();
  const existingCount = Object.keys(existingGroups).length;
  console.log(`[build_all_word_groups] 已有 ${existingCount} 个字的词组`);

  const allGroups = { ...existingGroups };
  let fallbackCount = 0;

  allWords.forEach(word => {
    if (!allGroups[word] || allGroups[word].length === 0) {
      const fallback = generateFallbackGroups(word, allWordEntries);
      if (fallback.length > 0) {
        allGroups[word] = fallback;
        fallbackCount++;
      } else {
        allGroups[word] = [];
      }
    }
  });

  console.log(`[build_all_word_groups] 使用fallback补充了 ${fallbackCount} 个字的词组`);
  console.log(`[build_all_word_groups] 总计 ${Object.keys(allGroups).length} 个字有词组数据`);

  const missing = allWords.filter(w => !allGroups[w] || allGroups[w].length === 0);
  if (missing.length > 0) {
    console.warn(`[build_all_word_groups] ⚠️ 仍有 ${missing.length} 个字缺少词组:`, missing.slice(0, 20).join('、'));
  }

  saveJson(OUTPUT_FILE, allGroups);
  console.log(`[build_all_word_groups] ✅ 已保存到 ${OUTPUT_FILE}`);
}

main();
