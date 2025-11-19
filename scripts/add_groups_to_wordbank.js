const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`File not found: ${absPath}`);
  }
  return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
}

function main() {
  const [,, wordbankArg, groupsArg] = process.argv;
  if (!wordbankArg) {
    console.error('Usage: node scripts/add_groups_to_wordbank.js <wordbank.json> [word-groups.json]');
    process.exit(1);
  }
  const wordbankPath = path.resolve(wordbankArg);
  const groupsPath = path.resolve(groupsArg || 'data/word-groups-grade3-up.json');

  const wordbank = loadJson(wordbankPath);
  const wordGroups = loadJson(groupsPath);

  const entries = Array.isArray(wordbank.wordBank) ? wordbank.wordBank : [];
  let updated = 0;
  let emptyGroups = 0;

  entries.forEach(entry => {
    const key = (entry.word || '').trim();
    if (!key) return;
    const groups = wordGroups[key] || [];
    if (groups.length > 0) {
      if (!entry.groups || JSON.stringify(entry.groups) !== JSON.stringify(groups)) {
        entry.groups = groups;
        updated++;
      }
    } else {
      // 如果新词组文件中没有对应词组，清空旧的groups（避免保留不合理的词组）
      if (entry.groups && entry.groups.length > 0) {
        entry.groups = [];
        updated++;
      } else {
        entry.groups = [];
      }
      emptyGroups++;
    }
  });

  fs.writeFileSync(wordbankPath, JSON.stringify(wordbank, null, 2));
  console.log(`[add_groups_to_wordbank] Completed. Updated ${updated} entries. ${emptyGroups} entries still lack groups.`);
}

main();
