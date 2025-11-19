const fs = require('fs');
const path = require('path');

// 真实常用词组库（基于小学语文常用词）
const REAL_WORD_GROUPS = {
  '八': ['八个', '八月', '八十', '十八'],
  '巴': ['嘴巴', '尾巴', '下巴', '巴望'],
  '爸': ['爸爸', '老爸', '爸妈'],
  '白': ['白色', '白天', '白云', '明白'],
  '办': ['办法', '办事', '办理', '办公'],
  '半': ['一半', '半天', '半年', '半夜'],
  '本': ['本来', '本子', '书本', '根本'],
  '比': ['比较', '比赛', '比如', '相比'],
  '不': ['不是', '不要', '不能', '不会'],
  '才': ['才能', '刚才', '人才', '天才'],
  '厂': ['工厂', '厂房', '厂家'],
  '尺': ['尺子', '尺寸', '一尺'],
  '虫': ['虫子', '昆虫', '害虫'],
  '出': ['出来', '出去', '出现', '出发'],
  '大': ['大小', '大家', '大人', '大地'],
  '刀': ['刀子', '小刀', '大刀'],
  '东': ['东西', '东方', '东北', '东南'],
  '多': ['多少', '很多', '多数', '多余'],
  '儿': ['儿子', '女儿', '儿童', '这儿'],
  '耳': ['耳朵', '耳机', '耳环'],
  '二': ['二个', '二月', '二十', '十二'],
  '风': ['大风', '风雨', '风景', '风筝'],
  '个': ['一个', '个人', '个子', '几个'],
  '工': ['工作', '工人', '工厂', '工具'],
  '公': ['公共', '公园', '公平', '公开'],
  '关': ['关心', '关门', '关系', '关键'],
  '禾': ['禾苗', '禾田'],
  '和': ['和平', '和气', '和好', '和声'],
  '火': ['大火', '火苗', '火焰', '火灾'],
  '几': ['几个', '几天', '几时', '几何'],
  '见': ['看见', '见面', '见到', '见识'],
  '九': ['九个', '九月', '九十', '十九'],
  '开': ['开门', '开始', '开心', '开放'],
  '可': ['可以', '可能', '可是', '可爱'],
  '口': ['门口', '开口', '口水', '口音'],
  '来': ['来到', '来回', '来去', '来年'],
  '了': ['好了', '完了', '走了', '来了'],
  '里': ['里面', '这里', '那里', '心里'],
  '力': ['力气', '力量', '用力', '努力'],
  '立': ['立正', '站立', '立刻', '立即'],
  '六': ['六个', '六月', '六十', '十六'],
  '妈': ['妈妈', '老妈', '爸妈'],
  '马': ['马上', '马车', '马路', '马儿'],
  '门': ['门口', '开门', '关门', '大门'],
  '木': ['木头', '树木', '木门', '木桌'],
  '目': ['目的', '目标', '目光', '目录'],
  '男': ['男孩', '男人', '男女', '男生'],
  '你': ['你们', '你的', '你好', '你来'],
  '鸟': ['小鸟', '鸟儿', '鸟类', '鸟巢'],
  '牛': ['牛儿', '牛奶', '牛肉', '黄牛'],
  '女': ['女孩', '女人', '女儿', '女生'],
  '七': ['七个', '七月', '七十', '十七'],
  '去': ['回去', '来去', '去年', '去去'],
  '人': ['人们', '人民', '大人', '小人'],
  '日': ['日子', '日出', '日落', '日记'],
  '三': ['三个', '三月', '三十', '十三'],
  '山': ['大山', '山上', '山下', '山水'],
  '上': ['上面', '上来', '上去', '上学'],
  '少': ['多少', '很少', '少年', '少女'],
  '十': ['十个', '十月', '十分', '十岁'],
  '石': ['石头', '石子', '石块', '石桥'],
  '是': ['是的', '不是', '就是', '还是'],
  '手': ['小手', '手里', '手中', '手指'],
  '水': ['大水', '水花', '水草', '水果'],
  '四': ['四个', '四月', '四十', '十四'],
  '天': ['天空', '天上', '天气', '白天'],
  '田': ['田地', '田野', '田里', '农田'],
  '头': ['头上', '头发', '头顶', '头儿'],
  '土': ['土地', '土里', '泥土', '黄土'],
  '王': ['大王', '王子', '王后', '国王'],
  '卫': ['卫生', '保卫', '守卫'],
  '我': ['我们', '我的', '我来', '我去'],
  '五': ['五个', '五月', '五十', '十五'],
  '午': ['中午', '上午', '下午', '午时'],
  '西': ['西方', '西边', '东西', '西北'],
  '下': ['下面', '下来', '下去', '下雨'],
  '先': ['先生', '先来', '先去', '先走'],
  '小': ['大小', '小的', '小人', '小鸟'],
  '心': ['心里', '心中', '心情', '心意'],
  '牙': ['牙齿', '牙儿', '刷牙'],
  '羊': ['羊儿', '小羊', '山羊', '绵羊'],
  '也': ['也是', '也好', '也要', '也行'],
  '叶': ['叶子', '树叶', '叶片', '叶儿'],
  '一': ['一个', '一起', '一样', '一天'],
  '用': ['用来', '有用', '不用', '用力'],
  '有': ['有的', '没有', '有用', '有时'],
  '又': ['又来', '又去', '又是', '又要'],
  '右': ['右边', '右手', '右面', '左右'],
  '雨': ['下雨', '雨水', '雨点', '雨伞'],
  '月': ['月亮', '月份', '月儿', '月牙'],
  '云': ['白云', '云朵', '云彩', '乌云'],
  '在': ['在家', '在学校', '在这里', '在在'],
  '长': ['长短', '长大', '长高', '长度'],
  '爪': ['爪子', '鸡爪', '猫爪'],
  '正': ['正好', '正在', '正确', '正午'],
  '只': ['只有', '只是', '一只', '几只'],
  '中': ['中间', '中心', '中国', '中午'],
  '竹': ['竹子', '竹叶', '竹竿', '竹林'],
  '子': ['儿子', '女子', '孩子', '桌子'],
  '左': ['左边', '左手', '左面', '左右'],
  // 1-3年级常见字补充
  '告': ['告诉', '告别', '告状', '告示'],
  '林': ['树林', '森林', '竹林', '林间'],
  '为': ['为了', '因为', '作为', '成为'],
  '法': ['办法', '方法', '法律', '法国'],
  '苦': ['辛苦', '苦瓜', '苦味', '吃苦'],
  '如': ['如果', '如何', '比如', '如此'],
  '辛': ['辛苦', '辛劳', '辛勤'],
  '杯': ['杯子', '水杯', '茶杯', '酒杯'],
  '精': ['精神', '精彩', '精心', '精美'],
  '室': ['教室', '室内', '室外', '卧室'],
  '周': ['周围', '周末', '周期', '四周'],
  '菇': ['蘑菇', '香菇', '金针菇'],
  '梅': ['梅花', '梅子', '梅雨', '腊梅'],
  '碎': ['破碎', '碎片', '打碎', '碎花'],
  '责': ['责任', '负责', '责备', '职责'],
  '组': ['组织', '小组', '组成', '组合'],
  // 继续补充常见字
  '共': ['共同', '一共', '共有', '共享'],
  '么': ['什么', '怎么', '那么', '多么'],
  '无': ['没有', '无法', '无论', '无限'],
  '柏': ['柏树', '松柏', '柏油'],
  '份': ['一份', '份量', '月份', '年份'],
  '拉': ['拉手', '拉开', '拉车', '拉面'],
  '升': ['上升', '升高', '升起', '升级'],
  '杨': ['杨树', '杨柳', '白杨'],
  '菜': ['蔬菜', '青菜', '白菜', '菜园'],
  '雷': ['打雷', '雷声', '雷电', '雷雨'],
  '桶': ['水桶', '木桶', '铁桶'],
  '瓣': ['花瓣', '蒜瓣', '豆瓣'],
  '继': ['继续', '继承', '继任'],
  '欧': ['欧洲', '欧美', '欧式'],
  '误': ['错误', '误会', '误解', '误事'],
  '阻': ['阻止', '阻挡', '阻力', '阻碍']
};

