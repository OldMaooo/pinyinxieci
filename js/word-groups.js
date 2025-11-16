/**
 * 词组数据模块（外挂式）
 * 从外部JSON文件加载词组数据，支持动态更新
 */

const WordGroups = {
    // 词组库（从外部文件加载）
    groups: {},
    
    // 加载状态
    _loaded: false,
    _loading: false,
    _loadPromise: null,
    
    /**
     * 加载词组数据（支持多个数据源）
     * @param {string|string[]} sources - 数据源路径，可以是单个路径或路径数组
     * @returns {Promise} 加载完成的Promise
     */
    async load(sources = ['data/word-groups-grade3-up.json']) {
        // 如果正在加载，返回现有的Promise
        if (this._loading && this._loadPromise) {
            return this._loadPromise;
        }
        
        // 如果已加载，直接返回
        if (this._loaded) {
            return Promise.resolve();
        }
        
        this._loading = true;
        const sourcesArray = Array.isArray(sources) ? sources : [sources];
        
        // 添加版本号参数解决浏览器缓存问题
        const version = typeof APP_VERSION !== 'undefined' ? APP_VERSION.version : Date.now();
        const timestamp = Date.now();
        
        this._loadPromise = Promise.all(
            sourcesArray.map(source => {
                // 为URL添加版本号和时间戳参数
                const separator = source.includes('?') ? '&' : '?';
                const urlWithVersion = `${source}${separator}v=${version}&t=${timestamp}`;
                return fetch(urlWithVersion, { cache: 'no-cache' })
                    .then(response => {
                        if (!response.ok) {
                            console.warn(`[WordGroups] 无法加载词组数据: ${source}`);
                            return {};
                        }
                        return response.json();
                    })
                    .then(data => {
                        // 合并数据（后面的会覆盖前面的）
                        Object.assign(this.groups, data);
                        console.log(`[WordGroups] 已加载词组数据: ${source} (${Object.keys(data).length} 个字)`);
                        return data;
                    })
                    .catch(error => {
                        console.warn(`[WordGroups] 加载词组数据失败: ${source}`, error);
                        return {};
                    })
            )
        ).then(() => {
            this._loaded = true;
            this._loading = false;
            console.log(`[WordGroups] 词组数据加载完成，共 ${Object.keys(this.groups).length} 个字`);
        });
        
        return this._loadPromise;
    },
    
    /**
     * 获取字的词组
     */
    getGroups(word) {
        return this.groups[word] || [];
    },
    
    /**
     * 生成拼音（如果拼音为空）
     */
    _generatePinyin(word) {
        // 如果 pinyin-pro 可用，使用它生成拼音
        if (typeof pinyinPro !== 'undefined' && pinyinPro.pinyin) {
            try {
                // pinyin-pro 的 API: pinyinPro.pinyin(text, options)
                // 使用带声调的配置
                let result = pinyinPro.pinyin(word, { 
                    toneType: 'symbol'  // 带声调，例如：niàn, guā
                });
                
                // 处理返回结果
                // pinyin-pro 可能返回字符串、数组或对象数组
                let pinyin = '';
                
                if (typeof result === 'string') {
                    // 直接是字符串
                    pinyin = result.trim();
                } else if (Array.isArray(result)) {
                    // 如果是数组
                    if (result.length > 0) {
                        const first = result[0];
                        if (typeof first === 'string') {
                            pinyin = first.trim();
                        } else if (typeof first === 'object' && first !== null) {
                            // 对象数组，提取拼音字段
                            pinyin = (first.pinyin || first.text || first.value || String(first) || '').trim();
                        } else {
                            pinyin = String(first || '').trim();
                        }
                    }
                } else if (typeof result === 'object' && result !== null) {
                    // 如果是对象，尝试提取拼音字段
                    pinyin = (result.pinyin || result.text || result.value || '').trim();
                } else {
                    pinyin = String(result || '').trim();
                }
                
                // 最终安全检查：如果还是对象，强制转换为字符串并提取
                if (typeof pinyin === 'object' && pinyin !== null) {
                    console.warn('[WordGroups] pinyin 仍然是对象，尝试提取:', pinyin);
                    pinyin = (pinyin.pinyin || pinyin.text || pinyin.value || JSON.stringify(pinyin) || '').trim();
                }
                
                // 确保最终结果是字符串
                pinyin = String(pinyin || '').trim();
                
                // 调试日志
                if (pinyin) {
                    console.log(`[WordGroups] 为 "${word}" 生成拼音: ${pinyin}`);
                } else {
                    console.warn(`[WordGroups] 无法为 "${word}" 生成拼音，pinyinPro 返回:`, result);
                }
                
                return pinyin;
            } catch (err) {
                console.warn('[WordGroups] 生成拼音失败:', err);
            }
        } else {
            console.warn('[WordGroups] pinyinPro 未加载或不可用');
        }
        return '';
    },
    
    /**
     * 获取格式化的词组显示文本：将目标字替换为拼音
     * 例如：枫 → feng叶，feng树，feng林
     * 
     * pickCount: 每次随机展示的词语数量（默认2）
     * maxPerChar: 每个字最多使用的候选词（默认4；若词库少于4则使用全部）
     */
    getDisplayText(word, pinyin, pickCount = 2, maxPerChar = 4) {
        // 确保 word 和 pinyin 都是字符串
        word = String(word || '');
        pinyin = String(pinyin || '').trim();
        
        // 如果词组数据未加载，尝试加载（但这是同步方法，所以只能返回拼音）
        // 注意：实际加载应该在调用此方法前完成
        if (!this._loaded && Object.keys(this.groups).length === 0) {
            // 如果正在加载中，等待一下（但这是同步方法，所以直接返回拼音）
            if (this._loading) {
                // 正在加载，返回拼音
                return pinyin || word;
            }
            // 未加载且未在加载，返回拼音
            return pinyin || word;
        }
        
        const groups = this.getGroups(word);
        if (groups.length === 0) {
            // 如果没有词组，尝试生成拼音
            if (!pinyin) {
                pinyin = this._generatePinyin(word);
                pinyin = String(pinyin || '').trim();
            }
            // 返回拼音（如果拼音为空，返回字本身）
            return pinyin || word;
        }
        
        // 如果拼音为空，尝试动态生成拼音
        let finalPinyin = String(pinyin || '').trim();
        if (!finalPinyin) {
            finalPinyin = this._generatePinyin(word);
            // 确保返回的是字符串
            finalPinyin = String(finalPinyin || '').trim();
        }
        
        // 如果还是没有拼音，直接显示词组（不替换）
        if (!finalPinyin) {
            const pool = groups.slice(0, Math.max(1, maxPerChar));
            const shuffled = [...pool];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            const picked = shuffled.slice(0, Math.min(pickCount, shuffled.length));
            return picked.join('，');
        }
        
        // 有拼音时，替换字为拼音（确保 finalPinyin 是字符串）
        finalPinyin = String(finalPinyin);
        const pool = groups.slice(0, Math.max(1, maxPerChar));
        // 随机抽取不重复的项
        const shuffled = [...pool];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const picked = shuffled.slice(0, Math.min(pickCount, shuffled.length));
        const processed = picked.map(group => {
            // 确保替换的是字符串
            const pinyinStr = String(finalPinyin);
            return group.replace(new RegExp(word, 'g'), pinyinStr);
        });
        return processed.join('，');
    }
};
