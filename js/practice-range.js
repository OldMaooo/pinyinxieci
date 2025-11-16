/**
 * 练习范围选择模块
 * 支持单选、多选、全选、按学期、shift连续选择
 */

const PracticeRange = {
    /**
     * 初始化题库范围选择界面
     */
    init() {
        const container = document.getElementById('practice-range-container');
        if (!container) {
            console.warn('practice-range-container not found');
            return;
        }
        
        // 确保Storage已初始化
        if (typeof Storage === 'undefined' || !Storage.getWordBank) {
            console.error('Storage未初始化，无法加载范围选择器');
            container.innerHTML = '<div class="text-danger">数据加载失败，请刷新页面</div>';
            return;
        }
        
        try {
            this.renderRangeSelector(container);
            this.bindEvents();
        } catch (error) {
            console.error('初始化范围选择器失败:', error);
            container.innerHTML = `<div class="text-danger">初始化失败: ${error.message}</div>`;
        }

        // 首页范围容器
        const homeContainer = document.getElementById('practice-range-container-home');
        if (homeContainer) {
            try {
                this.renderHomeRangeSelector(homeContainer);
                this.bindHomeEvents(homeContainer);
            } catch (error) {
                homeContainer.innerHTML = `<div class="text-danger">初始化失败: ${error.message}</div>`;
            }
        }
    },
    
    /**
     * 渲染范围选择器
     */
    renderRangeSelector(container) {
        const wordBank = Storage.getWordBank();
        
        // 按学期和单元分组
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        
        let html = '<div class="practice-range-selector">';
        
        // 全选/全不选按钮
        html += `
            <div class="mb-3">
                <button class="btn btn-sm btn-outline-primary" id="select-all-btn">全选</button>
                <button class="btn btn-sm btn-outline-secondary" id="deselect-all-btn">全不选</button>
                <button class="btn btn-sm btn-outline-info" id="select-semester-btn">全选本学年</button>
                <span class="ms-3 text-muted" id="selected-count">已选择: 0 个字</span>
            </div>
        `;
        
        // 按学期显示
        const semesters = Object.keys(grouped).sort();
        
        semesters.forEach(semester => {
            html += `<div class="semester-group mb-4">`;
            html += `<h6 class="mb-2">
                <input type="checkbox" class="form-check-input semester-checkbox" 
                       data-semester="${semester}" id="semester-${semester}">
                <label for="semester-${semester}" class="form-check-label ms-2">
                    ${semester}学期
                </label>
            </h6>`;
            
            // 按单元显示
            const units = Object.keys(grouped[semester]).sort((a, b) => parseInt(a) - parseInt(b));
            
            html += `<div class="units-container ms-4">`;
            units.forEach(unit => {
                const words = grouped[semester][unit];
                html += `
                    <div class="unit-item mb-2">
                        <input type="checkbox" class="form-check-input unit-checkbox" 
                               data-semester="${semester}" data-unit="${unit}" 
                               id="unit-${semester}-${unit}">
                        <label for="unit-${semester}-${unit}" class="form-check-label ms-2">
                            第${unit}单元 (${words.length}个字)
                        </label>
                        <span class="text-muted ms-2 small">
                            ${words.slice(0, 5).map(w => w.word).join('、')}${words.length > 5 ? '...' : ''}
                        </span>
                    </div>
                `;
            });
            html += `</div></div>`;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
        // 默认全选
        this.selectAll();
    },
    
    /**
     * 首页渲染（带工具栏、只练错题、整行点击）
     */
    renderHomeRangeSelector(container) {
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        
        let html = '<div class="practice-range-selector">';
        
        // 工具栏（置顶吸附）
        html += `
            <div class="practice-range-toolbar sticky-top border-bottom p-2" style="z-index: 10;">
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    <button class="btn btn-sm btn-outline-primary" data-action="select-all">全选</button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="deselect-all">全不选</button>
                    <div class="form-check form-switch m-0">
                        <input class="form-check-input" type="checkbox" data-toggle="only-wrong" id="only-wrong-home" />
                        <label class="form-check-label" for="only-wrong-home">只练错题</label>
                    </div>
                    <span class="ms-auto text-muted" data-selected-count>已选择: 0 个字</span>
                </div>
            </div>
            <div class="p-3">
        `;
        
        // 按学期显示
        const semesters = Object.keys(grouped).sort();
        semesters.forEach(semester => {
            html += `<div class="semester-group mb-3">`;
            html += `<h6 class="mb-2">
                <input type="checkbox" class="form-check-input semester-checkbox" 
                       data-semester="${semester}">
                <label class="form-check-label ms-2">${semester}学期</label>
            </h6>`;
            
            // 按单元显示
            const units = Object.keys(grouped[semester]).sort((a, b) => parseInt(a) - parseInt(b));
            html += `<div class="units-container ms-4">`;
            units.forEach(unit => {
                const words = grouped[semester][unit];
                const rowId = `unit-${semester}-${unit}`.replace(/\s+/g, '-');
                html += `
                    <div class="unit-item mb-2 d-flex align-items-center" data-semester="${semester}" data-unit="${unit}" data-row-id="${rowId}" style="cursor: pointer;">
                        <input type="checkbox" class="form-check-input unit-checkbox" 
                               data-semester="${semester}" data-unit="${unit}">
                        <label class="form-check-label ms-2 flex-shrink-0">
                            第${unit}单元 (${words.length}个字)
                        </label>
                        <span class="text-muted ms-2 small flex-grow-1 text-truncate" style="min-width: 0;">
                            ${words.slice(0, 20).map(w => w.word).join('、')}${words.length > 20 ? '...' : ''}
                        </span>
                    </div>
                `;
            });
            html += `</div></div>`;
        });
        
        html += '</div></div>'; // p-3 + selector
        container.innerHTML = html;
        
        // 默认全选
        container.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => cb.checked = true);
        this.updateSelectedCountHome(container);
        
        // 只练错题初始状态
        const toggle = container.querySelector('[data-toggle="only-wrong"]');
        if (toggle) {
            try {
                toggle.checked = localStorage.getItem('practice_error_only') === '1';
            } catch(e) {}
        }
    },
    
    /**
     * 按学期和单元分组
     */
    groupWordsBySemesterUnit(wordBank) {
        const grouped = {};
        
        wordBank.forEach(word => {
            const semester = `${word.grade || 3}年级${word.semester || '上'}学期`;
            const unit = word.unit || 1;
            
            if (!grouped[semester]) {
                grouped[semester] = {};
            }
            if (!grouped[semester][unit]) {
                grouped[semester][unit] = [];
            }
            
            grouped[semester][unit].push(word);
        });
        
        return grouped;
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 全选/全不选
        const selectAllBtn = document.getElementById('select-all-btn');
        const deselectAllBtn = document.getElementById('deselect-all-btn');
        const selectSemesterBtn = document.getElementById('select-semester-btn');
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => this.selectAll());
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => this.deselectAll());
        }
        
        if (selectSemesterBtn) {
            selectSemesterBtn.addEventListener('click', () => {
                // 获取当前学年（最常见的学期）
                const wordBank = Storage.getWordBank();
                const semester = wordBank.length > 0 ? 
                    `${wordBank[0].grade || 3}年级${wordBank[0].semester || '上'}学期` : null;
                if (semester) {
                    this.selectSemester(semester);
                }
            });
        }
        
        // 学期复选框
        document.querySelectorAll('.semester-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const semester = e.target.dataset.semester;
                if (e.target.checked) {
                    this.selectSemester(semester);
                } else {
                    this.deselectSemester(semester);
                }
            });
        });
        
        // 单元复选框
        document.querySelectorAll('.unit-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSemesterCheckbox(checkbox.dataset.semester);
                this.updateSelectedCount();
            });
            
            // Shift键连续选择
            checkbox.addEventListener('click', (e) => {
                if (e.shiftKey && this.lastClickedUnit) {
                    this.selectRange(this.lastClickedUnit, {
                        semester: checkbox.dataset.semester,
                        unit: checkbox.dataset.unit
                    });
                    e.preventDefault();
                } else {
                    this.lastClickedUnit = {
                        semester: checkbox.dataset.semester,
                        unit: checkbox.dataset.unit
                    };
                }
            });
        });
        
        // 更新选中数量
        this.updateSelectedCount();
    },
    
    /**
     * 首页事件绑定（作用域限于container）
     */
    bindHomeEvents(container) {
        // 全选/全不选
        container.querySelectorAll('[data-action="select-all"]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => cb.checked = true);
                this.updateSelectedCountHome(container);
            });
        });
        container.querySelectorAll('[data-action="deselect-all"]').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => cb.checked = false);
                this.updateSelectedCountHome(container);
            });
        });
        
        // 只练错题开关
        const onlyWrongToggle = container.querySelector('[data-toggle="only-wrong"]');
        if (onlyWrongToggle) {
            onlyWrongToggle.addEventListener('change', (e) => {
                try {
                    if (e.target.checked) localStorage.setItem('practice_error_only', '1');
                    else localStorage.removeItem('practice_error_only');
                } catch(err) {}
            });
        }
        
        // 学期复选框联动
        container.querySelectorAll('.semester-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const semester = e.target.dataset.semester;
                container.querySelectorAll(`.unit-checkbox[data-semester="${semester}"]`).forEach(cb => {
                    cb.checked = e.target.checked;
                });
                this.updateSelectedCountHome(container);
            });
        });
        
        // 单元整行点击与Shift连续
        let lastClickedUnitKey = null;
        container.querySelectorAll('.unit-item').forEach(item => {
            const checkbox = item.querySelector('.unit-checkbox');
            const unitKey = `${item.dataset.semester}::${item.dataset.unit}`;
            if (!checkbox) return;
            
            // 整行点击切换
            item.addEventListener('click', (e) => {
                if (e.target === checkbox || e.target.closest('.form-check-input')) return;
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            });
            
            // 复选框变更更新计数
            checkbox.addEventListener('change', () => this.updateSelectedCountHome(container));
            
            // Shift连续选择
            checkbox.addEventListener('click', (e) => {
                if (e.shiftKey && lastClickedUnitKey) {
                    const [fromSem, fromUnit] = lastClickedUnitKey.split('::');
                    const [toSem, toUnit] = unitKey.split('::');
                    if (fromSem === toSem) {
                        const all = Array.from(container.querySelectorAll(`.unit-checkbox[data-semester="${toSem}"]`))
                          .map(cb => ({ element: cb, unit: parseInt(cb.dataset.unit) }))
                          .sort((a, b) => a.unit - b.unit);
                        const fromIdx = all.findIndex(x => x.unit === parseInt(fromUnit));
                        const toIdx = all.findIndex(x => x.unit === parseInt(toUnit));
                        if (fromIdx !== -1 && toIdx !== -1) {
                            const start = Math.min(fromIdx, toIdx), end = Math.max(fromIdx, toIdx);
                            for (let i = start; i <= end; i++) all[i].element.checked = true;
                            this.updateSelectedCountHome(container);
                        }
                    }
                    e.preventDefault();
                } else {
                    lastClickedUnitKey = unitKey;
                }
            });
        });
        
        // 初次更新动态题目数按钮
        this.updateSelectedCountHome(container);
    },
    
    /**
     * 全选
     */
    selectAll() {
        document.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => {
            cb.checked = true;
        });
        this.updateSelectedCount();
    },
    
    /**
     * 全不选
     */
    deselectAll() {
        document.querySelectorAll('.unit-checkbox, .semester-checkbox').forEach(cb => {
            cb.checked = false;
        });
        this.updateSelectedCount();
    },
    
    /**
     * 选择整个学期
     */
    selectSemester(semester) {
        document.querySelectorAll(`.unit-checkbox[data-semester="${semester}"]`).forEach(cb => {
            cb.checked = true;
        });
        document.getElementById(`semester-${semester}`).checked = true;
        this.updateSelectedCount();
    },
    
    /**
     * 取消选择整个学期
     */
    deselectSemester(semester) {
        document.querySelectorAll(`.unit-checkbox[data-semester="${semester}"]`).forEach(cb => {
            cb.checked = false;
        });
        this.updateSelectedCount();
    },
    
    /**
     * Shift连续选择
     */
    selectRange(from, to) {
        // 找到所有单元复选框
        const allUnits = Array.from(document.querySelectorAll('.unit-checkbox'))
            .map(cb => ({
                element: cb,
                semester: cb.dataset.semester,
                unit: parseInt(cb.dataset.unit)
            }));
        
        // 筛选同学期的单元
        const sameSemester = allUnits.filter(u => 
            u.semester === from.semester && u.semester === to.semester
        );
        
        if (sameSemester.length === 0) return;
        
        // 排序
        sameSemester.sort((a, b) => a.unit - b.unit);
        
        // 找到起止位置
        const fromIndex = sameSemester.findIndex(u => 
            u.semester === from.semester && u.unit === parseInt(from.unit)
        );
        const toIndex = sameSemester.findIndex(u => 
            u.semester === to.semester && u.unit === parseInt(to.unit)
        );
        
        if (fromIndex === -1 || toIndex === -1) return;
        
        // 选择范围内的所有单元
        const start = Math.min(fromIndex, toIndex);
        const end = Math.max(fromIndex, toIndex);
        
        for (let i = start; i <= end; i++) {
            sameSemester[i].element.checked = true;
        }
        
        // 更新学期复选框
        this.updateSemesterCheckbox(from.semester);
        this.updateSelectedCount();
    },
    
    /**
     * 更新学期复选框状态
     */
    updateSemesterCheckbox(semester) {
        const units = document.querySelectorAll(`.unit-checkbox[data-semester="${semester}"]`);
        const checkedUnits = document.querySelectorAll(`.unit-checkbox[data-semester="${semester}"]:checked`);
        const semesterCheckbox = document.getElementById(`semester-${semester}`);
        
        if (semesterCheckbox) {
            semesterCheckbox.checked = units.length === checkedUnits.length && units.length > 0;
            semesterCheckbox.indeterminate = checkedUnits.length > 0 && checkedUnits.length < units.length;
        }
    },
    
    /**
     * 更新选中数量
     */
    updateSelectedCount() {
        const checkedUnits = document.querySelectorAll('.unit-checkbox:checked');
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        
        let totalCount = 0;
        checkedUnits.forEach(checkbox => {
            const semester = checkbox.dataset.semester;
            const unit = checkbox.dataset.unit;
            if (grouped[semester] && grouped[semester][unit]) {
                totalCount += grouped[semester][unit].length;
            }
        });
        
        const countEl = document.getElementById('selected-count');
        if (countEl) {
            countEl.textContent = `已选择: ${totalCount} 个字`;
            countEl.className = totalCount > 0 ? 'ms-3 text-success fw-bold' : 'ms-3 text-muted';
        }
    },
    
    /**
     * 首页：更新选中数量并刷新动态题目数量按钮
     */
    updateSelectedCountHome(container) {
        const checkedUnits = container.querySelectorAll('.unit-checkbox:checked');
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        
        let totalCount = 0;
        checkedUnits.forEach(checkbox => {
            const semester = checkbox.dataset.semester;
            const unit = checkbox.dataset.unit;
            if (grouped[semester] && grouped[semester][unit]) {
                totalCount += grouped[semester][unit].length;
            }
        });
        
        const countEl = container.querySelector('[data-selected-count]');
        if (countEl) {
            countEl.textContent = `已选择: ${totalCount} 个字`;
            countEl.className = totalCount > 0 ? 'ms-auto text-success fw-bold' : 'ms-auto text-muted';
        }
        
        // 更新首页动态题目数量按钮
        this.updateDynamicCountButton(totalCount);
    },
    
    /**
     * 在首页题目设置区域插入/更新动态题目数量按钮
     */
    updateDynamicCountButton(count) {
        // 移除旧的动态按钮
        const oldBtn = document.getElementById('word-count-quick-dynamic');
        if (oldBtn) oldBtn.remove();
        
        if (!count || count <= 0) return;
        
        const quickButtons = document.querySelectorAll('.word-count-quick');
        if (!quickButtons || quickButtons.length === 0) return;
        const lastButton = quickButtons[quickButtons.length - 1];
        const dynamicBtn = document.createElement('button');
        dynamicBtn.type = 'button';
        dynamicBtn.className = 'btn btn-sm btn-outline-primary word-count-quick';
        dynamicBtn.id = 'word-count-quick-dynamic';
        dynamicBtn.dataset.value = String(count);
        dynamicBtn.textContent = String(count);
        dynamicBtn.title = `使用已选择的 ${count} 个字`;
        lastButton.parentNode.insertBefore(dynamicBtn, lastButton.nextSibling);
        
        // 点击写入输入框并同步下拉
        dynamicBtn.addEventListener('click', () => {
            const input = document.getElementById('word-count-input-home');
            const select = document.getElementById('word-count-select-home');
            if (input) {
                input.value = String(count);
                input.focus();
            }
            if (select) {
                select.value = '';
            }
        });
    },
    
    /**
     * 获取选中的字
     */
    getSelectedWords(rootId) {
        const root = rootId ? document.getElementById(rootId) : document;
        const checkedUnits = root.querySelectorAll('.unit-checkbox:checked');
        const wordBank = Storage.getWordBank();
        const grouped = this.groupWordsBySemesterUnit(wordBank);
        
        const selectedWords = [];
        
        checkedUnits.forEach(checkbox => {
            const semester = checkbox.dataset.semester;
            const unit = checkbox.dataset.unit;
            if (grouped[semester] && grouped[semester][unit]) {
                selectedWords.push(...grouped[semester][unit]);
            }
        });
        
        return selectedWords;
    },
    
    /**
     * 从一个范围选择容器同步选择状态到另一个容器
     */
    syncSelection(fromId, toId) {
        const fromRoot = document.getElementById(fromId);
        const toRoot = document.getElementById(toId);
        if (!fromRoot || !toRoot) return;
        const fromChecks = fromRoot.querySelectorAll('.unit-checkbox');
        fromChecks.forEach(fromCb => {
            const sel = fromCb.getAttribute('data-semester');
            const unit = fromCb.getAttribute('data-unit');
            const target = toRoot.querySelector(`.unit-checkbox[data-semester="${sel}"][data-unit="${unit}"]`);
            if (target) target.checked = fromCb.checked;
        });
    }
};

