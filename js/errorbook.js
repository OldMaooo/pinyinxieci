/**
 * 错题本模块
 */

const ErrorBook = {
    /**
     * 加载错题本
     */
    load() {
        const errorWords = Storage.getErrorWords();
        const list = document.getElementById('errorbook-list');
        const empty = document.getElementById('errorbook-empty');
        const adminMode = localStorage.getItem('adminMode') === '1';
        
        if (!errorWords || errorWords.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
            return;
        }
        
        empty.style.display = 'none';
        
        const wordBank = Storage.getWordBank();
        
        // 网格卡片布局，提升密度
        const cardsHtml = errorWords.map(errorWord => {
            const word = wordBank.find(w => w.id === errorWord.wordId);
            if (!word) return '';
            const latestSnapshot = errorWord.handwritingSnapshots[errorWord.handwritingSnapshots.length - 1];
            const groupsText = typeof WordGroups !== 'undefined' ? 
                WordGroups.getDisplayText(word.word, word.pinyin || '') : (word.pinyin || '');
            
            return `
                <div class="col">
                    <div class="card h-100 shadow-sm">
                        <div class="card-body p-2">
                            <div class="d-flex justify-content-between align-items-start">
                                <div class="d-flex align-items-start gap-2">
                                    ${adminMode ? `<input type=\"checkbox\" class=\"form-check-input mt-2 error-select\" data-id=\"${errorWord.wordId}\">` : ''}
                                    <div>
                                        <div class="fw-bold" style="font-size: 1.75rem; line-height: 1;">${word.word}</div>
                                        <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                    </div>
                                </div>
                                <span class="badge bg-danger">${errorWord.errorCount}</span>
                            </div>
                            ${latestSnapshot ? `
                                <div class="d-flex gap-2 align-items-center mt-2">
                                    <img src="${latestSnapshot.snapshot}" alt="手写" style="width: 90px; height: 90px; object-fit: contain; border: 1px solid #eee; border-radius: 4px;">
                                    <div class="border rounded p-1 text-center" style="min-width:90px; background:#fff;">
                                        <div style="font-size: 2.8rem; font-family: 'KaiTi','楷体',serif;">${word.word}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        ${adminMode ? `
                        <div class=\"card-footer bg-white border-0 pt-0 d-flex justify-content-between gap-2\">
                            <button class=\"btn btn-sm btn-primary flex-fill\" onclick=\"ErrorBook.practiceWord('${errorWord.wordId}')\">练习</button>
                            <button class=\"btn btn-sm btn-outline-danger flex-fill\" onclick=\"ErrorBook.removeWord('${errorWord.wordId}')\">已掌握</button>
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        list.innerHTML = `
            <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">
                ${cardsHtml}
            </div>
        `;
        
        // 管理模式下显示批量删除按钮
        const delBtn = document.getElementById('errorbook-delete-selected-btn');
        if (delBtn) {
            delBtn.classList.toggle('d-none', !adminMode);
            delBtn.onclick = () => this.deleteSelected();
        }
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
