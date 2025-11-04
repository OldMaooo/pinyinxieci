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

        if (!errorWords || errorWords.length === 0) {
            if (roundsEl) roundsEl.innerHTML = '';
            if (summaryEl) summaryEl.innerHTML = '';
            if (batchBar) batchBar.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        if (batchBar) batchBar.style.display = adminMode ? 'flex' : 'none';

        this.renderRoundsView(adminMode);
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
    },

    renderRoundsView(adminMode) {
        const roundsEl = document.getElementById('errorbook-rounds');
        if (!roundsEl) return;
        const logs = (Storage.getPracticeLogs() || []).slice().reverse();
        const wordBank = Storage.getWordBank();
        const errorMap = new Map((Storage.getErrorWords() || []).map(e => [e.wordId, e]));
        const html = logs.map((log, idx) => {
            const date = new Date(log.date);
            const timeStr = date.toLocaleString('zh-CN');
            const acc = log.totalWords > 0 ? Math.round((log.correctCount / log.totalWords) * 100) : 0;
            const speed = log.totalWords > 0 ? (log.totalTime / log.totalWords).toFixed(1) : '-';
            const title = `第${logs.length - idx}轮 · ${timeStr} · ${log.totalTime.toFixed(0)}s · 正确${log.correctCount}/${log.totalWords} · 准确率${acc}% · 速度${speed}s/字`;
            const cards = (log.errorWords || []).map(id => {
                const w = wordBank.find(x => x.id === id);
                if (!w) return '';
                const ew = errorMap.get(id);
                const latestSnapshot = ew?.handwritingSnapshots?.[ew.handwritingSnapshots.length - 1]?.snapshot || '';
                const groupsText = typeof WordGroups !== 'undefined' ? WordGroups.getDisplayText(w.word, w.pinyin || '') : (w.pinyin || '');
                return `
                    <div class="col">
                        <div class="card h-100 shadow-sm">
                            <div class="card-body p-2">
                                <div class="d-flex justify-content-between align-items-start">
                                    <div class="d-flex align-items-start gap-2">
                                        ${adminMode ? `<input type=\"checkbox\" class=\"form-check-input mt-2 error-select\" data-id=\"${id}\">` : ''}
                                        <div>
                                            <div class="fw-bold" style="font-size: 1.5rem; line-height: 1;">${w.word}</div>
                                            <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="d-flex gap-2 align-items-center mt-2">
                                    <div class="word-box">${latestSnapshot ? `<img class=\"snapshot-invert\" src=\"${latestSnapshot}\" alt=\"手写\" style=\"max-width: 90%; max-height: 90%; object-fit: contain;\">` : '<span class=\"text-muted small\">无快照</span>'}</div>
                                    <div class="word-box standard-dark-box text-center">
                                        <div class="standard-dark-text" style="font-size: 2.2rem; font-family: 'KaiTi','楷体',serif;">${w.word}</div>
                                    </div>
                                </div>
                            </div>
                            ${adminMode ? `
                            <div class=\"card-footer bg-transparent border-0 pt-0 d-flex justify-content-between gap-2\">
                                <button class=\"btn btn-sm btn-primary flex-fill\" onclick=\"ErrorBook.practiceWord('${id}')\">练习</button>
                                <button class=\"btn btn-sm btn-outline-danger flex-fill\" onclick=\"ErrorBook.removeWord('${id}')\">已掌握</button>
                            </div>` : ''}
                        </div>
                    </div>
                `;
            }).join('');
            return `
                <div class="mb-3">
                    <div class="small text-muted mb-2">${title}</div>
                    <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">${cards || '<div class=\"text-muted small\">本轮无错题</div>'}</div>
                </div>
            `;
        }).join('');
        roundsEl.innerHTML = html || '<div class="text-muted small">暂无练习记录</div>';
    },

    renderSummaryView(adminMode) {
        const summaryEl = document.getElementById('errorbook-summary');
        if (!summaryEl) return;
        const wordBank = Storage.getWordBank();
        const logs = Storage.getPracticeLogs() || [];
        const counter = new Map();
        logs.forEach(log => (log.errorWords || []).forEach(id => counter.set(id, (counter.get(id) || 0) + 1)));
        const rows = Array.from(counter.entries()).sort((a,b)=>b[1]-a[1]).map(([id,count]) => {
            const w = wordBank.find(x=>x.id===id);
            if (!w) return '';
            return `<tr>
                <td>${adminMode ? `<input type="checkbox" class="form-check-input error-select" data-id="${id}">` : ''}</td>
                <td class="fw-bold">${w.word}</td>
                <td class="text-muted">${w.pinyin||''}</td>
                <td><span class="badge bg-danger">${count}</span></td>
            </tr>`;
        }).join('');
        summaryEl.innerHTML = `
            <div class="table-responsive">
            <table class="table table-sm align-middle">
                <thead>
                    <tr><th style="width:40px;"></th><th>字</th><th>拼音</th><th>错误次数</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="4" class="text-muted small">暂无数据</td></tr>'}</tbody>
            </table>
            </div>
        `;
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
