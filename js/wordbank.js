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
    },
    
    /**
     * 导入题库（JSON文件）
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
     * 导出题库
     */
    exportToFile() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('success', '导出成功');
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

// 绑定导入导出按钮
document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-file-input');
    const exportBtn = document.getElementById('export-btn');
    
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => {
            if (importInput.files.length > 0) {
                WordBank.importFromFile(importInput.files[0]);
            } else {
                WordBank.showToast('warning', '请先选择文件');
            }
        });
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            WordBank.exportToFile();
        });
    }
});