function loadJson(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) return null;
  return JSON.parse(fs.readFileSync(absPath, 'utf-8'));
}

function generateSmartGroups(word, allWordEntries, existingWordGroups) {
  // 1. 优先使用现有词组库（word-groups-all.json中已有的）
  if (existingWordGroups[word] && existingWordGroups[word].length > 0) {
    return existingWordGroups[word];
  }

  // 2. 使用手动整理的词组库
  if (REAL_WORD_GROUPS[word]) {
    return REAL_WORD_GROUPS[word];
  }

  // 3. 从题库中查找包含该字的真实词语（优先查找该字在词中的位置）
  const groups = [];
  const seen = new Set();
  
  // 优先查找：该字作为首字、尾字、中间字的词语
  allWordEntries.forEach(({ word: other }) => {
    if (other.length >= 2 && other.includes(word) && !seen.has(other)) {
      // 优先选择该字在词首或词尾的词语
      if (other.startsWith(word) || other.endsWith(word)) {
        groups.unshift(other); // 插入到前面
      } else {
        groups.push(other);
      }
      seen.add(other);
    }
  });

  // 4. 如果找到真实词语，返回
  if (groups.length >= 2) {
    return groups.slice(0, 4);
  }

  // 5. 如果只找到一个，尝试使用更合理的组合规则（但要非常谨慎）
  if (groups.length === 1) {
    // 如果该字在词首，尝试添加常见后缀
    if (groups[0].startsWith(word)) {
      const suffix = groups[0].substring(word.length);
      const commonSuffixes = ['子', '儿', '头', '的', '了', '着', '过', '来', '去', '上', '下', '中', '里', '外'];
      if (commonSuffixes.includes(suffix)) {
        // 这是一个合理的组合，可以尝试其他常见后缀
        const additionalGroups = [];
        commonSuffixes.forEach(s => {
          if (s !== suffix) {
            const candidate = word + s;
            if (!seen.has(candidate) && candidate.length >= 2) {
              additionalGroups.push(candidate);
            }
          }
        });
        if (additionalGroups.length > 0) {
          return [groups[0], ...additionalGroups.slice(0, 3)];
        }
      }
    }
    // 如果该字在词尾，尝试添加常见前缀
    else if (groups[0].endsWith(word)) {
      const prefix = groups[0].substring(0, groups[0].length - word.length);
      const commonPrefixes = ['大', '小', '老', '新', '好', '多', '少', '上', '下', '前', '后', '左', '右', '中', '里', '外'];
      if (commonPrefixes.includes(prefix)) {
        // 这是一个合理的组合，可以尝试其他常见前缀
        const additionalGroups = [];
        commonPrefixes.forEach(p => {
          if (p !== prefix) {
            const candidate = p + word;
            if (!seen.has(candidate) && candidate.length >= 2) {
              additionalGroups.push(candidate);
            }
          }
        });
        if (additionalGroups.length > 0) {
          return [groups[0], ...additionalGroups.slice(0, 3)];
        }
      }
    }
  }

  // 6. 如果都找不到，返回空数组（不使用不合理的智能组合）
  // 前端会使用拼音显示，这是合理的fallback
  return [];
}

