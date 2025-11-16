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
                    });
            })
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
     * 例如：枫 → fēng叶，fēng树，fēng林
     * 
     * 简化版本：取前3个词组，将字替换为拼音
     */
    getDisplayText(word, pinyin) {
        // 确保 word 和 pinyin 都是字符串
        word = String(word || '');
        pinyin = String(pinyin || '').trim();
        
        // 如果词组数据未加载，返回拼音
        if (!this._loaded && Object.keys(this.groups).length === 0) {
            return pinyin || word;
        }
        
        const groups = this.getGroups(word);
        
        console.log('[WordGroups.getDisplayText]', {
            word: word,
            pinyin: pinyin,
            groupsLength: groups.length,
            groups: groups,
            _loaded: this._loaded,
            totalGroups: Object.keys(this.groups).length
        });
        
        // 如果没有词组，返回拼音
        if (groups.length === 0) {
            // 如果拼音为空，尝试生成拼音
            if (!pinyin) {
                pinyin = this._generatePinyin(word);
                pinyin = String(pinyin || '').trim();
            }
            console.log('[WordGroups.getDisplayText] 没有词组，返回:', pinyin || word);
            return pinyin || word;
        }
        
        // 如果拼音为空，尝试生成拼音
        if (!pinyin) {
            pinyin = this._generatePinyin(word);
            pinyin = String(pinyin || '').trim();
        }
        
        // 如果还是没有拼音，直接显示原始词组（不替换）
        if (!pinyin) {
            const result = groups.slice(0, 3).join(', ');
            console.log('[WordGroups.getDisplayText] 无拼音，显示原始词组:', result);
            return result;
        }
        
        // 有拼音时，取前3个词组，将字替换为拼音
        const processedGroups = groups.slice(0, 3).map(group => {
            return group.replace(new RegExp(word, 'g'), pinyin);
        });
        const result = processedGroups.join(', ');
        console.log('[WordGroups.getDisplayText] 有拼音，替换后:', result);
        return result;
    }
};
