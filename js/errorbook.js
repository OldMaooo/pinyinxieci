/**
 * 错题本模块
 */

const ErrorBook = {
    pendingPracticeWordIds: [],
    practiceModalInstance: null,
    /**
     * 加载错题本
     */
    load() {
        const errorWords = Storage.getErrorWordsFiltered();
        const empty = document.getElementById('errorbook-empty');
        const adminMode = localStorage.getItem('adminMode') === '1';
        const roundsEl = document.getElementById('errorbook-rounds');
        const summaryEl = document.getElementById('errorbook-summary');
        const toolbar = document.getElementById('errorbook-toolbar');
        const toggleAllCheckbox = document.getElementById('errorbook-toggle-all');
        const batchRemoveBtn = document.getElementById('errorbook-batch-remove');
        const batchDeleteBtn = document.getElementById('errorbook-batch-delete');
        const onlyWrongToggle = document.getElementById('errorbook-only-wrong');
        const onlyWrongContainer = onlyWrongToggle ? onlyWrongToggle.closest('.form-check') : null;
        const onlyWrong = !!(onlyWrongToggle && onlyWrongToggle.checked);
        const hasErrors = Array.isArray(errorWords) && errorWords.length > 0;

        if (toolbar) {
            toolbar.classList.remove('d-none');
            toolbar.classList.toggle('opacity-50', !hasErrors);
        }
        if (toggleAllCheckbox) {
            toggleAllCheckbox.disabled = !hasErrors;
            toggleAllCheckbox.checked = false;
            toggleAllCheckbox.indeterminate = false;
        }
        if (batchRemoveBtn) batchRemoveBtn.disabled = true;
        if (batchDeleteBtn) batchDeleteBtn.disabled = true;
        if (!hasErrors) {
            if (roundsEl) roundsEl.innerHTML = '';
            if (summaryEl) summaryEl.innerHTML = '';
            empty.style.display = 'block';
            this.updateErrorCount(0);
            this.updateBatchToolbarState();
            return;
        }

        empty.style.display = 'none';

        this.renderRoundsView(adminMode, { onlyWrong });
        this.renderSummaryView(adminMode);

        const tabRounds = document.getElementById('tab-rounds');
        const tabSummary = document.getElementById('tab-summary');
        const updateOnlyWrongVisibility = (show) => {
            if (onlyWrongContainer) {
                onlyWrongContainer.style.display = show ? '' : 'none';
            }
        };

        if (tabRounds && tabSummary) {
            const applyTabState = (showRounds) => {
                tabRounds.classList.toggle('active', showRounds);
                tabSummary.classList.toggle('active', !showRounds);
                roundsEl.classList.toggle('d-none', !showRounds);
                summaryEl.classList.toggle('d-none', showRounds);
                updateOnlyWrongVisibility(showRounds);
            };
            tabRounds.onclick = () => applyTabState(true);
            tabSummary.onclick = () => applyTabState(false);
            const initialRoundsActive = tabRounds.classList.contains('active') || !tabSummary.classList.contains('active');
            applyTabState(initialRoundsActive);
        }

        if (toggleAllCheckbox) {
            toggleAllCheckbox.onchange = () => this.toggleSelectAll(toggleAllCheckbox.checked);
        }
        if (batchRemoveBtn) batchRemoveBtn.onclick = () => this.batchRemove();
        if (batchDeleteBtn) batchDeleteBtn.onclick = () => this.batchDelete();

        if (onlyWrongToggle) {
            onlyWrongToggle.onchange = () => this.load();
        }

        this.updateErrorCount();
        this.updateBatchToolbarState();
    },

    initResultToggleControls(root) {
        if (!root) return;
        const updateToggleVisual = (btn, isWrong) => {
            btn.classList.toggle('active', isWrong);
            const icon = btn.querySelector('.result-toggle-icon');
            if (icon) {
                icon.textContent = isWrong ? '✕' : '';
            }
            btn.setAttribute('data-is-wrong', isWrong ? 'true' : 'false');
        };

        root.querySelectorAll('.result-toggle').forEach(btn => {
            let isWrong = btn.getAttribute('data-is-wrong') === 'true';
            updateToggleVisual(btn, isWrong);
            btn.addEventListener('click', () => {
                isWrong = !isWrong;
                updateToggleVisual(btn, isWrong);
                if (typeof Statistics !== 'undefined' && Statistics.updateResultItemStatus) {
                    const logId = btn.getAttribute('data-log-id');
                    const itemIdx = parseInt(btn.getAttribute('data-item-idx'), 10);
                    if (!Number.isNaN(itemIdx)) {
                        Statistics.updateResultItemStatus(logId, itemIdx, !isWrong);
                    }
                }
                // 确保确认修改按钮被启用
                if (typeof Statistics !== 'undefined') {
                    Statistics.hasChanges = true;
                    const confirmBtn = document.getElementById('confirm-changes-btn');
                    if (confirmBtn) {
                        confirmBtn.disabled = false;
                    }
                }
            });
        });
    },

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    bindSelectionCheckboxEvents(root) {
        if (!root) return;
        root.querySelectorAll('.error-select').forEach(cb => {
            cb.addEventListener('change', () => this.updateBatchToolbarState());
        });
        this.updateBatchToolbarState();
    },

    updateBatchToolbarState() {
        const selectedBadge = document.getElementById('errorbook-selected-count');
        const selectedCount = document.querySelectorAll('.error-select:checked').length;
        const totalCount = document.querySelectorAll('.error-select').length;
        const toggleAll = document.getElementById('errorbook-toggle-all');
        const batchRemoveBtn = document.getElementById('errorbook-batch-remove');
        const batchDeleteBtn = document.getElementById('errorbook-batch-delete');

        if (toggleAll && !toggleAll.disabled) {
            toggleAll.indeterminate = selectedCount > 0 && selectedCount < totalCount;
            toggleAll.checked = totalCount > 0 && selectedCount === totalCount;
        }

        const hasSelection = selectedCount > 0;
        if (batchRemoveBtn) batchRemoveBtn.disabled = !hasSelection;
        if (batchDeleteBtn) batchDeleteBtn.disabled = !hasSelection;

        if (selectedBadge) {
            const countEl = selectedBadge.querySelector('strong');
            if (countEl) countEl.textContent = selectedCount;
            selectedBadge.classList.toggle('d-none', !hasSelection);
        }
    },

    updateErrorCount(count) {
        const totalEl = document.getElementById('errorbook-total-count');
        if (!totalEl) return;
        let value = typeof count === 'number' ? count : null;
        if (value === null) {
            value = document.querySelectorAll('.error-select').length;
        }
        totalEl.textContent = value;
    },

    renderRoundsView(adminMode, opts = {}) {
        const onlyWrong = !!opts.onlyWrong;
        const roundsEl = document.getElementById('errorbook-rounds');
        if (!roundsEl) return;
        const rawLogs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs() || [];
        const completedLogs = rawLogs.filter(log => log && log.status === 'completed');
        const logs = completedLogs.slice().reverse();
        const wordBank = Storage.getWordBank();
        const roundSelection = this.ensureDefaultRoundSelection(logs);
        const selectedRounds = new Set(roundSelection);
        const htmlChunks = [];
        
        logs.forEach((log, idx) => {
            const baseItems = (Array.isArray(log.details) && log.details.length
                ? log.details.map((item, detailIdx) => ({ ...item, _idx: detailIdx }))
                : (log.errorWords || []).map((id, detailIdx) => ({ wordId: id, correct: false, snapshot: null, _idx: detailIdx })));
            const filteredItems = onlyWrong ? baseItems.filter(d => d.correct === false) : baseItems;
            const cards = filteredItems.map((d) => {
                const id = d.wordId;
                const w = wordBank.find(x => x.id === id);
                if (!w) return '';
                const latestSnapshot = d.snapshot || '';
                const fallbackGroups = typeof WordGroups !== 'undefined'
                    ? WordGroups.getDisplayText(w.word, w.pinyin || '')
                    : (w.pinyin || '');
                const storedDisplay = d.displayText || '';
                const groupsTextRaw = storedDisplay || fallbackGroups || '';
                const groupsText = this.escapeHtml(groupsTextRaw);
                const canToggle = Array.isArray(log.details) && log.details.length > 0;
                const toggleHtml = canToggle ? `
                    <div class="position-absolute top-0 end-0 me-2 mt-1" style="z-index: 5; pointer-events: auto;">
                        <div class="result-toggle ${d.correct ? '' : 'active'}" 
                             data-log-id="${log.id}" 
                             data-word-id="${w.id}"
                             data-item-idx="${d._idx}"
                             data-is-wrong="${(!d.correct).toString()}"
                             style="pointer-events: auto; cursor: pointer;">
                            <span class="result-toggle-icon">${d.correct ? '' : '✕'}</span>
                        </div>
                    </div>` : '';
                return `
                    <div class="col">
                        <div class="card h-100 shadow-sm position-relative">
                            <div class="card-body p-2 position-relative">
                                <!-- 蓝色复选框在前面（z-index更高） -->
                                <div class="position-absolute top-0 end-0 me-2 mt-1" style="z-index: 10;">
                                    <input type="checkbox" class="form-check-input error-select" data-id="${id}">
                                </div>
                                <!-- 红色叉叉复选框在后面，但可以点击 -->
                                ${toggleHtml}
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="d-flex align-items-start gap-2">
                                        <div>
                                            <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex gap-2 align-items-center mt-2">
                                    <div class="word-box">${latestSnapshot ? `<img class="snapshot-invert" src="${latestSnapshot}" alt="手写" style="max-width: 90%; max-height: 90%; object-fit: contain;">` : '<span class="text-muted small">无快照</span>'}</div>
                                    <div class="word-box standard-dark-box text-center">
                                        <div class="standard-dark-text" style="font-size: 3.8rem; line-height: 1; font-family: var(--kaiti-font-family, 'KaiTi','楷体',serif);">${w.word}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).filter(Boolean);
            
            if (!cards.length) {
                return;
            }
            
            const date = new Date(log.date);
            const timeStr = date.toLocaleString('zh-CN');
            const acc = log.totalWords > 0 ? Math.round((log.correctCount / log.totalWords) * 100) : 0;
            const speed = log.totalWords > 0 ? (log.totalTime / log.totalWords).toFixed(1) : '-';
            const title = `第${logs.length - idx}轮 · ${timeStr} · ${log.totalTime.toFixed(0)}s · 正确${log.correctCount}/${log.totalWords} · 准确率${acc}% · 速度${speed}s/字`;
            const collapseId = `err-round-${idx}`;
            const expanded = idx < 5;
            const checkedAttr = selectedRounds.has(log.id) ? 'checked' : '';
            
            htmlChunks.push(`
                <div class="mb-2">
                    <div class="small text-muted d-flex align-items-center gap-2">
                        <input type="checkbox" class="form-check-input error-round-select" data-log-id="${log.id}" ${checkedAttr}>
                        <a class="text-decoration-none" data-bs-toggle="collapse" href="#${collapseId}" role="button" aria-expanded="${expanded}" aria-controls="${collapseId}">
                            <i class="bi bi-caret-${expanded ? 'down' : 'right'}-fill"></i> ${title}
                        </a>
                    </div>
                    <div class="collapse ${expanded ? 'show' : ''} ms-3" id="${collapseId}">
                        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">${cards.join('')}</div>
                    </div>
                </div>
            `);
        });
        
        roundsEl.innerHTML = htmlChunks.length ? htmlChunks.join('') : '<div class="text-muted small">暂无练习记录</div>';
        this.bindRoundSelectionEvents();
        this.initResultToggleControls(roundsEl);
        this.bindSelectionCheckboxEvents(roundsEl);
    },

    // 提供给结果页复用的渲染：仅一轮
    renderCardsForLog(log, adminMode = false) {
        const container = document.getElementById('error-words-list');
        if (!container || !log) return;
        const wordBank = Storage.getWordBank();
        const errorMap = new Map((Storage.getErrorWordsFiltered() || []).map(e => [e.wordId, e]));
        const items = (log.details && log.details.length
            ? log.details
            : (log.errorWords||[]).map(id=>({wordId:id,correct:false,snapshot:(errorMap.get(id)?.handwritingSnapshots?.slice(-1)[0]?.snapshot)||''})));
        const cards = items.map((d, idx) => {
            const w = wordBank.find(x=>x.id===d.wordId);
            if (!w) return '';
            // 优先使用本次练习的快照，而不是错题本历史快照
            const latestSnapshot = d.snapshot || '';
            const fallbackGroups = typeof WordGroups !== 'undefined'
                ? WordGroups.getDisplayText(w.word, w.pinyin || '')
                : (w.pinyin || '');
            const storedDisplay = d.displayText || '';
            const groupsTextRaw = storedDisplay || fallbackGroups || '';
            const groupsText = this.escapeHtml(groupsTextRaw);
            const isWrong = !d.correct;
            return `
            <div class="col">
                <div class="card h-100 shadow-sm">
                    <div class="card-body p-2 position-relative">
                        <!-- 蓝色复选框在前面（z-index更高） -->
                        <div class="position-absolute top-0 end-0 me-2 mt-1" style="z-index: 10;">
                            <input type="checkbox" class="form-check-input error-select" data-id="${w.id}">
                        </div>
                        <!-- 红色叉叉复选框在后面，但可以点击 -->
                        <div class="position-absolute top-0 end-0 me-2 mt-1" style="z-index: 5; pointer-events: auto;">
                            <div class="result-toggle ${isWrong ? 'active' : ''}" 
                                 data-log-id="${log.id}" 
                                 data-word-id="${w.id}" 
                                 data-item-idx="${idx}" 
                                 data-is-wrong="${isWrong}"
                                 style="pointer-events: auto; cursor: pointer;">
                                <span class="result-toggle-icon">${isWrong ? '✕' : ''}</span>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-start gap-2">
                                <div>
                                    <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                </div>
                            </div>
                        </div>
                        <div class="d-flex gap-2 align-items-center mt-2">
                            <div class="word-box">${latestSnapshot ? `<img class="snapshot-invert" src="${latestSnapshot}" style="max-width: 90%; max-height: 90%; object-fit: contain;">` : '<span class="text-muted small">无快照</span>'}</div>
                            <div class="word-box standard-dark-box text-center">
                                <div class="standard-dark-text" style="font-size: 3.8rem; line-height: 1; font-family: var(--kaiti-font-family, 'KaiTi','楷体',serif);">${w.word}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
        container.innerHTML = `<div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">${cards || '<div class="text-muted small">暂无错题</div>'}</div>`;
        this.initResultToggleControls(container);
    },

    renderSummaryView(adminMode) {
        const summaryEl = document.getElementById('errorbook-summary');
        if (!summaryEl) return;
        const wordBank = Storage.getWordBank();
        const errors = Storage.getErrorWordsFiltered() || [];
        const previousSelect = document.getElementById('errorbook-summary-sort');
        const storedSort = (() => {
            try { return localStorage.getItem('errorbook_summary_sort'); } catch (e) { return null; }
        })();
        const mode = previousSelect ? previousSelect.value : (storedSort || 'recent');

        const sortedErrors = errors.slice().sort((a,b)=>{
            if (mode === 'recent') {
                return new Date(b.lastErrorDate||0) - new Date(a.lastErrorDate||0);
            } else if (mode === 'unit') {
                const wa = wordBank.find(x=>x.id===a.wordId) || {}; const wb = wordBank.find(x=>x.id===b.wordId) || {};
                return (wa.unit||0) - (wb.unit||0);
            } else { // count
                return (b.errorCount||0) - (a.errorCount||0);
            }
        });

        const rows = sortedErrors.map(ew => {
            const w = wordBank.find(x=>x.id===ew.wordId);
            if (!w) return '';
            const sortedSnapshots = (ew.handwritingSnapshots || [])
                .slice()
                .sort((a,b) => new Date(b?.date || 0) - new Date(a?.date || 0));
            const snaps = sortedSnapshots
                .filter(s => s && s.snapshot)
                .map(s => `
                    <div class="word-box me-1 mb-1">
                        <img class="snapshot-invert" src="${s.snapshot}" style="max-width: 90%; max-height: 90%; object-fit: contain;">
                    </div>
            `).join('');
            return `<tr>
                <td><input type="checkbox" class="form-check-input error-select" data-id="${ew.wordId}"></td>
                <td class="summary-word">${w.word}</td>
                <td>${w.unit!==undefined ? w.unit : '-'}</td>
                <td>${ew.lastErrorDate ? new Date(ew.lastErrorDate).toLocaleString('zh-CN') : '-'}</td>
                <td><span class="badge bg-danger">${ew.errorCount}</span></td>
                <td><div class="d-flex flex-wrap">${snaps || '<span class="text-muted small">暂无快照</span>'}</div></td>
            </tr>`;
        }).join('');

        const sortOptions = `
            <option value="recent">按最近时间</option>
            <option value="count">按错误次数</option>
            <option value="unit">按单元</option>
        `;

        summaryEl.innerHTML = `
            <div class="table-responsive">
            <div class="d-flex justify-content-end mb-2">
                <select id="errorbook-summary-sort" class="form-select form-select-sm" style="width:160px">
                    ${sortOptions}
                </select>
            </div>
            <table class="table table-sm align-middle">
                <thead>
                    <tr><th style="width:40px;"></th><th>字</th><th>单元</th><th>最近错误</th><th>错误次数</th><th>错题笔迹</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="6" class="text-muted small">暂无数据</td></tr>'}</tbody>
            </table>
            </div>
        `;

        const sel = document.getElementById('errorbook-summary-sort');
        if (sel) {
            sel.value = mode;
            sel.onchange = () => {
                try { localStorage.setItem('errorbook_summary_sort', sel.value); } catch (e) {}
                this.renderSummaryView(adminMode);
            };
        }
        this.bindSelectionCheckboxEvents(summaryEl);
    },

    /**
     * 练习特定字
     */
    practiceWord(wordId) {
        // TODO: 跳转到练习页面，只练习这个字
        if (typeof Main !== 'undefined') {
            Main.showPage('practice');
            // 可以扩展Practice模块支持单个字练习
        }
    },

    /**
     * 一键练习错题集（基于所选轮次）
     */
    practiceAll() {
        const selectedRounds = this.getSelectedRounds();
        if (!selectedRounds.length) {
            alert('请至少勾选一轮练习记录。');
            return;
        }
        const ids = this.collectWordIdsFromRounds(selectedRounds);
        if (!ids.length) {
            alert('所选轮次没有需要练习的错题。');
            return;
        }
        this.openPracticeModal(ids);
    },
    
    /**
     * 移除错题（标记为已掌握）
     */
    removeWord(wordId) {
        if (confirm('确定这个字已经掌握了吗？')) {
            Storage.removeErrorWord(wordId);
            this.load();
            
            // 更新统计
            if (typeof Statistics !== 'undefined') {
                Statistics.updateHomeStats();
            }
        }
    },
    
    /**
     * 清除已掌握的字（连续N次正确）
     */
    clearMastered() {
        // TODO: 实现连续N次正确的判断
        alert('功能开发中：需要记录连续正确次数');
    },

    toggleSelectAll(selectAll) {
        document.querySelectorAll('.error-select').forEach(cb => {
            cb.checked = !!selectAll;
        });
        this.updateBatchToolbarState();
    },

    batchRemove() {
        const ids = Array.from(document.querySelectorAll('.error-select:checked')).map(cb => cb.getAttribute('data-id'));
        if (!ids.length) return;
        ids.forEach(id => Storage.removeErrorWord(id));
        this.load();
        this.updateBatchToolbarState();
    },

    batchDelete() {
        const ids = Array.from(document.querySelectorAll('.error-select:checked')).map(cb => cb.getAttribute('data-id'));
        if (!ids.length) return;
        if (!confirm(`确定要删除选中的 ${ids.length} 个错题吗？`)) return;
        ids.forEach(id => Storage.removeErrorWord(id));
        this.load();
        this.updateBatchToolbarState();
    },

    bindRoundSelectionEvents() {
        document.querySelectorAll('.error-round-select').forEach(cb => {
            cb.addEventListener('change', () => {
                this.toggleRoundSelection(cb.dataset.logId, cb.checked);
            });
        });
    },

    toggleRoundSelection(logId, checked) {
        if (!logId) return;
        const selected = new Set(this.getSelectedRounds());
        if (checked) {
            selected.add(logId);
        } else {
            selected.delete(logId);
        }
        this.saveSelectedRounds(Array.from(selected));
    },

    getSelectedRounds() {
        try {
            const saved = localStorage.getItem('errorbook_selected_rounds');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    },

    saveSelectedRounds(list) {
        try {
            localStorage.setItem('errorbook_selected_rounds', JSON.stringify(list || []));
        } catch (e) {}
    },

    ensureDefaultRoundSelection(logs = []) {
        const saved = this.getSelectedRounds();
        if (saved.length) return saved;
        const allIds = logs.map(log => log.id).filter(Boolean);
        if (allIds.length) {
            this.saveSelectedRounds(allIds);
            return allIds;
        }
        return [];
    },

    collectWordIdsFromRounds(roundIds) {
        if (!roundIds || !roundIds.length) return [];
        const logs = ((Storage.getPracticeLogsFiltered ? Storage.getPracticeLogsFiltered() : Storage.getPracticeLogs()) || [])
            .filter(log => log && log.status === 'completed');
        const selectedLogs = logs.filter(log => roundIds.includes(log.id));
        const uniqueWordIds = new Set();
        selectedLogs.forEach(log => {
            if (Array.isArray(log.details) && log.details.length) {
                log.details.forEach(item => {
                    if (item && item.wordId && item.correct === false) {
                        uniqueWordIds.add(item.wordId);
                    }
                });
            } else if (Array.isArray(log.errorWords)) {
                log.errorWords.forEach(id => uniqueWordIds.add(id));
            }
        });
        return Array.from(uniqueWordIds);
    },

    openPracticeModal(wordIds, options = {}) {
        const modalEl = document.getElementById('errorbook-practice-modal');
        if (!modalEl) {
            alert('无法打开练习设置弹窗，请刷新页面后重试。');
            return;
        }
        this.pendingPracticeWordIds = wordIds;
        const countSpan = modalEl.querySelector('[data-practice-count]');
        if (countSpan) countSpan.textContent = wordIds.length;

        const defaultTime = options.timeLimit || this.getDefaultTimeLimit();
        const timeInput = document.getElementById('errorbook-practice-time');
        if (timeInput) timeInput.value = defaultTime;

        const defaultMode = options.mode || this.getDefaultMode();
        const modeSelect = document.getElementById('errorbook-practice-mode');
        if (modeSelect) modeSelect.value = defaultMode;

        this.practiceModalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        this.practiceModalInstance.show();
    },

    confirmPracticeModal() {
        const wordIds = this.pendingPracticeWordIds || [];
        if (!wordIds.length) {
            alert('没有待练习的错题，请重新选择。');
            return;
        }
        const timeInput = document.getElementById('errorbook-practice-time');
        let timeLimit = parseInt(timeInput?.value, 10);
        if (isNaN(timeLimit) || timeLimit < 5) timeLimit = 30;
        if (timeLimit > 180) timeLimit = 180;

        const modeSelect = document.getElementById('errorbook-practice-mode');
        const mode = modeSelect?.value || 'normal';

        try {
            localStorage.setItem('practice_error_word_ids', JSON.stringify(wordIds));
        } catch (e) {}
        localStorage.setItem('practice_error_only', '1');
        try {
            localStorage.setItem('practice_force_word_count', String(wordIds.length));
            localStorage.setItem('practice_force_time_limit', String(timeLimit));
            localStorage.setItem('practice_force_mode', mode);
        } catch (e) {}

        const timeLimitInput = document.getElementById('time-limit-input');
        if (timeLimitInput) timeLimitInput.value = timeLimit;
        const modeHomeSelect = document.getElementById('practice-mode-select-home');
        if (modeHomeSelect) modeHomeSelect.value = mode;

        if (typeof Practice !== 'undefined' && Practice.prepareForcedWords) {
            Practice.prepareForcedWords(wordIds.length);
        }

        if (this.practiceModalInstance) {
            this.practiceModalInstance.hide();
        }
        this.pendingPracticeWordIds = [];

        setTimeout(() => {
            if (typeof Main !== 'undefined' && Main.showPage) {
                Main.showPage('practice');
            }
            setTimeout(() => {
                const timeLimitInputAgain = document.getElementById('time-limit-input');
                if (timeLimitInputAgain) timeLimitInputAgain.value = timeLimit;
                const modeSelectAgain = document.getElementById('practice-mode-select-home');
                if (modeSelectAgain) modeSelectAgain.value = mode;
                if (typeof Practice !== 'undefined' && Practice.start) {
                    Practice.start();
                }
            }, 300);
        }, 100);
    },

    getDefaultTimeLimit() {
        const settings = Storage.getSettings ? Storage.getSettings() : null;
        return settings?.practice?.timeLimit || 30;
    },

    getDefaultMode() {
        const settings = Storage.getSettings ? Storage.getSettings() : null;
        return settings?.practice?.mode || 'normal';
    }
};

// 绑定清除按钮
document.addEventListener('DOMContentLoaded', () => {
    const clearBtn = document.getElementById('clear-mastered-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => ErrorBook.clearMastered());
    }
    const practiceAllBtn = document.getElementById('errorbook-practice-all-btn');
    if (practiceAllBtn) {
        practiceAllBtn.addEventListener('click', () => ErrorBook.practiceAll());
    }
    const practiceConfirmBtn = document.getElementById('errorbook-practice-confirm-btn');
    if (practiceConfirmBtn) {
        practiceConfirmBtn.addEventListener('click', () => ErrorBook.confirmPracticeModal());
    }
});
