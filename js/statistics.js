/**
 * 统计模块
 */

const Statistics = {
    /**
     * 更新首页统计
     */
    updateHomeStats() {
        const wordBank = Storage.getWordBank();
        const logs = Storage.getPracticeLogs();
        const errorWords = Storage.getErrorWords();
        
        // 总词数
        document.getElementById('stat-total-words').textContent = wordBank.length;
        
        // 已练习（统计练习记录中的唯一词数）
        const practicedWordIds = new Set();
        logs.forEach(log => {
            log.errorWords?.forEach(id => practicedWordIds.add(id));
        });
        document.getElementById('stat-practiced').textContent = practicedWordIds.size;
        
        // 正确率
        let totalCorrect = 0;
        let totalQuestions = 0;
        logs.forEach(log => {
            totalCorrect += log.correctCount || 0;
            totalQuestions += log.totalWords || 0;
        });
        const accuracy = totalQuestions > 0 ? 
            Math.round((totalCorrect / totalQuestions) * 100) : 0;
        document.getElementById('stat-accuracy').textContent = `${accuracy}%`;
        
        // 错题数
        document.getElementById('stat-error-words').textContent = errorWords.length;
    },
    
    /**
     * 显示练习结果
     */
    showResults(logId) {
        const logs = Storage.getPracticeLogs();
        const log = logs.find(l => l.id === logId);
        
        if (!log) {
            console.error('练习记录不存在');
            return;
        }
        
        // 显示统计数据
        document.getElementById('result-total').textContent = log.totalWords || 0;
        document.getElementById('result-correct').textContent = log.correctCount || 0;
        document.getElementById('result-error').textContent = log.errorCount || 0;
        
        const accuracy = log.totalWords > 0 ? 
            Math.round((log.correctCount / log.totalWords) * 100) : 0;
        document.getElementById('result-accuracy').textContent = `${accuracy}%`;
        
        document.getElementById('result-total-time').textContent = 
            `${Math.round(log.totalTime || 0)}秒`;
        document.getElementById('result-avg-time').textContent = 
            `${Math.round(log.averageTime || 0)}秒`;
        
        // 显示错题列表
        this.showErrorWordsList(log.errorWords || []);
        
        // 显示结果页面
        if (typeof Main !== 'undefined') {
            Main.showPage('results');
        }
    },
    
    /**
     * 显示错题列表
     */
    showErrorWordsList(errorWordIds) {
        const errorList = document.getElementById('error-words-list');
        
        if (errorWordIds.length === 0) {
            errorList.innerHTML = '<div class="alert alert-success">太棒了！全部正确！</div>';
            return;
        }
        
        const wordBank = Storage.getWordBank();
        const errorWords = Storage.getErrorWords();
        
        let html = '<h5 class="mb-3">错题列表：</h5>';
        
        errorWordIds.forEach(wordId => {
            const word = wordBank.find(w => w.id === wordId);
            const errorWord = errorWords.find(ew => ew.wordId === wordId);
            
            if (word && errorWord) {
                const latestSnapshot = errorWord.handwritingSnapshots[errorWord.handwritingSnapshots.length - 1];
                
                html += `
                    <div class="error-word-item">
                        <div class="error-word-header">
                            <div class="error-word-info">
                                <strong>${word.word}</strong> 
                                ${typeof WordGroups !== 'undefined' ? 
                                    `(${WordGroups.getDisplayText(word.word, word.pinyin || '')})` : 
                                    `(${word.pinyin || ''})`}
                            </div>
                            <span class="badge bg-danger">错误 ${errorWord.errorCount} 次</span>
                        </div>
                        ${latestSnapshot ? `
                            <div class="error-comparison">
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
                    </div>
                `;
            }
        });
        
        errorList.innerHTML = html;
    }
};
