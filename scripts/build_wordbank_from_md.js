#!/usr/bin/env node
/**
 * Parse docs/导入1-6年级.md and generate normalized word bank JSON.
 * Usage:
 *   node scripts/build_wordbank_from_md.js --input docs/导入1-6年级.md --grade 6 --semester 下 --out data/wordbank
 *   node scripts/build_wordbank_from_md.js --input docs/导入1-6年级.md --all --out data/wordbank
 *
 * Output file name pattern:
 *   {年级}{册}.json (e.g., 六年级下册.json)
 *
 * Output JSON schema:
 * {
 *   "version": "1.0",
 *   "buildDate": "2025-11-10T00:00:00.000Z",
 *   "gradeSemester": "六年级下册",
 *   "wordBank": [
 *     { "id": "六年级下册-4E2D", "word": "中", "pinyin": "", "gradeSemester": "六年级下册", "unit": 1, "sectionType": "课文", "sourceTitle": "课文 1" }
 *   ]
 * }
 */

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
function getArg(name, defaultValue = undefined) {
  const idx = args.findIndex(a => a === `--${name}`);
  if (idx >= 0) return args[idx + 1];
  return defaultValue;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

const inputPath = getArg('input', 'docs/导入1-6年级.md');
const outDir = getArg('out', 'data/wordbank');
const filterGrade = getArg('grade'); // Arabic (1-6) or Chinese (一..六) accepted later
const filterSemester = getArg('semester'); // 上 or 下
const buildAll = hasFlag('all');

if (!fs.existsSync(inputPath)) {
  console.error(`[ERROR] Input file not found: ${inputPath}`);
  process.exit(1);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Helpers
const chineseDigits = ['零','一','二','三','四','五','六'];
function normalizeGradeToken(token) {
  // Accept "一年级"/"1年级"/"三年级" ; return "一年级" ... "六年级"
  const m = token.match(/([一二三四五六123456])年级/);
  if (!m) return null;
  let g = m[1];
  if (/\d/.test(g)) {
    const n = parseInt(g, 10);
    if (n >= 1 && n <= 6) g = chineseDigits[n];
  }
  return `${g}年级`;
}
function normalizeSemesterToken(token) {
  // Accept "上册"/"下册"/"上"/"下" ; return "上册" or "下册"
  if (/上/.test(token)) return '上册';
  if (/下/.test(token)) return '下册';
  return null;
}
function semesterChar(sem) {
  return sem === '上册' ? '上' : sem === '下册' ? '下' : '';
}
function gradeNumber(gradeLabel) {
  // "一年级" -> 1 .. "六年级" -> 6
  const map = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6 };
  const m = gradeLabel && gradeLabel.match(/^([一二三四五六])年级$/);
  if (m) return map[m[1]] || null;
  return null;
}
function toGradeSemester(grade, semester) {
  return `${grade}${semester}`;
}
function codePointHex(str) {
  if (!str || str.length === 0) return '0000';
  const cp = str.codePointAt(0);
  return cp.toString(16).toUpperCase();
}
function parseUnitHeaderPrefix(prefix) {
  // Examples: "识字 2", "阅读 10", "语文园地一", "课文 3", "1", "语文园地"
  // Return { sectionType: string, unitNumber: number | null, sourceTitle: string }
  let sectionType = '';
  let unitNumber = null;
  let sourceTitle = prefix.trim();

  // Try "Xxx N"
  let m = prefix.match(/^(.+?)\s+(\d+)$/);
  if (m) {
    sectionType = m[1].trim();
    unitNumber = parseInt(m[2], 10);
    return { sectionType, unitNumber, sourceTitle: `${sectionType} ${unitNumber}` };
  }
  // Try pure number like "1:"
  m = prefix.match(/^(\d+)$/);
  if (m) {
    sectionType = '课文';
    unitNumber = parseInt(m[1], 10);
    return { sectionType, unitNumber, sourceTitle: `${sectionType} ${unitNumber}` };
  }
  // Try "语文园地一/二/三..."
  m = prefix.match(/^语文园地([一二三四五六七八九十]+)$/);
  if (m) {
    sectionType = '语文园地';
    // Convert Chinese numerals to numbers (simple up to 30)
    const map = { 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 };
    const ch = m[1];
    let n = 0;
    if (ch.length === 1) {
      n = map[ch] || null;
    } else if (ch.length === 2 && ch[0] === '十') {
      n = 10 + (map[ch[1]] || 0);
    } else if (ch.length === 2 && ch[1] === '十') {
      n = (map[ch[0]] || 0) * 10;
    } else {
      // Fallback: ignore
      n = null;
    }
    unitNumber = n;
    return { sectionType, unitNumber, sourceTitle: `${sectionType}${m[1]}` };
  }
  // Try known labels without numbers
  if (/^(识字|阅读|课文|语文园地)$/.test(prefix)) {
    sectionType = prefix;
    return { sectionType, unitNumber: null, sourceTitle: sectionType };
  }
  // Default: treat full prefix as sectionType
  sectionType = prefix.trim();
  return { sectionType, unitNumber: null, sourceTitle };
}

// Parsing state
let currentGrade = null;     // "一年级".."六年级"
let currentSemester = null;  // "上册"|"下册"
let currentGS = null;        // combined label
const gsToWords = new Map(); // gradeSemester -> Map(word -> metadata)
const gsUnitOrder = new Map(); // gradeSemester -> incremental unit order

const content = fs.readFileSync(inputPath, 'utf8');
const lines = content.split(/\r?\n/);

for (const rawLine of lines) {
  const line = rawLine.trim();
  if (!line) continue;

  // Detect grade & semester headers
  // Example: "## 六年级 下册 写字表", "## 六年级 下册 写字表 (部分课文列表)"
  let m = line.match(/^##\s*([一二三四五六123456]年级)\s+([上下][册]?)\s+写字表/);
  if (m) {
    const g = normalizeGradeToken(m[1]);
    const s = normalizeSemesterToken(m[2]);
    if (g && s) {
      currentGrade = g;
      currentSemester = s;
      currentGS = toGradeSemester(currentGrade, currentSemester);
      if (!gsToWords.has(currentGS)) gsToWords.set(currentGS, new Map());
      if (!gsUnitOrder.has(currentGS)) gsUnitOrder.set(currentGS, 0);
    }
    continue;
  }

  // Skip until a valid header is set
  if (!currentGS) continue;

  // Match content lines: "前缀: 词, 词, 词" or "数字: 词, 词"
  // Prefix can contain spaces and Chinese labels. Capture before colon.
  let colonIdx = line.indexOf(':');
  if (colonIdx === -1) continue;
  const prefix = line.slice(0, colonIdx).trim();
  const rest = line.slice(colonIdx + 1).trim();
  if (!rest) continue;

  // Split items by comma (both Chinese and English comma), also allow spaces
  const items = rest.split(/[，,]/).map(s => s.trim()).filter(Boolean);
  if (items.length === 0) continue;

  const { sectionType, unitNumber, sourceTitle } = parseUnitHeaderPrefix(prefix);
  const unitLabel = sourceTitle || sectionType || prefix;
  const orderSeq = (gsUnitOrder.get(currentGS) || 0) + 1;
  gsUnitOrder.set(currentGS, orderSeq);
  const wordsMap = gsToWords.get(currentGS);

  for (const token of items) {
    // Only single-character entries are eligible; skip multi-character tokens silently
    const word = token;
    if (!word) continue;
    // Many lists are single characters; if multi-char appears accidentally, still accept if length==1
    if ([...word].length !== 1) continue;

    if (!wordsMap.has(word)) {
      wordsMap.set(word, {
        word,
        gradeSemester: currentGS,
        unit: unitNumber ?? null,
        unitLabel,
        unitOrder: orderSeq
      });
    }
  }
}

// Emit JSON files
function writeOne(gsLabel) {
  const wordsMap = gsToWords.get(gsLabel);
  if (!wordsMap || wordsMap.size === 0) {
    console.warn(`[WARN] No words for ${gsLabel}, skip.`);
    return;
  }
  const wordBank = [];
  for (const meta of wordsMap.values()) {
    const id = `${gsLabel}-${codePointHex(meta.word)}`;
    const gNum = gradeNumber(gsLabel.slice(0, 3));
    const semChar = semesterChar(gsLabel.slice(3));
    const unitOrder = typeof meta.unitOrder === 'number' ? meta.unitOrder : (typeof meta.unit === 'number' ? meta.unit : null);
    const entry = {
      id,
      word: meta.word,
      grade: gNum,
      semester: semChar,
      unit: typeof meta.unit === 'number' ? meta.unit : unitOrder,
      unitLabel: meta.unitLabel || (typeof meta.unit === 'number' ? `第${meta.unit}单元` : '未分类单元'),
      unitOrder
    };
    wordBank.push(entry);
  }
  // Sort by code point for stable output
  wordBank.sort((a, b) => a.word.localeCompare(b.word, 'zh-Hans-CN'));

  const data = {
    version: '1.0',
    buildDate: new Date().toISOString(),
    gradeSemester: gsLabel,
    count: wordBank.length,
    wordBank
  };
  const fileName = `${gsLabel}.json`; // e.g., 六年级下册.json
  const outPath = path.join(outDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[OK] Wrote ${outPath} (${wordBank.length} items)`);
}

if (buildAll) {
  for (const gs of gsToWords.keys()) writeOne(gs);
} else {
  // Specific filter
  if (!filterGrade || !filterSemester) {
    console.error('[ERROR] When not using --all, please provide --grade and --semester (e.g., --grade 6 --semester 下)');
    process.exit(1);
  }
  // Normalize inputs to Chinese labels
  let gNum = filterGrade;
  if (/\d/.test(gNum)) {
    const n = parseInt(gNum, 10);
    if (n >= 1 && n <= 6) gNum = chineseDigits[n];
  }
  const gradeLabel = `${gNum}年级`;
  const semesterLabel = normalizeSemesterToken(filterSemester) || '下册';
  const gsWanted = `${gradeLabel}${semesterLabel}`;
  if (!gsToWords.has(gsWanted)) {
    console.error(`[ERROR] Target gradeSemester not found in input: ${gsWanted}`);
    process.exit(2);
  }
  writeOne(gsWanted);
}

/** End of script */


