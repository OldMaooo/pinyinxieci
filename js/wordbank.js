/**
 * 题库管理模块
 */

const WordBank = {
    /**
     * 加载题库列表
     */
    loadWordBank() {
        const wordBank = Storage.getWordBank();
        const tbody = document.getElementById('wordbank-table-body');
        
        if (!wordBank || wordBank.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">暂无数据，请先导入题库</td></tr>';
            return;
        }
        
        tbody.innerHTML = wordBank.map(word => `
            <tr>
                <td><strong>${word.word}</strong></td>
                <td>${word.pinyin || ''}</td>
                <td>${word.grade || ''}年级</td>
                <td>${word.semester || ''}学期</td>
                <td>第${word.unit || ''}单元</td>
                <td>
                    <button class="btn btn-sm btn-danger" onclick="WordBank.deleteWord('${word.id}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
        // 更新统计
        this.updateDataStats();
    },
    
    /**
     * 导入题库（JSON文件）- 仅导入题库
     */
    async importFromFile(file) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            if (!data.wordBank && !Array.isArray(data)) {
                throw new Error('无效的数据格式');
            }
            
            const wordsToImport = Array.isArray(data) ? data : data.wordBank;
            
            let imported = 0;
            wordsToImport.forEach(word => {
                const result = Storage.addWord({
                    word: word.word,
                    pinyin: word.pinyin || '',
                    grade: word.grade || 1,
                    semester: word.semester || '上',
                    unit: word.unit || 1
                });
                if (result) imported++;
            });
            
            this.loadWordBank();
            this.showToast('success', `成功导入 ${imported} 个生字`);
            
            // 更新统计
            if (typeof Statistics !== 'undefined') {
                Statistics.updateHomeStats();
            }
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('danger', `导入失败: ${error.message}`);
        }
    },
    
    /**
     * 导入完整数据（题库+练习记录+错题本+设置）
     */
    async importFullData(file, mergeMode = false) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // 检查是否是完整数据格式
            if (!data.version) {
                // 如果不是完整格式，尝试作为题库导入
                return this.importFromFile(file);
            }
            
            // 确认导入
            const mode = mergeMode ? '合并' : '替换';
            const confirmMsg = `即将${mode}所有数据：\n` +
                `- 题库：${data.wordBank?.length || 0} 个字\n` +
                `- 练习记录：${data.practiceLogs?.length || 0} 条\n` +
                `- 错题：${data.errorWords?.length || 0} 个\n` +
                `- 设置：${data.settings ? '已包含' : '无'}\n\n` +
                `确定要${mode}吗？${mergeMode ? '(会保留现有数据)' : '(会清空现有数据)'}`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // 导入数据
            Storage.importAll(data, mergeMode);
            
            // 重新加载界面
            this.loadWordBank();
            
            // 更新统计
            if (typeof Statistics !== 'undefined') {
                Statistics.updateHomeStats();
            }
            
            // 更新错题本
            if (typeof ErrorBook !== 'undefined') {
                ErrorBook.load();
            }
            
            const stats = {
                words: data.wordBank?.length || 0,
                logs: data.practiceLogs?.length || 0,
                errors: data.errorWords?.length || 0
            };
            
            this.showToast('success', 
                `✅ 导入成功！题库：${stats.words} 字，练习：${stats.logs} 条，错题：${stats.errors} 个`);
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('danger', `导入失败: ${error.message}`);
        }
    },
    
    /**
     * 导出题库（仅题库数据）
     */
    exportWordBankOnly() {
        const wordBank = Storage.getWordBank();
        const data = {
            wordBank: wordBank,
            exportDate: new Date().toISOString(),
            type: 'wordbank_only'
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_题库_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('success', '题库导出成功');
    },
    
    /**
     * 导出完整数据（题库+练习记录+错题本+设置）
     */
    exportToFile() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_完整数据_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        const stats = {
            words: data.wordBank?.length || 0,
            logs: data.practiceLogs?.length || 0,
            errors: data.errorWords?.length || 0
        };
        
        this.showToast('success', 
            `✅ 导出成功！包含 ${stats.words} 字，${stats.logs} 条练习记录，${stats.errors} 个错题`);
    },
    
    /**
     * 删除生字
     */
    deleteWord(wordId) {
        if (confirm('确定要删除这个生字吗？')) {
            const wordBank = Storage.getWordBank();
            const filtered = wordBank.filter(w => w.id !== wordId);
            Storage.saveWordBank(filtered);
            this.loadWordBank();
            this.showToast('success', '删除成功');
        }
    },
    
    /**
     * 显示提示
     */
    showToast(type, message) {
        const toast = document.getElementById('toast');
        const toastBody = document.getElementById('toast-body');
        toastBody.textContent = message;
        toast.classList.remove('bg-success', 'bg-danger', 'bg-info');
        toast.classList.add(`bg-${type}`);
        
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
    }
};

    /**
     * 更新数据统计显示
     */
    updateDataStats() {
        const wordBank = Storage.getWordBank();
        const logs = Storage.getPracticeLogs();
        const errors = Storage.getErrorWords();
        
        // 计算数据大小
        const allData = Storage.exportAll();
        const dataSize = JSON.stringify(allData).length;
        const sizeText = dataSize < 1024 ? `${dataSize} B` : 
                        dataSize < 1024 * 1024 ? `${(dataSize / 1024).toFixed(1)} KB` :
                        `${(dataSize / 1024 / 1024).toFixed(2)} MB`;
        
        const wordsCountEl = document.getElementById('stat-words-count');
        const logsCountEl = document.getElementById('stat-logs-count');
        const errorsCountEl = document.getElementById('stat-errors-count');
        const sizeEl = document.getElementById('stat-size');
        
        if (wordsCountEl) wordsCountEl.textContent = wordBank.length;
        if (logsCountEl) logsCountEl.textContent = logs.length;
        if (errorsCountEl) errorsCountEl.textContent = errors.length;
        if (sizeEl) sizeEl.textContent = sizeText;
    }
};

// 绑定导入导出按钮
document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-file-input');
    const importModeSelect = document.getElementById('import-mode-select');
    const importMergeSelect = document.getElementById('import-merge-select');
    const exportFullBtn = document.getElementById('export-full-btn');
    const exportWordBankBtn = document.getElementById('export-wordbank-btn');
    
    // 更新统计
    if (typeof WordBank !== 'undefined') {
        WordBank.updateDataStats();
    }
    
    // 导入模式选择
    if (importModeSelect) {
        importModeSelect.addEventListener('change', () => {
            const isFull = importModeSelect.value === 'full';
            if (importMergeSelect) {
                importMergeSelect.style.display = isFull ? 'block' : 'none';
            }
        });
    }
    
    // 导入按钮
    if (importBtn && importInput) {
        importBtn.addEventListener('click', async () => {
            if (importInput.files.length === 0) {
                WordBank.showToast('warning', '请先选择文件');
                return;
            }
            
            const mode = importModeSelect?.value || 'wordbank';
            const mergeMode = importMergeSelect?.value === 'merge';
            
            if (mode === 'full') {
                await WordBank.importFullData(importInput.files[0], mergeMode);
            } else {
                await WordBank.importFromFile(importInput.files[0]);
            }
            
            // 更新统计
            WordBank.updateDataStats();
            
            // 清空文件选择
            importInput.value = '';
        });
    }
    
    // 导出完整数据
    if (exportFullBtn) {
        exportFullBtn.addEventListener('click', () => {
            WordBank.exportToFile();
        });
    }
    
    // 仅导出题库
    if (exportWordBankBtn) {
        exportWordBankBtn.addEventListener('click', () => {
            WordBank.exportWordBankOnly();
        });
    }
});
