/**
 * 导出模块
 * 导出错题和未来复习计划
 */

const Export = {
    /**
     * 导出错题和复习计划（轻量文件）
     * 格式：word + review date
     */
    exportErrorsAndReviewPlan() {
        const errorWords = Storage.getErrorWordsFiltered();
        const wordBank = Storage.getWordBank();
        
        if (!errorWords || errorWords.length === 0) {
            alert('暂无错题可导出');
            return;
        }
        
        // 构建导出数据：错题 + 未来复习计划
        const exportData = errorWords.map(errorWord => {
            const word = wordBank.find(w => w.id === errorWord.wordId);
            if (!word) return null;
            
            // 计算未来复习计划（基于艾宾浩斯曲线）
            // 复习时间点：1小时后、1天后、3天后、1周后、2周后、1个月后
            const REVIEW_INTERVALS = [1, 24, 72, 168, 336, 720]; // 小时
            const firstMarkedAt = errorWord.markedAt || new Date().toISOString();
            const firstDate = new Date(firstMarkedAt);
            
            const reviewDates = REVIEW_INTERVALS.map(hours => {
                const reviewDate = new Date(firstDate.getTime() + hours * 60 * 60 * 1000);
                return reviewDate.toISOString().split('T')[0]; // YYYY-MM-DD格式
            });
            
            return {
                word: word.word,
                pinyin: word.pinyin || '',
                grade: word.grade || '',
                semester: word.semester || '',
                unit: word.unitLabel || word.unit || '',
                markedAt: firstMarkedAt.split('T')[0], // 首次标记日期
                reviewDates: reviewDates // 未来复习日期列表
            };
        }).filter(item => item !== null);
        
        // 生成CSV格式（更轻量，易于查看）
        const csvRows = [];
        csvRows.push('生字,拼音,年级,学期,单元,首次标记日期,复习日期1,复习日期2,复习日期3,复习日期4,复习日期5,复习日期6');
        
        exportData.forEach(item => {
            const row = [
                item.word,
                item.pinyin,
                item.grade,
                item.semester,
                item.unit,
                item.markedAt,
                ...item.reviewDates
            ].map(cell => `"${cell}"`).join(',');
            csvRows.push(row);
        });
        
        const csvContent = csvRows.join('\n');
        
        // 添加BOM以支持Excel正确显示中文
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_错题和复习计划_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        // 显示成功提示
        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
            WordBank.showToast('success', `✅ 导出成功！包含 ${exportData.length} 个错题及其复习计划`);
        } else {
            alert(`✅ 导出成功！包含 ${exportData.length} 个错题及其复习计划`);
        }
    }
};