function main() {
  const wordGroupsPath = 'data/word-groups-all.json';
  const wordGroups = loadJson(wordGroupsPath) || {};
  
  // 只处理1-3年级的wordbank文件
  const grade1to3Files = [
    '一年级上册.json', '一年级下册.json',
    '二年级上册.json', '二年级下册.json',
    '三年级上册.json', '三年级下册.json'
  ];

  // 收集1-3年级的所有字
  const grade1to3Words = new Set();
  const allWordEntries = [];
  
  grade1to3Files.forEach(file => {
    const data = loadJson(path.join('data/wordbank', file));
    if (data && Array.isArray(data.wordBank)) {
      data.wordBank.forEach(entry => {
        const word = (entry.word || '').trim();
        if (word && word.length >= 1) {
          grade1to3Words.add(word);
          allWordEntries.push({ word, entry });
        }
      });
    }
  });

  // 同时加载所有年级的wordbank用于查找词组（包括4-6年级）
  const allWordbankFiles = [
    '一年级上册.json', '一年级下册.json',
    '二年级上册.json', '二年级下册.json',
    '三年级上册.json', '三年级下册.json',
    '四年级上册.json', '四年级下册.json',
    '五年级上册.json', '五年级下册.json',
    '六年级上册.json', '六年级下册.json'
  ];

  allWordbankFiles.forEach(file => {
    const data = loadJson(path.join('data/wordbank', file));
    if (data && Array.isArray(data.wordBank)) {
      data.wordBank.forEach(entry => {
        const word = (entry.word || '').trim();
        if (word && word.length >= 2) { // 只收集多字词用于查找
          allWordEntries.push({ word, entry });
        }
      });
    }
  });

  // 找出1-3年级中缺少词组的字
  const wordsNeedingGroups = [];
  grade1to3Words.forEach(word => {
    if (!wordGroups[word] || wordGroups[word].length === 0) {
      wordsNeedingGroups.push(word);
    }
  });

  console.log(`[generate_groups_grade1-3] 1-3年级共有 ${grade1to3Words.size} 个不重复生字`);
  console.log(`[generate_groups_grade1-3] 其中 ${wordsNeedingGroups.length} 个字缺少词组`);
  console.log(`[generate_groups_grade1-3] 开始生成词组...\n`);

  let generated = 0;
  let failed = 0;
  let fromExisting = 0;
  let fromManual = 0;
  let fromWordbank = 0;
  
  wordsNeedingGroups.forEach((word, idx) => {
    // 先检查是否已有词组
    if (wordGroups[word] && wordGroups[word].length > 0) {
      fromExisting++;
      return; // 跳过，已有词组
    }
    
    const groups = generateSmartGroups(word, allWordEntries, wordGroups);
    if (groups.length > 0) {
      wordGroups[word] = groups;
      generated++;
      
      // 判断来源
      if (REAL_WORD_GROUPS[word]) {
        fromManual++;
      } else {
        fromWordbank++;
      }
      
      if ((idx + 1) % 50 === 0 || idx === wordsNeedingGroups.length - 1) {
        console.log(`[generate_groups_grade1-3] 进度: ${idx + 1}/${wordsNeedingGroups.length} - ✅ "${word}": [${groups.join(', ')}]`);
      }
    } else {
      failed++;
      if ((idx + 1) % 50 === 0 || idx === wordsNeedingGroups.length - 1) {
        console.log(`[generate_groups_grade1-3] 进度: ${idx + 1}/${wordsNeedingGroups.length} - ⚠️ "${word}": 无法生成词组`);
      }
    }
  });

  // 保存到word-groups-all.json（不更新wordbank文件）
  fs.writeFileSync(wordGroupsPath, JSON.stringify(wordGroups, null, 2));
  
  console.log(`\n[generate_groups_grade1-3] ✅ 完成！`);
  console.log(`[generate_groups_grade1-3] 统计信息:`);
  console.log(`  - 已有词组（跳过）: ${fromExisting} 个字`);
  console.log(`  - 从手动词组库生成: ${fromManual} 个字`);
  console.log(`  - 从题库查找生成: ${fromWordbank} 个字`);
  console.log(`  - 本次新增: ${generated} 个字的词组`);
  console.log(`  - 无法生成: ${failed} 个字（将使用拼音显示）`);
  console.log(`[generate_groups_grade1-3] 词组已保存到: ${wordGroupsPath}`);
  console.log(`[generate_groups_grade1-3] ⚠️ 注意：尚未更新wordbank文件，请确认后再运行 add_groups_to_wordbank.js`);
}

main();

