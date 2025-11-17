/**
 * 错题本模块
 */

const ErrorBook = {
    /**
     * 加载错题本
     */
    load() {
        const errorWords = Storage.getErrorWords();
        const empty = document.getElementById('errorbook-empty');
        const adminMode = localStorage.getItem('adminMode') === '1';
        const roundsEl = document.getElementById('errorbook-rounds');
        const summaryEl = document.getElementById('errorbook-summary');
        const batchBar = document.getElementById('errorbook-batch-toolbar');
        const onlyWrongToggle = document.getElementById('errorbook-only-wrong');
        const onlyWrong = !!(onlyWrongToggle && onlyWrongToggle.checked);

        if (!errorWords || errorWords.length === 0) {
            if (roundsEl) roundsEl.innerHTML = '';
            if (summaryEl) summaryEl.innerHTML = '';
            if (batchBar) batchBar.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        if (batchBar) batchBar.style.display = adminMode ? 'flex' : 'none';

        this.renderRoundsView(adminMode, { onlyWrong });
        this.renderSummaryView(adminMode);

        const tabRounds = document.getElementById('tab-rounds');
        const tabSummary = document.getElementById('tab-summary');
        if (tabRounds && tabSummary) {
            tabRounds.onclick = () => {
                tabRounds.classList.add('active');
                tabSummary.classList.remove('active');
                roundsEl.classList.remove('d-none');
                summaryEl.classList.add('d-none');
            };
            tabSummary.onclick = () => {
                tabSummary.classList.add('active');
                tabRounds.classList.remove('active');
                summaryEl.classList.remove('d-none');
                roundsEl.classList.add('d-none');
            };
        }

        const selAll = document.getElementById('errorbook-select-all');
        const clrSel = document.getElementById('errorbook-clear-select');
        const batchRemove = document.getElementById('errorbook-batch-remove');
        const batchAdd = document.getElementById('errorbook-batch-add');
        if (selAll) selAll.onclick = () => this.toggleSelectAll(true);
        if (clrSel) clrSel.onclick = () => this.toggleSelectAll(false);
        if (batchRemove) batchRemove.onclick = () => this.batchRemove();
        if (batchAdd) batchAdd.onclick = () => this.batchAdd();

        if (onlyWrongToggle) {
            onlyWrongToggle.onchange = () => this.load();
        }

        const practiceSelectedBtn = document.getElementById('errorbook-practice-selected-btn');
        if (practiceSelectedBtn) {
            practiceSelectedBtn.onclick = () => this.practiceSelectedRounds();
        }
    },

    renderRoundsView(adminMode, opts = {}) {
        const onlyWrong = !!opts.onlyWrong;
        const roundsEl = document.getElementById('errorbook-rounds');
        if (!roundsEl) return;
        const logs = ((Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs() || []).slice().reverse();
        const wordBank = Storage.getWordBank();
        const errorMap = new Map((Storage.getErrorWords() || []).map(e => [e.wordId, e]));
        const roundSelection = this.ensureDefaultRoundSelection(logs);
        const selectedRounds = new Set(roundSelection);
        const html = logs.map((log, idx) => {
            const date = new Date(log.date);
            const timeStr = date.toLocaleString('zh-CN');
            const acc = log.totalWords > 0 ? Math.round((log.correctCount / log.totalWords) * 100) : 0;
            const speed = log.totalWords > 0 ? (log.totalTime / log.totalWords).toFixed(1) : '-';
            const title = `第${logs.length - idx}轮 · ${timeStr} · ${log.totalTime.toFixed(0)}s · 正确${log.correctCount}/${log.totalWords} · 准确率${acc}% · 速度${speed}s/字`;
            const collapseId = `err-round-${idx}`;
            const expanded = idx < 5; // 默认展开最近5轮
            const items = (log.details && log.details.length ? log.details : (log.errorWords||[]).map(id=>({wordId:id,correct:false,snapshot:(errorMap.get(id)?.handwritingSnapshots?.slice(-1)[0]?.snapshot)||''})));
            const filtered = onlyWrong ? items.filter(d => d.correct === false) : items;
            const cards = filtered.map(d => {
                const id = d.wordId;
                const w = wordBank.find(x => x.id === id);
                if (!w) return '';
                const ew = errorMap.get(id);
                const latestSnapshot = d.snapshot || ew?.handwritingSnapshots?.[ew.handwritingSnapshots.length - 1]?.snapshot || '';
                const groupsText = typeof WordGroups !== 'undefined' ? WordGroups.getDisplayText(w.word, w.pinyin || '') : (w.pinyin || '');
                return `
                    <div class="col">
                        <div class="card h-100 shadow-sm">
                            <div class="card-body p-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="d-flex align-items-start gap-2">
                                        ${adminMode ? `<input type="checkbox" class="form-check-input mt-2 error-select" data-id="${id}">` : ''}
                                        <div>
                                            <div class="fw-bold" style="font-size: 1.5rem; line-height: 1;">${w.word} ${d.correct ? '' : '<span title="错误">❌</span>'}</div>
                                            <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex gap-2 align-items-center mt-2">
                                    <div class="word-box">${latestSnapshot ? `<img class="snapshot-invert" src="${latestSnapshot}" alt="手写" style="max-width: 90%; max-height: 90%; object-fit: contain;">` : '<span class="text-muted small">无快照</span>'}</div>
                                    <div class="word-box standard-dark-box text-center">
                                        <div class="standard-dark-text" style="font-size: 2.2rem;">${w.word}</div>
                                    </div>
                                </div>
                            </div>
                            ${adminMode ? `
                            <div class="card-footer bg-transparent border-0 pt-0 d-flex justify-content-between gap-2">
                                <button class="btn btn-sm btn-primary flex-fill" onclick="ErrorBook.practiceWord('${id}')">练习</button>
                                <button class="btn btn-sm btn-outline-danger flex-fill" onclick="ErrorBook.removeWord('${id}')">已掌握</button>
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            const checkedAttr = selectedRounds.has(log.id) ? 'checked' : '';
            return `
                <div class="mb-2">
                    <div class="small text-muted d-flex align-items-center gap-2">
                        <input type="checkbox" class="form-check-input error-round-select" data-log-id="${log.id}" ${checkedAttr}>
                        <a class="text-decoration-none" data-bs-toggle="collapse" href="#${collapseId}" role="button" aria-expanded="${expanded}" aria-controls="${collapseId}">
                            <i class="bi bi-caret-${expanded ? 'down' : 'right'}-fill"></i> ${title}
                        </a>
                    </div>
                    <div class="collapse ${expanded ? 'show' : ''} ms-3" id="${collapseId}">
                        <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">${cards || '<div class="text-muted small">本轮无错题</div>'}</div>
                    </div>
                </div>
            `;
        }).join('');
        roundsEl.innerHTML = html || '<div class="text-muted small">暂无练习记录</div>';
        this.bindRoundSelectionEvents();
    },

    // 提供给结果页复用的渲染：仅一轮
    renderCardsForLog(log, adminMode = false) {
        const container = document.getElementById('error-words-list');
        if (!container || !log) return;
        const wordBank = Storage.getWordBank();
        const errorMap = new Map((Storage.getErrorWords() || []).map(e => [e.wordId, e]));
        const items = (log.details && log.details.length ? log.details : (log.errorWords||[]).map(id=>({wordId:id,correct:false,snapshot:(errorMap.get(id)?.handwritingSnapshots?.slice(-1)[0]?.snapshot)||''})));
        const cards = items.map((d, idx) => {
            const w = wordBank.find(x=>x.id===d.wordId);
            if (!w) return '';
            // 优先使用本次练习的快照，而不是错题本历史快照
            const latestSnapshot = d.snapshot || '';
            const groupsText = typeof WordGroups !== 'undefined' ? WordGroups.getDisplayText(w.word, w.pinyin || '') : (w.pinyin || '');
            const isWrong = !d.correct;
            return `
            <div class="col">
                <div class="card h-100 shadow-sm">
                    <div class="card-body p-2 position-relative">
                        <div class="position-absolute top-0 end-0 me-2 mt-1">
                            <div class="result-toggle ${isWrong ? 'active' : ''}" 
                                 data-log-id="${log.id}" 
                                 data-word-id="${w.id}" 
                                 data-item-idx="${idx}" 
                                 data-is-wrong="${isWrong}">
                                <span class="result-toggle-icon">${isWrong ? '✕' : ''}</span>
                            </div>
                        </div>
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="d-flex align-items-start gap-2">
                                <div>
                                    <div class="fw-bold" style="font-size: 1.5rem; line-height: 1;">${w.word}</div>
                                    <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                </div>
                            </div>
                        </div>
                        <div class="d-flex gap-2 align-items-center mt-2">
                            <div class="word-box">${latestSnapshot ? `<img class=\"snapshot-invert\" src=\"${latestSnapshot}\" style=\"max-width: 90%; max-height: 90%; object-fit: contain;\">` : '<span class=\"text-muted small\">无快照</span>'}</div>
                            <div class="word-box standard-dark-box text-center">
                                <div class="standard-dark-text" style="font-size: 2.2rem;">${w.word}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');
        container.innerHTML = `<div class=\"row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3\">${cards || '<div class=\"text-muted small\">暂无错题</div>'}</div>`;
        
        const updateToggleVisual = (btn, isWrong) => {
            btn.classList.toggle('active', isWrong);
            const icon = btn.querySelector('.result-toggle-icon');
            if (icon) {
                icon.textContent = isWrong ? '✕' : '';
            }
            btn.setAttribute('data-is-wrong', isWrong ? 'true' : 'false');
        };
        
        container.querySelectorAll('.result-toggle').forEach(btn => {
            let isWrong = btn.getAttribute('data-is-wrong') === 'true';
            updateToggleVisual(btn, isWrong);
            btn.addEventListener('click', () => {
                isWrong = !isWrong;
                updateToggleVisual(btn, isWrong);
                if (typeof Statistics !== 'undefined' && Statistics.updateResultItemStatus) {
                    const logId = btn.getAttribute('data-log-id');
                    const itemIdx = parseInt(btn.getAttribute('data-item-idx'));
                    Statistics.updateResultItemStatus(logId, itemIdx, !isWrong);
                }
            });
        });
    },

    renderSummaryView(adminMode) {
        const summaryEl = document.getElementById('errorbook-summary');
        if (!summaryEl) return;
        const wordBank = Storage.getWordBank();
        const errors = Storage.getErrorWords() || [];
        // 排序模式（可选下拉 #errorbook-summary-sort）
        const sortSelect = document.getElementById('errorbook-summary-sort');
        const mode = sortSelect ? sortSelect.value : 'count';
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
            const snaps = (ew.handwritingSnapshots || []).slice().reverse().map(s => `
                <div class="word-box me-1 mb-1"><img class="snapshot-invert" src="${s.snapshot}" style="max-width: 90%; max-height: 90%; object-fit: contain;"></div>
            `).join('');
            return `<tr>
                <td>${adminMode ? `<input type="checkbox" class="form-check-input error-select" data-id="${ew.wordId}">` : ''}</td>
                <td class="fw-bold">${w.word}</td>
                <td class="text-muted">${w.pinyin||''}</td>
                <td>${w.unit!==undefined ? w.unit : '-'}</td>
                <td>${ew.lastErrorDate ? new Date(ew.lastErrorDate).toLocaleString('zh-CN') : '-'}</td>
                <td><span class="badge bg-danger">${ew.errorCount}</span></td>
                <td><div class="d-flex flex-wrap">${snaps || '<span class="text-muted small">暂无快照</span>'}</div></td>
            </tr>`;
        }).join('');
        summaryEl.innerHTML = `
            <div class="table-responsive">
            <div class="d-flex justify-content-end mb-2">${sortSelect ? '' : '<select id="errorbook-summary-sort" class="form-select form-select-sm" style="width:160px"><option value="count">按错误次数</option><option value="recent">按最近时间</option><option value="unit">按单元</option></select>'}</div>
            <table class="table table-sm align-middle">
                <thead>
                    <tr><th style="width:40px;"></th><th>字</th><th>拼音</th><th>单元</th><th>最近错误</th><th>错误次数</th><th>错题笔迹</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="5" class="text-muted small">暂无数据</td></tr>'}</tbody>
            </table>
            </div>
        `;

        // 绑定排序变更
        const sel = document.getElementById('errorbook-summary-sort');
        if (sel) sel.onchange = () => this.renderSummaryView(adminMode);
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
     * 一键练习错题集
     */
    practiceAll() {
        localStorage.setItem('practice_error_only', '1');
        if (typeof Main !== 'undefined') {
            Main.showPage('practice');
        }
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

    toggleSelectAll(select) {
        document.querySelectorAll('#errorbook-rounds .error-select, #errorbook-summary .error-select').forEach(cb => {
            cb.checked = !!select;
        });
        document.querySelectorAll('.error-round-select').forEach(cb => {
            cb.checked = !!select;
            this.toggleRoundSelection(cb.dataset.logId, cb.checked);
        });
        this.updateRoundSelectionIndicator();
    },

    batchRemove() {
        const ids = Array.from(document.querySelectorAll('.error-select:checked')).map(cb => cb.getAttribute('data-id'));
        if (!ids.length) return;
        ids.forEach(id => Storage.removeErrorWord(id));
        this.load();
    },

    batchAdd() {
        const ids = Array.from(document.querySelectorAll('.error-select:checked')).map(cb => cb.getAttribute('data-id'));
        if (!ids.length) return;
        const wordBank = Storage.getWordBank();
        ids.forEach(id => {
            const w = wordBank.find(x=>x.id===id);
            if (w) Storage.addErrorWord(id, w.word, w.pinyin||'', null);
        });
        this.load();
    },

    bindRoundSelectionEvents() {
        document.querySelectorAll('.error-round-select').forEach(cb => {
            cb.addEventListener('change', () => {
                this.toggleRoundSelection(cb.dataset.logId, cb.checked);
            });
        });
        this.updateRoundSelectionIndicator();
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
        this.updateRoundSelectionIndicator();
    },

    updateRoundSelectionIndicator() {
        const btn = document.getElementById('errorbook-practice-selected-btn');
        if (!btn) return;
        const count = this.getSelectedRounds().length;
        const countSpan = btn.querySelector('[data-count]');
        if (countSpan) {
            countSpan.textContent = count;
        }
        btn.disabled = count === 0;
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

    practiceSelectedRounds() {
        const selected = this.getSelectedRounds();
        if (!selected.length) {
            alert('请先勾选要练习的轮次。');
            return;
        }
        const logs = (Storage.getPracticeLogsFiltered ? Storage.getPracticeLogsFiltered() : Storage.getPracticeLogs()) || [];
        const selectedLogs = logs.filter(log => selected.includes(log.id));
        if (!selectedLogs.length) {
            alert('未找到勾选的练习记录。');
            return;
        }
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
        if (!uniqueWordIds.size) {
            alert('所选轮次没有需要练习的错题。');
            return;
        }
        const ids = Array.from(uniqueWordIds);
        if (typeof PracticeRange !== 'undefined' && PracticeRange.setErrorWordsFromLog) {
            PracticeRange.setErrorWordsFromLog(ids);
        } else {
            try {
                localStorage.setItem('practice_error_word_ids', JSON.stringify(ids));
            } catch (e) {}
        }
        localStorage.setItem('practice_error_only', '1');
        try {
            localStorage.setItem('practice_force_word_count', String(ids.length));
        } catch (e) {}
        if (typeof Practice !== 'undefined' && Practice.prepareForcedWords) {
            Practice.prepareForcedWords(ids.length);
        }
        if (typeof Main !== 'undefined' && Main.showPage) {
            Main.showPage('practice');
        }
        console.log('[ErrorBook] 已准备好所选错题，请在练习页点击“开始练习”');
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
});
