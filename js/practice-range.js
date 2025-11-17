/**
 * 练习范围选择模块
 * 参考 @语文-识字 的交互：按年级展开/收起、可保存选择、支持动态题量按钮
 */
const PracticeRange = {
    init() {
        this.refresh();
    },

    refresh() {
        console.log('[PracticeRange] refresh() triggered');
        this.renderContainer('practice-range-container', { context: 'modal' });
        this.renderContainer('practice-range-container-home', {
            context: 'home',
            stickyToolbar: true,
            showOnlyWrongToggle: true
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
        console.log(`[PracticeRange] renderContainer(${containerId}) wordBank size = ${wordBank.length}`);
        if (wordBank.length === 0) {
            container.innerHTML = '<div class="text-muted py-3 text-center">正在加载默认题库，请稍候…</div>';
            return;
        }

        const grouped = this.groupWordsBySemesterUnit(wordBank);
        console.log(`[PracticeRange] ${containerId} grouped semesters:`, Object.keys(grouped));
        const semesters = this.sortSemesters(Object.keys(grouped));
        const accordionId = `${containerId}-accordion`;

        let html = '<div class="practice-range-selector">';
        html += this.renderToolbar(options);
        html += '<div class="p-3">';
        html += `<div class="accordion" id="${accordionId}">`;

        semesters.forEach((semesterKey, idx) => {
            const units = this.sortUnits(grouped[semesterKey]);
            const headingId = `${accordionId}-heading-${idx}`;
            const collapseId = `${accordionId}-collapse-${idx}`;
            const isFirst = idx === 0;

            html += `
                <div class="accordion-item">
                    <h2 class="accordion-header" id="${headingId}">
                        <button class="accordion-button ${isFirst ? '' : 'collapsed'}" type="button"
                                data-bs-toggle="collapse" data-bs-target="#${collapseId}"
                                aria-expanded="${isFirst}" aria-controls="${collapseId}">
                            <input type="checkbox" class="form-check-input semester-checkbox me-2"
                                   data-semester="${semesterKey}"
                                   onclick="event.stopPropagation();">
                            <span>${semesterKey}</span>
                        </button>
                    </h2>
                    <div id="${collapseId}"
                         class="accordion-collapse collapse ${isFirst ? 'show' : ''}"
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
        const { stickyToolbar = false, showOnlyWrongToggle = false } = options;
        const stickyClasses = stickyToolbar
            ? 'practice-range-toolbar sticky-top border-bottom bg-body p-2'
            : 'practice-range-toolbar border-bottom p-2';
        return `
            <div class="${stickyClasses}" style="z-index: 10;">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <button class="btn btn-sm btn-outline-primary" data-action="select-all">全选</button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="deselect-all">全不选</button>
                    ${showOnlyWrongToggle ? `
                        <div class="form-check form-switch m-0">
                            <input class="form-check-input" type="checkbox" data-toggle="only-wrong" id="only-wrong-toggle">
                            <label class="form-check-label" for="only-wrong-toggle">只练错题</label>
                        </div>
                    ` : ''}
                    <span class="ms-auto text-muted" data-selected-count>已选择: 0 个字</span>
                </div>
            </div>
        `;
    },

    bindContainerEvents(container, options = {}) {
        container.querySelector('[data-action="select-all"]')?.addEventListener('click', () => {
            this.selectAll(container, options);
        });
        container.querySelector('[data-action="deselect-all"]')?.addEventListener('click', () => {
            this.deselectAll(container, options);
        });

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
                        console.warn('保存“只练错题”状态失败', err);
                    }
                });
            }
        }

        container.querySelectorAll('.semester-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const semester = e.target.dataset.semester;
                this.toggleSemester(container, semester, e.target.checked);
                this.updateSelectedCount(container, options);
            });
        });

        container.querySelectorAll('.unit-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSemesterCheckboxState(container, checkbox.dataset.semester);
                this.updateSelectedCount(container, options);
            });
        });

        container.querySelectorAll('.unit-row').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('input')) return;
                const checkbox = row.querySelector('.unit-checkbox');
                if (!checkbox) return;
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
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
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        let total = 0;
        container.querySelectorAll('.unit-checkbox:checked').forEach(cb => {
            const semester = cb.dataset.semester;
            const unit = cb.dataset.unit;
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                total += words.length;
            }
        });
        const label = container.querySelector('[data-selected-count]');
        if (label) {
            label.textContent = `已选择: ${total} 个字`;
        }
        console.log(`[PracticeRange] container=${container.id} 已选择 ${total} 个字`);
        this.saveSelection(container);
        if (container.id === 'practice-range-container-home') {
            this.updateDynamicCountButton(total);
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
        container.querySelectorAll('.unit-checkbox:checked').forEach(cb => {
            const semester = cb.dataset.semester;
            const unit = cb.dataset.unit;
            const words = grouped[semester]?.[unit];
            if (Array.isArray(words)) {
                selectedWords.push(...words);
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
    }
};
