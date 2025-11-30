/**
 * 统计模块
 */

const Statistics = {
    currentLogId: null,
    hasChanges: false,
    
    /**
     * 更新首页统计
     */
    updateHomeStats() {
        const wordBank = Storage.getWordBank();
        const logs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs();
        const errorWords = Storage.getErrorWordsFiltered();
        
        // 总词数（如果元素存在才更新）
        const statTotalWords = document.getElementById('stat-total-words');
        if (statTotalWords) {
            statTotalWords.textContent = wordBank.length;
        }
        
        // 已练习（统计练习记录中的唯一词数）
        const practicedWordIds = new Set();
        logs.forEach(log => {
            log.errorWords?.forEach(id => practicedWordIds.add(id));
        });
        const statPracticed = document.getElementById('stat-practiced');
        if (statPracticed) {
            statPracticed.textContent = practicedWordIds.size;
        }
        
        // 正确率
        let totalCorrect = 0;
        let totalQuestions = 0;
        logs.forEach(log => {
            totalCorrect += log.correctCount || 0;
            totalQuestions += log.totalWords || 0;
        });
        const accuracy = totalQuestions > 0 ? 
            Math.round((totalCorrect / totalQuestions) * 100) : 0;
        const statAccuracy = document.getElementById('stat-accuracy');
        if (statAccuracy) {
            statAccuracy.textContent = `${accuracy}%`;
        }
        
        // 错题数
        const statErrorWords = document.getElementById('stat-error-words');
        if (statErrorWords) {
            statErrorWords.textContent = errorWords.length;
        }
    },
    
    /**
     * 显示练习结果
     */
    showResults(logId) {
        const logs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs();
        const log = logs.find(l => l.id === logId);
        
        if (!log) {
            console.error('练习记录不存在');
            return;
        }
        
        this.currentLogId = logId;
        this.hasChanges = false;
        
        // 显示统计数据
        this.updateResultStats(log);
        
        // 结果页错题卡片：复用错题本卡片样式
        if (typeof ErrorBook !== 'undefined' && ErrorBook.renderCardsForLog) {
            ErrorBook.renderCardsForLog(log, false);
        } else {
            this.showErrorWordsList(log.errorWords || []);
        }
        
        // 绑定确认修改按钮
        const confirmBtn = document.getElementById('confirm-changes-btn');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.onclick = () => {
                if (this.hasChanges) {
                    // 获取当前日志ID（从结果页的卡片中获取）
                    const container = document.getElementById('error-words-list');
                    if (container) {
                        const firstToggle = container.querySelector('.result-toggle');
                        if (firstToggle) {
                            const logId = firstToggle.getAttribute('data-log-id');
                            if (logId) {
                                const logs = Storage.getPracticeLogs();
                                const log = logs.find(l => l.id === logId);
                                if (log) {
                                    // 重新渲染卡片，确保卡片移动到正确的模块
                                    if (typeof ErrorBook !== 'undefined' && ErrorBook.renderCardsForLog) {
                                        ErrorBook.renderCardsForLog(log, false);
                                    }
                                }
                            }
                        }
                    }
                    this.hasChanges = false;
                    confirmBtn.disabled = true;
                    // 更新首页统计
                    this.updateHomeStats();
                    alert('修改已保存');
                }
            };
        }
        
        // 显示结果页面
        if (typeof Main !== 'undefined') {
            Main.showPage('results');
        }
    },
    
    /**
     * 更新结果页统计显示
     */
    updateResultStats(log) {
        const correct = log.correctCount || 0;
        const error = log.errorCount || 0;
        const total = log.totalWords || 0;
        const score = total > 0 ? Math.round((correct / total) * 100) : 0;
        
        // 分数放在第一个，字体大
        const scoreEl = document.getElementById('result-accuracy');
        if (scoreEl) {
            scoreEl.textContent = `${score}分`;
            scoreEl.style.fontSize = '2rem';
            scoreEl.style.fontWeight = 'bold';
        }
        
        // 其他统计：数字和label字体大小互换
        const totalEl = document.getElementById('result-total');
        if (totalEl) {
            totalEl.textContent = total;
            totalEl.style.fontSize = '1rem'; // 数字用1rem（原来是0.9rem）
        }
        
        const correctErrorEl = document.getElementById('result-correct-error');
        if (correctErrorEl) {
            correctErrorEl.textContent = `正确${correct}，错误${error}`;
            correctErrorEl.style.fontSize = '0.85rem';
        }
        
        const totalTimeEl = document.getElementById('result-total-time');
        if (totalTimeEl) {
            totalTimeEl.textContent = `${Math.round(log.totalTime || 0)}秒`;
            totalTimeEl.style.fontSize = '1rem'; // 数字用1rem（原来是0.9rem）
        }
        
        const avgTimeEl = document.getElementById('result-avg-time');
        if (avgTimeEl) {
            avgTimeEl.textContent = `${Math.round(log.averageTime || 0)}秒`;
            avgTimeEl.style.fontSize = '1rem'; // 数字用1rem（原来是0.9rem）
        }
        
        // label字体大小改为0.9rem（原来是1rem）
        const statTexts = document.querySelectorAll('.stat-text');
        statTexts.forEach(el => {
            el.style.fontSize = '0.9rem';
        });
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
        const errorWords = Storage.getErrorWordsFiltered();
        
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
                            <div class="d-flex gap-3 align-items-center mt-2">
                                <div class="word-box"><img class="snapshot-invert" src="${latestSnapshot.snapshot}" alt="手写" style="max-width: 90%; max-height: 90%; object-fit: contain;"></div>
                                <div class="word-box standard-dark-box text-center">
                                    <div class="standard-dark-text" style="font-size: 3rem;">${word.word}</div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                `;
            }
        });
        
        errorList.innerHTML = html;
    },
    
    /**
     * 更新结果页中单个题目的对错状态
     */
    updateResultItemStatus(logId, itemIdx, isCorrect) {
        const logs = Storage.getPracticeLogs();
        const log = logs.find(l => l.id === logId);
        if (!log || !log.details || itemIdx >= log.details.length) return;
        
        const item = log.details[itemIdx];
        const wasCorrect = item.correct;
        item.correct = isCorrect;
        
        // 更新统计计数
        if (wasCorrect && !isCorrect) {
            log.correctCount = Math.max(0, (log.correctCount || 0) - 1);
            log.errorCount = (log.errorCount || 0) + 1;
            if (!log.errorWords) log.errorWords = [];
            if (!log.errorWords.includes(item.wordId)) {
                log.errorWords.push(item.wordId);
            }
        } else if (!wasCorrect && isCorrect) {
            log.correctCount = (log.correctCount || 0) + 1;
            log.errorCount = Math.max(0, (log.errorCount || 0) - 1);
            if (log.errorWords) {
                const idx = log.errorWords.indexOf(item.wordId);
                if (idx >= 0) log.errorWords.splice(idx, 1);
            }
        }
        
        // 保存
        Storage.savePracticeLogs(logs);
        
        // 标记有修改并启用确认按钮
        this.hasChanges = true;
        const confirmBtn = document.getElementById('confirm-changes-btn');
        if (confirmBtn) {
            confirmBtn.disabled = false;
        }
        
        // 更新显示
        this.updateResultStats(log);
        
        // 更新卡片显示（重新渲染，立即更新UI）
        if (typeof ErrorBook !== 'undefined' && ErrorBook.renderCardsForLog) {
            ErrorBook.renderCardsForLog(log, false);
        }
    }
};
