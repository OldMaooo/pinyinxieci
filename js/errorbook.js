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
                                <div>
                                    <div class="fw-bold" style="font-size: 1.75rem; line-height: 1;">${word.word}</div>
                                    <div class="text-muted small mt-1" title="${groupsText}">${groupsText}</div>
                                </div>
                                <span class="badge bg-danger">${errorWord.errorCount}</span>
                            </div>
                            ${latestSnapshot ? `
                                <div class="d-flex gap-2 align-items-center mt-2">
                                    <img src="${latestSnapshot.snapshot}" alt="手写" style="width: 64px; height: 64px; object-fit: contain; border: 1px solid #eee; border-radius: 4px;">
                                    <div class="border rounded p-1 text-center" style="min-width:64px; background:#fff;">
                                        <div style="font-size: 2rem; font-family: 'KaiTi','楷体',serif;">${word.word}</div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <div class="card-footer bg-white border-0 pt-0 d-grid gap-1">
                            <button class="btn btn-sm btn-primary" onclick="ErrorBook.practiceWord('${errorWord.wordId}')">练习</button>
                            <button class="btn btn-sm btn-outline-danger" onclick="ErrorBook.removeWord('${errorWord.wordId}')">已掌握</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        list.innerHTML = `
            <div class="row row-cols-2 row-cols-md-3 row-cols-lg-5 g-3">
                ${cardsHtml}
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
});
