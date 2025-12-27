/**
 * 练习范围选择模块
 * 参考 @语文-识字 的交互：按年级展开/收起、可保存选择、支持动态题量按钮
 */
const PracticeRange = {
    // 保存折叠状态
    saveCollapseState(containerId, semesterKey, isExpanded) {
        try {
            const key = `collapse_state_${containerId}`;
            const state = JSON.parse(localStorage.getItem(key) || '{}');
            state[semesterKey] = isExpanded;
            localStorage.setItem(key, JSON.stringify(state));
        } catch (e) {
            console.warn('保存折叠状态失败:', e);
        }
    },

    // 获取折叠状态
    getCollapseState(containerId, semesterKey) {
        try {
            const key = `collapse_state_${containerId}`;
            const state = JSON.parse(localStorage.getItem(key) || '{}');
            // 默认展开（如果未设置）
            return state[semesterKey] !== false;
        } catch (e) {
            return true;
        }
    },

    init() {
        this.refresh();
    },
    
    refresh() {
        this.renderContainer('practice-range-container', { context: 'modal' });
        this.renderContainer('practice-range-container-home', {
            context: 'home',
            stickyToolbar: true,
            showOnlyWrongToggle: true,
            showManagementModeBtn: true
        });
    },

    renderContainer(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`[PracticeRange] 容器不存在: ${containerId}`);
            return;
        }
        if (typeof Storage === 'undefined' || !Storage.getWordBank) {
            container.innerHTML = '<div class="text-danger py-3 text-center">数据加载失败，请刷新页面</div>';
            return;
        }
        const wordBank = Storage.getWordBank() || [];
        if (wordBank.length === 0) {
            container.innerHTML = '<div class="text-muted py-3 text-center">正在加载默认题库，请稍候…</div>';
            return;
        }
        
        // 首页使用表格视图，模态框使用原来的折叠视图
        if (containerId === 'practice-range-container-home' && options.context === 'home') {
            this.renderTableView(container, wordBank, options);
        } else {
            this.renderAccordionView(container, wordBank, options);
        }
    },
    
    // 生成完成率饼图SVG
    generateCompletionPie(masteredCount, totalCount) {
        // 检测当前主题模式
        const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        // 浅色模式用#ced4da（比bar的#e9ecef更深），深色模式用#495057
        const grayColor = isDarkMode ? '#495057' : '#ced4da';
        
        if (totalCount === 0) {
            return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${grayColor}"/></svg></div>`;
        }

        const percentage = masteredCount / totalCount;
        const radius = 9;
        const centerX = 10;
        const centerY = 10;
        
        // 如果全部掌握，显示绿色带勾
        if (percentage === 1) {
            return '<div class="completion-pie completion-pie-mastered"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#28a745"/><path d="M6 10 L9 13 L14 7" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
        }
        
        // 否则显示比例饼图
        if (percentage === 0) {
            return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${grayColor}"/></svg></div>`;
            }
        
        // 计算弧的路径（从顶部开始，顺时针）
        const angle = percentage * 360;
        const startAngle = -90; // 从顶部开始
        const endAngle = startAngle + angle;
        const startRad = (startAngle * Math.PI) / 180;
        const endRad = (endAngle * Math.PI) / 180;
        
        const x1 = centerX + radius * Math.cos(startRad);
        const y1 = centerY + radius * Math.sin(startRad);
        const x2 = centerX + radius * Math.cos(endRad);
        const y2 = centerY + radius * Math.sin(endRad);
        
        const largeArcFlag = angle > 180 ? 1 : 0;
        const pathData = `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
        
        return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="9" fill="${grayColor}"/>
            <path d="${pathData}" fill="#28a745"/>
        </svg></div>`;
    },
    
    /**
     * 生成学期饼图（支持三种状态：绿、红、灰顺序）
     */
    generateSemesterPie(masteredCount, errorCount, totalCount) {
        const isDarkMode = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const grayColor = isDarkMode ? '#495057' : '#ced4da';
        
        if (totalCount === 0) {
            return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${grayColor}"/></svg></div>`;
        }
        
        const radius = 9;
        const centerX = 10;
        const centerY = 10;
        
        // 如果全部是灰色（未练习）
        if (masteredCount === 0 && errorCount === 0) {
            return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${grayColor}"/></svg></div>`;
        }
        
        // 如果全部掌握，显示绿色带勾
        if (masteredCount === totalCount) {
            return '<div class="completion-pie completion-pie-mastered"><svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="#28a745"/><path d="M6 10 L9 13 L14 7" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>';
        }
        
        // 生成路径：绿、红、灰顺序（从顶部开始，顺时针）
        const startAngle = -90;
        let currentAngle = startAngle;
        
        const paths = [];
        
        // 绿色（已掌握）- 只绘制非零的部分，且角度至少为0.5度以避免尖角
        if (masteredCount > 0) {
            let angle = (masteredCount / totalCount) * 360;
            // 确保最小角度为0.5度，避免尖角
            if (angle > 0 && angle < 0.5) {
                angle = 0.5;
            }
            const endAngle = currentAngle + angle;
            const startRad = (currentAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const x1 = centerX + radius * Math.cos(startRad);
            const y1 = centerY + radius * Math.sin(startRad);
            const x2 = centerX + radius * Math.cos(endRad);
            const y2 = centerY + radius * Math.sin(endRad);
            const largeArcFlag = angle > 180 ? 1 : 0;
            // 确保路径闭合：使用 Z 闭合路径
            paths.push(`<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="#28a745" stroke="none"/>`);
            currentAngle = endAngle;
        }
        
        // 红色（错题）- 只绘制非零的部分，且角度至少为0.5度以避免尖角
        if (errorCount > 0) {
            let angle = (errorCount / totalCount) * 360;
            // 确保最小角度为0.5度，避免尖角
            if (angle > 0 && angle < 0.5) {
                angle = 0.5;
            }
            const endAngle = currentAngle + angle;
            const startRad = (currentAngle * Math.PI) / 180;
            const endRad = (endAngle * Math.PI) / 180;
            const x1 = centerX + radius * Math.cos(startRad);
            const y1 = centerY + radius * Math.sin(startRad);
            const x2 = centerX + radius * Math.cos(endRad);
            const y2 = centerY + radius * Math.sin(endRad);
            const largeArcFlag = angle > 180 ? 1 : 0;
            // 确保路径闭合：使用 Z 闭合路径
            paths.push(`<path d="M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="#dc3545" stroke="none"/>`);
            currentAngle = endAngle;
        }
        
        // 灰色（未练习）- 作为背景
        return `<div class="completion-pie"><svg width="20" height="20" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="9" fill="${grayColor}"/>
            ${paths.join('')}
        </svg></div>`;
    },

    renderTableView(container, wordBank, options = {}) {
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        const semesters = this.sortSemesters(Object.keys(grouped));
        
        // 获取字的掌握状态
        const logs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs() || [];
        const errorWords = Storage.getErrorWordsFiltered() || [];
        const errorWordIds = new Set(errorWords.map(ew => ew.wordId));
        
        // 统计每个字的正确次数
        const wordCorrectCount = new Map();
        logs.forEach(log => {
            if (log.details && Array.isArray(log.details)) {
                log.details.forEach(detail => {
                    if (detail.correct) {
                        wordCorrectCount.set(detail.wordId, (wordCorrectCount.get(detail.wordId) || 0) + 1);
                    }
                });
            }
        });
        
        // 检查是否是管理模式（home上下文且管理模式开启）
        const isManagementMode = options.context === 'home' && options.managementMode === true;
        
        let html = '<div class="practice-range-selector d-flex flex-column" style="height: 100%;">';
        // 在home上下文或wordbank上下文显示工具栏
        if (options.context === 'home' || options.context === 'wordbank') {
            html += this.renderToolbar({
                ...options,
                showManagementModeBtn: options.context === 'home'
            });
        }
        html += '<div class="flex-grow-1" style="overflow-y: auto; min-height: 0;">';
        
        const accordionId = `${container.id}-accordion`;
        html += `<div class="accordion practice-range-accordion" id="${accordionId}">`;
        
        // 获取选中的学期（如果有）
        const selectedSemesters = this.getSelectedSemesters(container);
        
        // 按学期划分，每个学期一个表格
        semesters.forEach((semesterKey, idx) => {
            const units = this.sortUnits(grouped[semesterKey]);
            const headingId = `${accordionId}-heading-${idx}`;
            const collapseId = `${accordionId}-collapse-${idx}`;
            
            // 恢复折叠状态
            const isExpanded = this.getCollapseState(container.id, semesterKey);
            
            // 计算学期的完成率（所有单元的字）- 支持三种状态：已掌握（绿）、错题（红）、未练习（灰）
            let semesterMasteredCount = 0;
            let semesterErrorCount = 0;
            let semesterTotalCount = 0;
            const isWordbankContext = options.context === 'wordbank';
            const isManagementMode = options.context === 'home' && options.managementMode === true;
            const shouldShowMastery = isWordbankContext || isManagementMode;
            const wordMastery = shouldShowMastery && typeof Storage !== 'undefined' && Storage.getWordMastery 
                ? Storage.getWordMastery() 
                : {};
            
            units.forEach(unitKey => {
                const words = grouped[semesterKey][unitKey];
                if (Array.isArray(words) && words.length > 0) {
                    semesterTotalCount += words.length;
                    words.forEach(w => {
                        let isMastered = false;
                        let isError = false;
                        // 统一使用 wordMastery 来判断状态（如果存在）
                        // 如果不存在，则使用自动判断（仅用于非管理模式）
                        if (shouldShowMastery) {
                            // 在wordbank上下文或管理模式中，只使用手动设置的状态
                            const masteryStatus = wordMastery[w.id];
                            isMastered = masteryStatus === 'mastered';
                            isError = masteryStatus === 'error';
                            // 如果 masteryStatus 为 undefined，表示未练习（default），不计数
                        } else {
                            // 非wordbank上下文且非管理模式，使用自动判断
                            isError = errorWordIds.has(w.id);
                            const hasCorrect = wordCorrectCount.get(w.id) > 0;
                            isMastered = hasCorrect && !isError;
                        }
                        if (isMastered) semesterMasteredCount++;
                        if (isError) semesterErrorCount++;
                    });
                }
            });
            const semesterPieHtml = this.generateSemesterPie(semesterMasteredCount, semesterErrorCount, semesterTotalCount);
            
        html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="${headingId}">
                        <div class="d-flex align-items-center w-100 practice-semester-header" style="padding: 0;">
                            <div class="semester-checkbox-wrapper" style="flex-shrink: 0; padding: 0.5rem 0.5rem 0.5rem 0.75rem; cursor: default; display: flex; align-items: center;">
                <input type="checkbox" class="form-check-input semester-checkbox" 
                                       data-semester="${semesterKey}"
                                       style="margin: 0; cursor: pointer; width: 0.6em; height: 0.6em; vertical-align: middle;">
            </div>
                            <button class="accordion-button practice-semester-btn ${isExpanded ? '' : 'collapsed'}" type="button"
                                    data-collapse-target="#${collapseId}"
                                    aria-expanded="${isExpanded}" aria-controls="${collapseId}"
                                    style="flex: 1; border: none; padding: 0.5rem 0.75rem; text-align: left; cursor: pointer; display: flex; align-items: center;">
                                <span>${semesterKey}</span>
                                <span style="margin-left: 0.5rem; display: inline-flex; align-items: center;">${semesterPieHtml}</span>
                            </button>
                        </div>
                    </h2>
                    <div id="${collapseId}"
                         class="accordion-collapse collapse ${isExpanded ? 'show' : ''}"
                         aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
                        <div class="accordion-body p-2">
                            <table class="table table-sm mb-0 practice-range-table">
                                <thead>
                                    <tr>
                                        <th style="width: 130px;">单元</th>
                                        <th style="min-width: 300px;">汉字</th>
                                        <th style="width: 60px; text-align: center;">字数</th>
                                        <th style="width: 60px; text-align: center;">完成</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            units.forEach(unitKey => {
                const words = grouped[semesterKey][unitKey];
                if (!Array.isArray(words) || words.length === 0) {
                    return; // 跳过无效的单元
                }
                const unitLabel = words.unitLabel || this.formatUnitLabel(unitKey);
                const sanitized = this.sanitizeId(`${semesterKey}-${unitKey}`);
                
                // 计算每个字的状态和完成率
                let masteredCount = 0;
                const isWordbankContext = options.context === 'wordbank';
                const isManagementMode = options.context === 'home' && options.managementMode === true;
                const shouldShowMastery = isWordbankContext || isManagementMode;
                
                // 在wordbank上下文或管理模式中，获取手动设置的掌握状态
                const wordMastery = shouldShowMastery && typeof Storage !== 'undefined' && Storage.getWordMastery 
                    ? Storage.getWordMastery() 
                    : {};
                
                const wordTags = words.map(w => {
                    let tagClass = 'word-tag-default';
                    let isMastered = false;
                    
                    if (shouldShowMastery) {
                        // 在wordbank上下文或管理模式中，优先使用手动设置的状态
                        // 注意：如果手动设置为'default'，wordMastery中会删除该记录
                        // 但我们需要检查是否曾经手动设置过（通过检查是否有其他状态）
                        const manualStatus = wordMastery[w.id];
                        if (manualStatus === 'mastered') {
                            tagClass = 'word-tag-mastered';
                            isMastered = true;
                        } else if (manualStatus === 'error') {
                            tagClass = 'word-tag-error';
                        } else {
                            // manualStatus为undefined或'default'，使用默认状态
                            // 在wordbank上下文或管理模式中，如果手动设置为default，应该显示为未练习
                            tagClass = 'word-tag-default';
                            isMastered = false;
                        }
                    } else {
                        // 非wordbank上下文且非管理模式，使用自动判断
                        const isError = errorWordIds.has(w.id);
                        const hasCorrect = wordCorrectCount.get(w.id) > 0;
                        // 已掌握：有正确记录且无错误
                        isMastered = hasCorrect && !isError;
                        
                        if (isMastered) {
                            tagClass = 'word-tag-mastered';
                        } else if (isError) {
                            // 测试过且有错误
                            tagClass = 'word-tag-error';
                        } else {
                            tagClass = 'word-tag-default';
                        }
                    }
                    
                    if (isMastered) masteredCount++;
                    
                    // 在wordbank上下文、管理模式或home上下文中，添加data-word-id和点击样式
                    const isHomeContext = options.context === 'home';
                    const clickableClass = (isWordbankContext || isManagementMode || isHomeContext) ? 'word-tag-clickable' : '';
                    const dataAttr = (isWordbankContext || isManagementMode || isHomeContext) ? `data-word-id="${w.id}"` : '';
                    const titleText = (isWordbankContext || isManagementMode || isHomeContext) ? '点击切换掌握状态（默认→错题→已掌握）' : '';
                    
                    return `<span class="word-tag ${tagClass} ${clickableClass}" ${dataAttr} title="${titleText}">${w.word}</span>`;
                }).join('');
                
                // 计算完成率并生成饼图（使用三种状态：已掌握、错题、未练习）
                // 统计单元内的三种状态数量 - 必须与标签颜色使用完全相同的逻辑
                let unitMasteredCount = 0;
                let unitErrorCount = 0;
                words.forEach(w => {
                    if (shouldShowMastery) {
                        // 在wordbank上下文或管理模式中，只使用手动设置的状态（与标签颜色逻辑完全一致）
                        const masteryStatus = wordMastery[w.id];
                        if (masteryStatus === 'mastered') unitMasteredCount++;
                        else if (masteryStatus === 'error') unitErrorCount++;
                        // undefined 或 'default' 不计数（算未练习）
                    } else {
                        // 非wordbank上下文且非管理模式，使用自动判断（与标签颜色逻辑完全一致）
                        const isError = errorWordIds.has(w.id);
                        const hasCorrect = wordCorrectCount.get(w.id) > 0;
                        if (hasCorrect && !isError) unitMasteredCount++;
                        else if (isError) unitErrorCount++;
                        // 其他情况不计数（算未练习）
                    }
                });
                const completionRateHtml = this.generateSemesterPie(unitMasteredCount, unitErrorCount, words.length);
                
                // 检查是否需要显示checkbox
                // 在home上下文（首页）时，复选框始终显示，用于选择练习范围
                // 在wordbank上下文时，复选框用于批量操作
                // 在管理模式时，复选框也用于批量操作
                const shouldShowCheckbox = options.context === 'home' || options.context === 'wordbank' || isManagementMode;
                const checkboxHtml = shouldShowCheckbox
                    ? `<input type="checkbox" class="form-check-input unit-checkbox me-2" data-semester="${semesterKey}" data-unit="${unitKey}">`
                    : '';
                
                html += `<tr class="unit-row" data-semester="${semesterKey}" data-unit="${unitKey}" data-row-id="${sanitized}" style="cursor: pointer;">`;
                html += `<td>${checkboxHtml}${unitLabel}</td>`;
                html += `<td class="word-tags-cell">${wordTags}</td>`;
                html += `<td style="text-align: center;">${words.length}</td>`;
                html += `<td style="text-align: center;">${completionRateHtml}</td>`;
                html += `</tr>`;
            });
            
                html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                    </div>
                `;
        });
        
        html += '</div></div></div>';
        container.innerHTML = html;
        
        this.bindContainerEvents(container, options);
        this.restoreSelection(container);
        const saved = this.getSavedSelection();
        if (!saved || Object.keys(saved).length === 0) {
            this.selectAll(container, options);
        } else {
            this.updateSelectedCount(container, options);
        }
    },
    
    renderAccordionView(container, wordBank, options = {}) {
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        const semesters = this.sortSemesters(Object.keys(grouped));
        const accordionId = `${container.id}-accordion`;
        
        // 获取选中的学期（如果有）
        const selectedSemesters = this.getSelectedSemesters(container);
        
        let html = '<div class="practice-range-selector">';
        html += this.renderToolbar(options);
        html += '<div class="p-3">';
        html += `<div class="accordion practice-range-accordion" id="${accordionId}">`;

        semesters.forEach((semesterKey, idx) => {
            const units = this.sortUnits(grouped[semesterKey]);
            const headingId = `${accordionId}-heading-${idx}`;
            const collapseId = `${accordionId}-collapse-${idx}`;
            // 默认全部收起，如果有选中的学期则展开
            const isExpanded = selectedSemesters.has(semesterKey);

        html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="${headingId}">
                        <div class="d-flex align-items-center w-100 practice-semester-header" style="padding: 0;">
                            <div class="semester-checkbox-wrapper" style="flex-shrink: 0; padding: 0.5rem 0.5rem 0.5rem 0.75rem; cursor: default; display: flex; align-items: center;">
                                <input type="checkbox" class="form-check-input semester-checkbox"
                                       data-semester="${semesterKey}"
                                       style="margin: 0; cursor: pointer; width: 0.6em; height: 0.6em; vertical-align: middle;">
                    </div>
                            <button class="accordion-button practice-semester-btn ${isExpanded ? '' : 'collapsed'}" type="button"
                                    data-collapse-target="#${collapseId}"
                                    aria-expanded="${isExpanded}" aria-controls="${collapseId}"
                                    style="flex: 1; border: none; padding: 0.5rem 0.75rem; text-align: left; cursor: pointer;">
                                <span>${semesterKey}</span>
                            </button>
                </div>
                    </h2>
                    <div id="${collapseId}"
                         class="accordion-collapse collapse ${isExpanded ? 'show' : ''}"
                         aria-labelledby="${headingId}" data-bs-parent="#${accordionId}">
                        <div class="accordion-body">
            `;

            units.forEach(unitKey => {
                const words = grouped[semesterKey][unitKey];
                const unitLabel = words.unitLabel || this.formatUnitLabel(unitKey);
                const sanitized = this.sanitizeId(`${semesterKey}-${unitKey}`);

                html += `
                    <div class="unit-item mb-2 d-flex align-items-center gap-2 unit-row"
                         data-semester="${semesterKey}" data-unit="${unitKey}" data-row-id="${sanitized}"
                         style="cursor: pointer;">
                        <input type="checkbox" class="form-check-input unit-checkbox" 
                               data-semester="${semesterKey}" data-unit="${unitKey}">
                        <div class="flex-shrink-0">
                            <strong>${unitLabel}</strong>
                            <span class="text-muted small">(${words.length} 个字)</span>
                        </div>
                        <span class="text-muted small flex-grow-1 text-truncate" style="min-width:0;">
                            ${this.formatUnitPreview(words)}
                        </span>
                    </div>
                `;
            });

            html += `
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div></div></div>';
        container.innerHTML = html;
        
        this.bindContainerEvents(container, options);
        this.restoreSelection(container);
        const saved = this.getSavedSelection();
        if (!saved || Object.keys(saved).length === 0) {
            this.selectAll(container, options);
        } else {
            this.updateSelectedCount(container, options);
        }
    },

    renderToolbar(options = {}) {
        const { stickyToolbar = false, showOnlyWrongToggle = false, showManagementModeBtn = false } = options;
        const stickyClasses = stickyToolbar
            ? 'practice-range-toolbar sticky-top border-bottom bg-body p-2'
            : 'practice-range-toolbar border-bottom p-2';
        return `
            <div class="${stickyClasses}" style="z-index: 10;">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <div class="form-check m-0">
                        <input class="form-check-input" type="checkbox" id="select-all-checkbox" data-action="select-all">
                        <label class="form-check-label" for="select-all-checkbox" style="cursor: pointer;">全选</label>
                    </div>
                    ${showOnlyWrongToggle ? `
                    <div class="form-check form-switch m-0">
                            <input class="form-check-input" type="checkbox" data-toggle="only-wrong" id="only-wrong-toggle">
                            <label class="form-check-label" for="only-wrong-toggle">只练错题</label>
                    </div>
                    ` : ''}
                    <span class="ms-auto text-muted" data-selected-count>已选择: 0 个字</span>
                    ${showManagementModeBtn ? `
                    <button class="btn btn-sm btn-outline-secondary" id="home-management-mode-btn-toolbar">
                        <i class="bi bi-gear"></i> 管理模式
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    },

    bindContainerEvents(container, options = {}) {
        const selectAllCheckbox = container.querySelector('#select-all-checkbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectAll(container, options);
                } else {
                    this.deselectAll(container, options);
            }
                selectAllCheckbox.checked = e.target.checked;
            });
    
            // 监听所有复选框变化，更新全选状态
            const updateSelectAllState = () => {
                const allCheckboxes = container.querySelectorAll('.unit-checkbox');
                const checkedCount = container.querySelectorAll('.unit-checkbox:checked').length;
                selectAllCheckbox.checked = allCheckboxes.length > 0 && checkedCount === allCheckboxes.length;
                selectAllCheckbox.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
            };
        
            // 初始状态
            setTimeout(updateSelectAllState, 100);
            
            // 监听单元复选框变化（有全选复选框的情况）
            container.querySelectorAll('.unit-checkbox').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    updateSelectAllState();
                    this.updateSemesterCheckboxState(container, e.target.dataset.semester);
                    // 同时更新选中数量
                    const isManagementMode = options.context === 'home' && options.managementMode === true;
                    if (isManagementMode && container.id === 'practice-range-container-home') {
                        this.updateHomeSelectedCount(container);
                        // 同时也更新工具栏中的计数
                        this.updateSelectedCount(container, options);
                    } else {
                        this.updateSelectedCount(container, options);
                    }
                });
            });
        }
        
        if (options.showOnlyWrongToggle) {
            const toggle = container.querySelector('[data-toggle="only-wrong"]');
            if (toggle) {
                try {
                    toggle.checked = localStorage.getItem('practice_error_only') === '1';
                } catch (e) {}
                toggle.addEventListener('change', (e) => {
                    try {
                        if (e.target.checked) localStorage.setItem('practice_error_only', '1');
                        else localStorage.removeItem('practice_error_only');
                    } catch (err) {
                        console.warn('保存"只练错题"状态失败', err);
                    }
                    // 更新选中数量（因为只练错题会影响统计）
                    const isManagementMode = options.context === 'home' && options.managementMode === true;
                    if (isManagementMode && container.id === 'practice-range-container-home') {
                        this.updateHomeSelectedCount(container);
                    }
                    this.updateSelectedCount(container, options);
            });
        }
        }

        container.querySelectorAll('.semester-checkbox').forEach(checkbox => {
            // 只阻止事件冒泡，不阻止默认行为
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                // 不调用 preventDefault()，让复选框的默认行为（切换选中状态）正常工作
            }, false);
            
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                const semester = e.target.dataset.semester;
                this.toggleSemester(container, semester, e.target.checked);
                // 更新选中数量
                const isManagementMode = options.context === 'home' && options.managementMode === true;
                if (isManagementMode && container.id === 'practice-range-container-home') {
                    this.updateHomeSelectedCount(container);
                    // 同时也更新工具栏中的计数
                    this.updateSelectedCount(container, options);
                } else {
                    this.updateSelectedCount(container, options);
                }
            });
        });
        
        // 阻止复选框包装器的点击事件冒泡
        container.querySelectorAll('.semester-checkbox-wrapper').forEach(wrapper => {
            wrapper.addEventListener('click', (e) => {
                // 如果点击的是复选框本身，不阻止，让它正常工作
                if (e.target.type === 'checkbox') {
                    return; // 让复选框的默认行为执行
                }
                e.stopPropagation();
            });
        });
        
        // 注意：.unit-checkbox 的事件已经在 selectAllCheckbox 部分绑定过了
        // 这里只需要绑定那些没有全选复选框的情况
        if (!selectAllCheckbox) {
            container.querySelectorAll('.unit-checkbox').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    this.updateSemesterCheckboxState(container, checkbox.dataset.semester);
                    // 更新选中数量
                    const isManagementMode = options.context === 'home' && options.managementMode === true;
                    if (isManagementMode && container.id === 'practice-range-container-home') {
                        this.updateHomeSelectedCount(container);
                        // 同时也更新工具栏中的计数
                        this.updateSelectedCount(container, options);
                } else {
                        this.updateSelectedCount(container, options);
                }
            });
        });
        }
        
        // 绑定单个字的点击事件（切换掌握状态）- 在home和wordbank上下文中
        if (options.context === 'home' || options.context === 'wordbank') {
            container.addEventListener('click', (e) => {
                const wordTag = e.target.closest('.word-tag-clickable');
                if (wordTag && wordTag.dataset.wordId) {
                    e.stopPropagation();
                    e.preventDefault();
                    
                    // 在home上下文中，使用WordBank的方法切换状态
                    if (options.context === 'home' && typeof WordBank !== 'undefined' && WordBank.toggleWordMasteryStatus) {
                        WordBank.toggleWordMasteryStatus(wordTag, wordTag.dataset.wordId);
                        // 不重新渲染整个视图，只更新当前字的标签颜色（已经在 toggleWordMasteryStatus 中更新了）
                        // 如果需要更新饼图，可以延迟批量更新，避免频繁渲染
                    }
                    // 在wordbank上下文中，已经在bindMasteryEvents中处理
                }
            }, true); // 使用捕获阶段，确保在行点击事件之前处理
        }
        
        container.querySelectorAll('.unit-row').forEach(row => {
            row.addEventListener('click', (e) => {
                // 如果点击的是可点击的字标签，不处理行点击事件
                if (e.target.closest('.word-tag-clickable')) {
                    return; // 让字标签的点击事件处理
                }
                if (e.target.closest('input')) return;
                const checkbox = row.querySelector('.unit-checkbox');
            if (!checkbox) return;
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
        
        // 阻止 header 容器响应点击（除了按钮区域）
        container.querySelectorAll('.practice-semester-header').forEach(header => {
            header.addEventListener('click', (e) => {
                // 如果点击的是复选框区域，只阻止冒泡，不阻止默认行为
                if (e.target.closest('.semester-checkbox-wrapper') || e.target.closest('.semester-checkbox')) {
                    e.stopPropagation();
                    // 不调用 preventDefault()，让复选框正常工作
                }
            }, true);
        });
        
        // 手动控制展开/收起（替代 Bootstrap 的自动处理）
        container.querySelectorAll('.practice-semester-btn[data-collapse-target]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 如果点击的是复选框区域，不处理展开/收起，但也不阻止复选框的默认行为
                if (e.target.closest('.semester-checkbox-wrapper') || e.target.closest('.semester-checkbox')) {
                    e.stopPropagation();
                    // 不调用 preventDefault()，让复选框正常工作
                    return;
                }
                
                const targetId = btn.getAttribute('data-collapse-target');
                const target = document.querySelector(targetId);
                if (!target) return;
                
                const isExpanded = btn.getAttribute('aria-expanded') === 'true';
                
                // 保存状态
                const semesterKey = btn.querySelector('span')?.textContent;
                if (semesterKey) {
                    this.saveCollapseState(container.id, semesterKey, !isExpanded);
                }
                
                // 使用 Bootstrap Collapse API
                if (typeof bootstrap !== 'undefined' && bootstrap.Collapse) {
                    const bsCollapse = new bootstrap.Collapse(target, {
                        toggle: false
                    });
                    
                    if (isExpanded) {
                        bsCollapse.hide();
                        btn.setAttribute('aria-expanded', 'false');
                        btn.classList.add('collapsed');
                    } else {
                        bsCollapse.show();
                        btn.setAttribute('aria-expanded', 'true');
                        btn.classList.remove('collapsed');
                        }
                } else {
                    // Fallback: 手动切换类
                    if (isExpanded) {
                        target.classList.remove('show');
                        btn.setAttribute('aria-expanded', 'false');
                        btn.classList.add('collapsed');
                    } else {
                        target.classList.add('show');
                        btn.setAttribute('aria-expanded', 'true');
                        btn.classList.remove('collapsed');
                    }
                }
            });
        });
    },

    selectAll(container, options = {}) {
        container.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => {
            cb.checked = true;
            cb.indeterminate = false;
        });
        this.updateSelectedCount(container, options);
    },
    
    deselectAll(container, options = {}) {
        container.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => {
            cb.checked = false;
            cb.indeterminate = false;
        });
        this.updateSelectedCount(container, options);
    },
    
    toggleSemester(container, semesterKey, checked) {
        container.querySelectorAll(`.unit-checkbox[data-semester="${semesterKey}"]`).forEach(cb => {
            cb.checked = checked;
        });
    },

    updateSemesterCheckboxState(container, semesterKey) {
        const unitCheckboxes = container.querySelectorAll(`.unit-checkbox[data-semester="${semesterKey}"]`);
        const semesterCheckbox = container.querySelector(`.semester-checkbox[data-semester="${semesterKey}"]`);
        if (!semesterCheckbox) return;
        const allChecked = Array.from(unitCheckboxes).every(cb => cb.checked);
        const someChecked = Array.from(unitCheckboxes).some(cb => cb.checked);
        semesterCheckbox.checked = allChecked;
        semesterCheckbox.indeterminate = someChecked && !allChecked;
    },

    updateSelectedCount(container, options = {}) {
        try {
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
            let total = 0;
            
            // 检查是否开启了「只练错题」开关
            const onlyWrongToggle = container.querySelector('[data-toggle="only-wrong"]');
            const onlyWrong = onlyWrongToggle && onlyWrongToggle.checked;
            
            // 如果开启了「只练错题」，获取所有错题ID
            let errorWordIds = new Set();
            if (onlyWrong) {
                const errorWords = Storage.getErrorWordsFiltered();
                errorWordIds = new Set(errorWords.map(ew => ew.wordId));
            }
            
        const checkedUnits = container.querySelectorAll('.unit-checkbox:checked');
            checkedUnits.forEach(cb => {
                const semester = cb.dataset.semester;
                const unit = cb.dataset.unit;
                const words = grouped[semester]?.[unit];
                if (Array.isArray(words)) {
                    if (onlyWrong) {
                        // 只统计错题数量
                        words.forEach(word => {
                            if (errorWordIds.has(word.id)) {
                                total++;
                            }
                        });
                    } else {
                        // 统计所有字
                        total += words.length;
                    }
            }
        });
            const label = container.querySelector('[data-selected-count]');
            if (label) {
                label.textContent = `已选择: ${total} 个字`;
            }
            this.saveSelection(container);
            if (container.id === 'practice-range-container-home') {
                this.updateDynamicCountButton(total);
            }
        } catch (error) {
            console.error(`[PracticeRange.updateSelectedCount] 错误:`, error);
        }
    },
    
    updateDynamicCountButton(count) {
        const oldBtn = document.getElementById('word-count-quick-dynamic');
        if (oldBtn) oldBtn.remove();
        if (!count || count <= 0) return;
        const quickButtons = document.querySelectorAll('.word-count-quick');
        if (!quickButtons.length) return;
        const lastButton = quickButtons[quickButtons.length - 1];
        const dynamicBtn = document.createElement('button');
        dynamicBtn.type = 'button';
        dynamicBtn.className = 'btn btn-sm btn-outline-primary word-count-quick';
        dynamicBtn.id = 'word-count-quick-dynamic';
        dynamicBtn.dataset.value = String(count);
        dynamicBtn.textContent = String(count);
        dynamicBtn.title = `使用已选择的 ${count} 个字`;
        lastButton.parentNode.insertBefore(dynamicBtn, lastButton.nextSibling);
        dynamicBtn.addEventListener('click', () => {
            const input = document.getElementById('word-count-input-home');
            if (input) {
                input.value = String(count);
            }
        });
    },
    
    getSelectedWords(containerId) {
        const fallback = document.getElementById('practice-range-container') ||
                         document.getElementById('practice-range-container-home');
        const container = containerId ? document.getElementById(containerId) : fallback;
        if (!container) return [];
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        const selectedWords = [];
        
        // 检查是否开启了「只练错题」开关
        const onlyWrongToggle = container.querySelector('[data-toggle="only-wrong"]');
        const onlyWrong = onlyWrongToggle && onlyWrongToggle.checked;
        
        // 如果开启了「只练错题」，获取所有错题ID
        let errorWordIds = new Set();
        if (onlyWrong) {
            const errorWords = Storage.getErrorWordsFiltered();
            errorWordIds = new Set(errorWords.map(ew => ew.wordId));
            }
        
        container.querySelectorAll('.unit-checkbox:checked').forEach(cb => {
            const semester = cb.dataset.semester;
            const unit = cb.dataset.unit;
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                if (onlyWrong) {
                    // 只添加错题
                    words.forEach(word => {
                        if (errorWordIds.has(word.id)) {
                            selectedWords.push(word);
                        }
                    });
                } else {
                    // 添加所有字
                    selectedWords.push(...words);
                }
            }
        });
        return selectedWords;
    },
    
    syncSelection(fromId, toId) {
        const fromRoot = document.getElementById(fromId);
        const toRoot = document.getElementById(toId);
        if (!fromRoot || !toRoot) return;
        const map = new Map();
        toRoot.querySelectorAll('.unit-checkbox').forEach(cb => {
            map.set(`${cb.dataset.semester}__${cb.dataset.unit}`, cb);
        });
        fromRoot.querySelectorAll('.unit-checkbox').forEach(cb => {
            const key = `${cb.dataset.semester}__${cb.dataset.unit}`;
            const target = map.get(key);
            if (target) {
                target.checked = cb.checked;
            }
        });
        this.updateSelectedCount(toRoot, { context: toRoot.id === 'practice-range-container-home' ? 'home' : 'modal' });
    },
    
    /**
     * 更新首页管理模式的选中数量
     */
    updateHomeSelectedCount(container) {
        // 统计选中的单元中的字数量（考虑「只练错题」开关）
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        let total = 0;
        
        // 检查是否开启了「只练错题」开关
        const onlyWrongToggle = container.querySelector('[data-toggle="only-wrong"]');
        const onlyWrong = onlyWrongToggle && onlyWrongToggle.checked;
        
        // 如果开启了「只练错题」，获取所有错题ID
        let errorWordIds = new Set();
        if (onlyWrong) {
            const errorWords = Storage.getErrorWordsFiltered();
            errorWordIds = new Set(errorWords.map(ew => ew.wordId));
        }
        
        const selected = container.querySelectorAll('.unit-checkbox:checked');
        selected.forEach(cb => {
            const semester = cb.dataset.semester;
            const unit = cb.dataset.unit;
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                if (onlyWrong) {
                    // 只统计错题数量
                    words.forEach(word => {
                        if (errorWordIds.has(word.id)) {
                            total++;
                        }
                    });
                } else {
                    // 统计所有字
                    total += words.length;
                }
            }
        });
        
        const countEl = document.getElementById('home-selected-count');
        const toolbar = document.getElementById('home-batch-toolbar');
        const unpracticedBtn = document.getElementById('home-batch-unpracticed-btn');
        const masterBtn = document.getElementById('home-batch-master-btn');
        const errorBtn = document.getElementById('home-batch-error-btn');
        
        if (countEl) countEl.textContent = total;
        if (toolbar) {
            toolbar.classList.toggle('d-none', total === 0);
            toolbar.style.display = total > 0 ? 'flex' : 'none';
        }
        const disabled = total === 0;
        if (unpracticedBtn) unpracticedBtn.disabled = disabled;
        if (masterBtn) masterBtn.disabled = disabled;
        if (errorBtn) errorBtn.disabled = disabled;
    },
    
    setErrorWordsFromLog(errorWordIds) {
        if (!errorWordIds || errorWordIds.length === 0) return;
        try {
            localStorage.setItem('practice_error_word_ids', JSON.stringify(errorWordIds));
        } catch (e) {
            console.error('保存错题ID列表失败:', e);
        }
    },

    groupWordsBySemesterUnit(wordBank) {
        const grouped = {};
        // 确保 wordBank 是数组
        if (!Array.isArray(wordBank)) {
            console.warn('[PracticeRange.groupWordsBySemesterUnit] wordBank 不是数组:', wordBank);
            return grouped;
        }
        wordBank.forEach(word => {
            const gradeLabel = this.formatGradeLabel(word.grade);
            const semesterLabel = this.formatSemesterLabel(word.semester);
            const semesterKey = `${gradeLabel}${semesterLabel}`;
            const unitLabel = word.unitLabel || this.formatUnitLabel(word.unit);
            const unitOrder = this.getUnitOrder(word, unitLabel);
            const unitKey = `${unitLabel || '未分类单元'}__${unitOrder ?? '999'}`;
            if (!grouped[semesterKey]) grouped[semesterKey] = {};
            if (!grouped[semesterKey][unitKey]) {
                const arr = [];
                arr.unitLabel = unitLabel;
                arr.order = unitOrder ?? 999;
                grouped[semesterKey][unitKey] = arr;
            }
            grouped[semesterKey][unitKey].push(word);
        });
        return grouped;
    },

    sortSemesters(semesters) {
        return semesters.sort((a, b) => {
            const ga = this.extractGradeNumber(a);
            const gb = this.extractGradeNumber(b);
            if (ga !== gb) return ga - gb;
            const sa = a.includes('下册') ? 1 : 0;
            const sb = b.includes('下册') ? 1 : 0;
            return sa - sb;
        });
    },

    sortUnits(semesterObj) {
        return Object.keys(semesterObj).sort((a, b) => {
            const orderA = semesterObj[a].order ?? 999;
            const orderB = semesterObj[b].order ?? 999;
            if (orderA !== orderB) return orderA - orderB;
            return a.localeCompare(b, 'zh-Hans-CN');
        });
    },

    extractGradeNumber(label) {
        const map = { '一':1, '二':2, '三':3, '四':4, '五':5, '六':6 };
        const match = label.match(/([一二三四五六])年级/);
        if (match) return map[match[1]] || 0;
        const num = parseInt(label, 10);
        return isNaN(num) ? 0 : num;
    },

    getUnitOrder(word, unitLabel) {
        if (typeof word.unit === 'number') return word.unit;
        if (typeof word.unitOrder === 'number') return word.unitOrder;
        const match = unitLabel && unitLabel.match(/\d+/);
        if (match) return parseInt(match[0], 10);
        return 999;
    },

    formatGradeLabel(grade) {
        if (typeof grade === 'string' && grade.includes('年级')) return grade;
        const map = ['零','一','二','三','四','五','六'];
        if (typeof grade === 'number' && grade >= 1 && grade <= 6) {
            return `${map[grade]}年级`;
        }
        return `${grade || 3}年级`;
    },

    formatSemesterLabel(semester) {
        if (!semester) return '上册';
        if (typeof semester === 'string' && semester.includes('下')) return '下册';
        return '上册';
    },

    formatUnitLabel(unit) {
        if (!unit && unit !== 0) return '未分类单元';
        if (typeof unit === 'number') return `第${unit}单元`;
        return unit;
    },

    formatUnitPreview(words, limit = 20) {
        return words.slice(0, limit).map(w => w.word).join('、') + (words.length > limit ? '…' : '');
    },

    sanitizeId(str) {
        return str.replace(/[^\w\u4e00-\u9fa5-]/g, '');
    },

    saveSelection(container) {
        try {
            const selection = this.getSavedSelection();
            container.querySelectorAll('.unit-checkbox').forEach(cb => {
                const semester = cb.dataset.semester;
                const unit = cb.dataset.unit;
                if (!selection[semester]) selection[semester] = [];
                const exists = selection[semester].includes(unit);
                if (cb.checked && !exists) selection[semester].push(unit);
                if (!cb.checked && exists) {
                    selection[semester] = selection[semester].filter(u => u !== unit);
            }
        });
            localStorage.setItem('practiceRangeSelection', JSON.stringify(selection));
        } catch (err) {
            console.warn('保存练习范围选择失败:', err);
        }
    },

    restoreSelection(container) {
        try {
            const saved = this.getSavedSelection();
            if (!saved) return;
            Object.keys(saved).forEach(semester => {
                const units = saved[semester] || [];
                units.forEach(unit => {
                    const checkbox = container.querySelector(`.unit-checkbox[data-semester="${semester}"][data-unit="${unit}"]`);
                    if (checkbox) checkbox.checked = true;
                });
                this.updateSemesterCheckboxState(container, semester);
            });
        } catch (err) {
            console.warn('恢复练习范围选择失败:', err);
        }
    },

    getSavedSelection() {
        try {
            const saved = localStorage.getItem('practiceRangeSelection');
            return saved ? JSON.parse(saved) : {};
        } catch (err) {
            return {};
        }
    },
    
    /**
     * 获取选中的学期集合
     */
    getSelectedSemesters(container) {
        const selectedSemesters = new Set();
        const saved = this.getSavedSelection();
        Object.keys(saved).forEach(semester => {
            const units = saved[semester] || [];
            if (units.length > 0) {
                selectedSemesters.add(semester);
            }
        });
        return selectedSemesters;
    }
};
