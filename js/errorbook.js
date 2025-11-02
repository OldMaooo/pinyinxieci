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
        
        list.innerHTML = errorWords.map(errorWord => {
            const word = wordBank.find(w => w.id === errorWord.wordId);
            if (!word) return '';
            
            const latestSnapshot = errorWord.handwritingSnapshots[errorWord.handwritingSnapshots.length - 1];
            
            return `
                <div class="error-word-item">
                    <div class="error-word-header">
                        <div class="error-word-info">
                            <strong style="font-size: 2rem;">${word.word}</strong>
                            <span class="text-muted ms-2">
                                ${typeof WordGroups !== 'undefined' ? 
                                    WordGroups.getDisplayText(word.word, word.pinyin || '') : 
                                    word.pinyin || ''}
                            </span>
                            <br>
                            <small class="text-muted">
                                ${word.grade || ''}年级 ${word.semester || ''}学期 第${word.unit || ''}单元
                            </small>
                        </div>
                        <div>
                            <span class="badge bg-danger">错误 ${errorWord.errorCount} 次</span>
                            <br>
                            <small class="text-muted">
                                最近错误: ${new Date(errorWord.lastErrorDate).toLocaleDateString()}
                            </small>
                        </div>
                    </div>
                    ${latestSnapshot ? `
                        <div class="error-comparison mt-3">
                            <div class="error-comparison-item">
                                <div class="label">你的书写</div>
                                <img src="${latestSnapshot.snapshot}" alt="手写" style="max-width: 150px; border: 2px solid #dc3545; border-radius: 4px;">
                            </div>
                            <div class="error-comparison-item">
                                <div class="label">正确答案</div>
                                <div style="font-size: 100px; font-family: 'KaiTi', '楷体', serif; border: 2px solid #198754; border-radius: 4px; padding: 10px; background: white;">
                                    ${word.word}
                                </div>
                            </div>
                        </div>
                    ` : ''}
                    <div class="mt-3">
                        <button class="btn btn-sm btn-primary" onclick="ErrorBook.practiceWord('${errorWord.wordId}')">
                            练习这个字
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="ErrorBook.removeWord('${errorWord.wordId}')">
                            标记为已掌握
                        </button>
                    </div>
                </div>
            `;
        }).join('');
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
