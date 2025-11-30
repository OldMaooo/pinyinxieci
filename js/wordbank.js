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
        console.log('[WordBank] loadWordBank 调用，当前字数:', wordBank?.length || 0);
        
        // 如果表格元素不存在（已移除），跳过
        if (!tbody) {
            console.log('[WordBank] loadWordBank: wordbank-table-body 不存在，跳过加载');
            // 更新统计即可
            this.updateDataStats();
            return;
        }
        
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
            
            // 检查是否是同步数据格式
            if (data.type === 'sync') {
                // 如果是同步数据，使用同步数据导入
                return this.importSyncData(file, mergeMode);
            }
            
            // 确认导入
            const mode = mergeMode ? '合并' : '替换';
            const confirmMsg = `即将${mode}所有数据：\n` +
                `- 题库：${data.wordBank?.length || 0} 个字\n` +
                `- 练习记录：${data.practiceLogs?.length || 0} 条\n` +
                `- 错题：${data.errorWords?.length || 0} 个\n` +
                `- 掌握状态：${Object.keys(data.wordMastery || {}).length} 个\n` +
                `- 复习计划：${Object.keys(data.reviewPlans || {}).length} 个\n` +
                `- 任务列表：${data.taskList?.length || 0} 个\n` +
                `- 设置：${data.settings ? '已包含' : '无'}\n\n` +
                `确定要${mode}吗？${mergeMode ? '(会保留现有数据)' : '(会清空现有数据)'}`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // 导入数据
            Storage.importAll(data, mergeMode);
            
            // 重新加载界面
            this.loadWordBank();
            this.loadMasteryView();
            
            // 更新统计
            if (typeof Statistics !== 'undefined') {
                Statistics.updateHomeStats();
            }
            
            // 更新错题本
            if (typeof ErrorBook !== 'undefined') {
                ErrorBook.load();
            }
            
            // 更新任务列表
            if (typeof TaskListUI !== 'undefined' && TaskListUI.load) {
                TaskListUI.load();
            }
            
            const stats = {
                words: data.wordBank?.length || 0,
                logs: data.practiceLogs?.length || 0,
                errors: data.errorWords?.length || 0,
                mastery: Object.keys(data.wordMastery || {}).length,
                plans: Object.keys(data.reviewPlans || {}).length,
                tasks: data.taskList?.length || 0
            };
            
            this.showToast('success', 
                `✅ 导入成功！包含 ${stats.words} 字，${stats.logs} 条练习记录，${stats.errors} 个错题，${stats.mastery} 个掌握状态，${stats.plans} 个复习计划，${stats.tasks} 个任务`);
        } catch (error) {
            console.error('导入失败:', error);
            this.showToast('danger', `导入失败: ${error.message}`);
        }
    },
    
    /**
     * 导入同步数据（轻量级，只导入需要同步的数据）
     */
    async importSyncData(file, mergeMode = false) {
        try {
            const text = await file.text();
            const data = JSON.parse(text);
            
            // 确认导入
            const mode = mergeMode ? '合并' : '替换';
            const confirmMsg = `即将${mode}同步数据：\n` +
                `- 掌握状态：${Object.keys(data.wordMastery || {}).length} 个\n` +
                `- 错题：${data.errorWords?.length || 0} 个\n` +
                `- 复习计划：${Object.keys(data.reviewPlans || {}).length} 个\n` +
                `- 任务列表：${data.taskList?.length || 0} 个\n\n` +
                `确定要${mode}吗？${mergeMode ? '(会保留现有数据)' : '(会清空现有数据)'}`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            // 导入数据
            Storage.importSyncData(data, mergeMode);
            
            // 重新加载界面
            this.loadMasteryView();
            
            // 更新错题本
            if (typeof ErrorBook !== 'undefined') {
                ErrorBook.load();
            }
            
            // 更新任务列表
            if (typeof TaskListUI !== 'undefined' && TaskListUI.load) {
                TaskListUI.load();
            }
            
            const stats = {
                mastery: Object.keys(data.wordMastery || {}).length,
                errors: data.errorWords?.length || 0,
                plans: Object.keys(data.reviewPlans || {}).length,
                tasks: data.taskList?.length || 0
            };
            
            this.showToast('success', 
                `✅ 同步数据导入成功！包含 ${stats.mastery} 个掌握状态，${stats.errors} 个错题，${stats.plans} 个复习计划，${stats.tasks} 个任务`);
        } catch (error) {
            console.error('导入同步数据失败:', error);
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
     * 导出完整数据（题库+练习记录+错题本+设置+掌握状态+复习计划+任务列表）
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
            errors: data.errorWords?.length || 0,
            mastery: Object.keys(data.wordMastery || {}).length,
            plans: Object.keys(data.reviewPlans || {}).length,
            tasks: data.taskList?.length || 0
        };
        
        this.showToast('success', 
            `✅ 导出成功！包含 ${stats.words} 字，${stats.logs} 条练习记录，${stats.errors} 个错题，${stats.mastery} 个掌握状态，${stats.plans} 个复习计划，${stats.tasks} 个任务`);
    },
    
    /**
     * 导出同步数据（轻量级，只包含需要同步的数据：掌握状态、错题、复习计划、任务列表）
     */
    exportSyncData() {
        const data = Storage.exportSyncData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `看拼音写词_同步数据_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        
        const stats = {
            mastery: Object.keys(data.wordMastery || {}).length,
            errors: data.errorWords?.length || 0,
            plans: Object.keys(data.reviewPlans || {}).length,
            tasks: data.taskList?.length || 0
        };
        
        this.showToast('success', 
            `✅ 同步数据导出成功！包含 ${stats.mastery} 个掌握状态，${stats.errors} 个错题，${stats.plans} 个复习计划，${stats.tasks} 个任务`);
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
        if (!toast) {
            console.warn('[WordBank.showToast] toast元素不存在');
            return;
        }
        const toastBody = document.getElementById('toast-body');
        if (toastBody) {
        toastBody.textContent = message;
        }
        // 使用默认的toast样式，不添加背景色类
        toast.classList.remove('bg-success', 'bg-danger', 'bg-info', 'bg-warning');
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: true,
            delay: 2000
        });
        bsToast.show();
    },

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
    },
    
    /**
     * 加载掌握状态管理视图（复用练习范围视图）
     */
    loadMasteryView() {
        const container = document.getElementById('wordbank-practice-range-container');
        if (!container) {
            console.warn('[WordBank.loadMasteryView] 容器不存在: wordbank-practice-range-container');
            return;
        }
        
        // 检查是否在题库管理页面
        const wordbankSection = document.getElementById('wordbank');
        if (!wordbankSection || wordbankSection.classList.contains('d-none')) {
            // 不在题库管理页面，不加载
            return;
        }
        
        const wordBank = Storage.getWordBank();
        if (!wordBank || wordBank.length === 0) {
            if (container) {
                container.innerHTML = '<div class="text-center text-muted py-3">暂无题库数据</div>';
            }
            return;
        }
        
        // 使用PracticeRange的表格视图，但禁用选择功能，改为掌握状态管理
        if (typeof PracticeRange !== 'undefined' && PracticeRange.renderTableView) {
            try {
                PracticeRange.renderTableView(container, wordBank, {
                    context: 'wordbank',
                    showCheckboxes: true,
                    showMasteryStatus: true
                });
                
                // 绑定掌握状态管理事件
                this.bindMasteryEvents(container);
            } catch (error) {
                console.error('[WordBank.loadMasteryView] 渲染失败:', error);
                if (container) {
                    container.innerHTML = '<div class="text-center text-danger py-3">加载失败，请刷新页面</div>';
                }
            }
        } else {
            if (container) {
                container.innerHTML = '<div class="text-center text-muted py-3">练习范围模块未加载</div>';
            }
        }
    },
    
    /**
     * 绑定掌握状态管理事件
     */
    bindMasteryEvents(container) {
        if (!container) return;
        
        // 监听复选框变化，更新选中数量（不再禁用按钮）
        container.addEventListener('change', (e) => {
            if (e.target.classList.contains('unit-checkbox')) {
                this.updateSelectedCount();
            }
        });
        
        // 监听单个字的点击事件（设置掌握状态）
        // 使用捕获阶段，确保在行点击事件之前处理
        container.addEventListener('click', (e) => {
            const wordTag = e.target.closest('.word-tag-clickable');
            if (wordTag && wordTag.dataset.wordId) {
                e.stopPropagation(); // 阻止事件冒泡到行
                e.preventDefault(); // 阻止默认行为
                this.toggleWordMasteryStatus(wordTag, wordTag.dataset.wordId);
            }
        }, true); // 使用捕获阶段
        
        // 批量设为已掌握
        const masterBtn = document.getElementById('wordbank-batch-master-btn');
        if (masterBtn) {
            // 移除旧的事件监听器，避免重复绑定
            const newMasterBtn = masterBtn.cloneNode(true);
            masterBtn.parentNode.replaceChild(newMasterBtn, masterBtn);
            newMasterBtn.addEventListener('click', () => {
                this.batchSetMastery(true);
            });
        }
        
        // 批量设为未练习
        const unpracticedBtn = document.getElementById('wordbank-batch-unpracticed-btn');
        if (unpracticedBtn) {
            const newUnpracticedBtn = unpracticedBtn.cloneNode(true);
            unpracticedBtn.parentNode.replaceChild(newUnpracticedBtn, unpracticedBtn);
            newUnpracticedBtn.addEventListener('click', () => {
                this.batchSetStatus('default');
            });
        }
        
        // 批量设为错题
        const errorBtn = document.getElementById('wordbank-batch-error-btn');
        if (errorBtn) {
            const newErrorBtn = errorBtn.cloneNode(true);
            errorBtn.parentNode.replaceChild(newErrorBtn, errorBtn);
            newErrorBtn.addEventListener('click', () => {
                this.batchSetStatus('error');
            });
        }
    },
    
    /**
     * 切换单个字的掌握状态（三态循环：默认 → 错题 → 已掌握 → 默认）
     */
    toggleWordMasteryStatus(wordTag, wordId) {
        const wordBank = Storage.getWordBank();
        const word = wordBank.find(w => w.id === wordId);
        if (!word) {
            this.showToast('warning', '未找到该字');
            return;
        }
        
        // 获取当前状态
        const mastery = Storage.getWordMastery();
        const currentStatus = mastery[wordId] || 'default'; // 直接检查对象，不使用getWordMasteryStatus避免默认值问题
        
        // 三态循环：默认 → 错题 → 已掌握 → 默认
        let nextStatus;
        let actionText;
        if (!currentStatus || currentStatus === 'default') {
            nextStatus = 'error';
            actionText = '设为错题';
        } else if (currentStatus === 'error') {
            nextStatus = 'mastered';
            actionText = '设为已掌握';
        } else { // mastered
            nextStatus = 'default';
            actionText = '设为未练习';
        }
        
        // 设置新状态
        Storage.setWordMasteryStatus(wordId, nextStatus);
        
        // 同步错题本
        if (nextStatus === 'error') {
            // 添加到错题本
            if (Storage.addErrorWord) {
                Storage.addErrorWord(wordId, word.word, word.pinyin || '', null);
            }
        } else if (nextStatus === 'default' || nextStatus === 'mastered') {
            // 从错题本移除
            if (Storage.removeErrorWord) {
                Storage.removeErrorWord(wordId);
            }
        }
        
        this.showToast('success', `已将"${word.word}"${actionText}`);
        
        // 立即更新标签颜色，无需等待刷新
        this.updateWordTagColor(wordTag, nextStatus);
    },
    
    /**
     * 更新单个字标签的颜色
     */
    updateWordTagColor(wordTag, status) {
        // 移除所有状态类
        wordTag.classList.remove('word-tag-default', 'word-tag-error', 'word-tag-mastered');
        
        // 添加新状态类
        if (status === 'error') {
            wordTag.classList.add('word-tag-error');
        } else if (status === 'mastered') {
            wordTag.classList.add('word-tag-mastered');
        } else {
            wordTag.classList.add('word-tag-default');
        }
    },
    
    /**
     * 更新选中数量
     */
    updateSelectedCount() {
        const container = document.getElementById('wordbank-practice-range-container');
        if (!container) return;
        
        const selected = container.querySelectorAll('.unit-checkbox:checked');
        const count = selected.length;
        const countEl = document.getElementById('wordbank-selected-count');
        const toolbar = document.getElementById('wordbank-batch-toolbar');
        const unpracticedBtn = document.getElementById('wordbank-batch-unpracticed-btn');
        const masterBtn = document.getElementById('wordbank-batch-master-btn');
        const errorBtn = document.getElementById('wordbank-batch-error-btn');
        
        if (countEl) countEl.textContent = count;
        if (toolbar) {
            toolbar.style.display = count > 0 ? 'flex' : 'none';
        }
        const disabled = count === 0;
        if (unpracticedBtn) unpracticedBtn.disabled = disabled;
        if (masterBtn) masterBtn.disabled = disabled;
        if (errorBtn) errorBtn.disabled = disabled;
    },
    
    /**
     * 批量设置掌握状态（兼容旧方法）
     */
    batchSetMastery(isMastered) {
        this.batchSetStatus(isMastered ? 'mastered' : 'default');
    },
    
    /**
     * 批量设置状态（未练习/已掌握/错题）
     */
    batchSetStatus(status) {
        const container = document.getElementById('wordbank-practice-range-container');
        if (!container) return;
        
        const selected = container.querySelectorAll('.unit-checkbox:checked');
        if (selected.length === 0) {
            this.showToast('warning', '请先选择要设置的单元');
            return;
        }
        
        const wordBank = Storage.getWordBank();
        if (typeof PracticeRange === 'undefined' || !PracticeRange.groupWordsBySemesterUnit) {
            this.showToast('danger', '练习范围模块未加载');
            return;
        }
        
        const grouped = PracticeRange.groupWordsBySemesterUnit(wordBank);
        const selectedWords = [];
        
        selected.forEach(checkbox => {
            const semester = checkbox.dataset.semester;
            const unit = checkbox.dataset.unit;
            const words = grouped[semester]?.[unit];
            if (words && Array.isArray(words)) {
                selectedWords.push(...words);
            }
        });
        
        if (selectedWords.length === 0) {
            this.showToast('warning', '未找到选中的题目');
            return;
        }
        
        const statusMap = {
            'default': '未练习',
            'mastered': '已掌握',
            'error': '错题'
        };
        const action = statusMap[status] || '设置';
        
        if (confirm(`确定要将选中的 ${selectedWords.length} 个字设为${action}吗？`)) {
            // 批量设置状态
            let updated = 0;
            selectedWords.forEach(word => {
                if (Storage.setWordMasteryStatus) {
                    Storage.setWordMasteryStatus(word.id, status);
                    updated++;
                    
                    // 如果设为错题，同时添加到错题本
                    if (status === 'error' && Storage.addErrorWord) {
                        Storage.addErrorWord(word.id, word.word, word.pinyin || '', null);
                    }
                    // 如果设为已掌握或未练习，从错题本中移除（如果存在）
                    else if ((status === 'mastered' || status === 'default') && Storage.removeErrorWord) {
                        Storage.removeErrorWord(word.id);
                    }
                }
            });
            
            this.showToast('success', `已${action} ${updated} 个字`);
            
            // 刷新视图并更新饼图
            this.loadMasteryView();
            
            // 立即更新学期饼图（不等待重新渲染）
            this.updateSemesterPies(container, status, selectedWords);
        }
    },
    
    /**
     * 更新学期饼图（批量设置后立即更新）
     */
    updateSemesterPies(container, status, selectedWords) {
        if (!container || !selectedWords || selectedWords.length === 0) return;
        
        const wordBank = Storage.getWordBank();
        const grouped = PracticeRange.groupWordsBySemesterUnit(wordBank);
        const wordMastery = Storage.getWordMastery();
        
        // 按学期分组统计
        const semesterStats = new Map();
        
        selectedWords.forEach(word => {
            const gradeLabel = PracticeRange.formatGradeLabel(word.grade);
            const semesterLabel = PracticeRange.formatSemesterLabel(word.semester);
            const semesterKey = `${gradeLabel}${semesterLabel}`;
            
            if (!semesterStats.has(semesterKey)) {
                semesterStats.set(semesterKey, { mastered: 0, error: 0, total: 0 });
            }
            
            const stats = semesterStats.get(semesterKey);
            stats.total++;
            
            const masteryStatus = wordMastery[word.id];
            if (masteryStatus === 'mastered') {
                stats.mastered++;
            } else if (masteryStatus === 'error') {
                stats.error++;
            }
        });
        
        // 更新每个学期的饼图
        semesterStats.forEach((stats, semesterKey) => {
            const semesterHeader = container.querySelector(`.semester-checkbox[data-semester="${semesterKey}"]`)?.closest('.practice-semester-header');
            if (!semesterHeader) return;
            
            // 计算该学期的所有单元
            const units = grouped[semesterKey];
            if (!units) return;
            
            let totalMastered = 0;
            let totalError = 0;
            let totalCount = 0;
            
            Object.values(units).forEach(unitWords => {
                if (Array.isArray(unitWords)) {
                    unitWords.forEach(w => {
                        totalCount++;
                        const masteryStatus = wordMastery[w.id];
                        if (masteryStatus === 'mastered') {
                            totalMastered++;
                        } else if (masteryStatus === 'error') {
                            totalError++;
                        }
                    });
                }
            });
            
            // 生成新的饼图（绿、红、灰顺序）- 使用PracticeRange的方法
            const pieHtml = PracticeRange.generateSemesterPie(totalMastered, totalError, totalCount);
            
            // 查找并更新饼图
            const button = semesterHeader.querySelector('.practice-semester-btn');
            if (button) {
                const existingPie = button.querySelector('span[style*="margin-left"]');
                if (existingPie) {
                    existingPie.outerHTML = pieHtml;
                } else {
                    // 如果找不到，在按钮末尾添加
                    button.insertAdjacentHTML('beforeend', pieHtml);
                }
            }
        });
    }
};

// 绑定导入导出按钮
document.addEventListener('DOMContentLoaded', () => {
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-file-input');
    const importMergeSelect = document.getElementById('import-merge-select');
    const exportSyncBtn = document.getElementById('export-sync-btn');
    
    // 更新统计
    if (typeof WordBank !== 'undefined') {
        WordBank.updateDataStats();
    }
    
    // 导入按钮（只支持同步数据导入）
    if (importBtn && importInput) {
        importBtn.addEventListener('click', async () => {
            if (importInput.files.length === 0) {
                WordBank.showToast('warning', '请先选择文件');
                return;
            }
            
            const mergeMode = importMergeSelect?.value === 'merge';
            
            // 尝试导入同步数据，如果不是同步数据格式，则提示错误
            try {
                const text = await importInput.files[0].text();
                const data = JSON.parse(text);
                
                if (data.type === 'sync') {
                    // 是同步数据，使用同步数据导入
                    await WordBank.importSyncData(importInput.files[0], mergeMode);
                } else if (data.version) {
                    // 是完整数据，提示用户使用完整数据导入功能（如果将来需要）
                    WordBank.showToast('warning', '这是完整数据文件，请使用完整数据导入功能（如果可用）');
                } else {
                    // 未知格式
                    WordBank.showToast('warning', '文件格式不正确，请选择同步数据文件');
                }
            } catch (error) {
                WordBank.showToast('danger', `导入失败: ${error.message}`);
            }
            
            // 更新统计
            WordBank.updateDataStats();
            
            // 清空文件选择
            importInput.value = '';
        });
    }
    
    // 展开收起图标切换
    const importExportHeader = document.getElementById('import-export-header');
    const importExportCollapse = document.getElementById('import-export-collapse');
    const importExportChevron = document.getElementById('import-export-chevron');
    if (importExportHeader && importExportCollapse && importExportChevron) {
        importExportCollapse.addEventListener('show.bs.collapse', () => {
            importExportChevron.classList.remove('bi-chevron-down');
            importExportChevron.classList.add('bi-chevron-up');
        });
        importExportCollapse.addEventListener('hide.bs.collapse', () => {
            importExportChevron.classList.remove('bi-chevron-up');
            importExportChevron.classList.add('bi-chevron-down');
        });
    }
    
    // 导出同步数据
    if (exportSyncBtn) {
        exportSyncBtn.addEventListener('click', () => {
            WordBank.exportSyncData();
        });
    }
});

// 识别服务配置相关方法
WordBank.initProxyConfig = function() {
    const proxyInput = document.getElementById('proxy-base-input');
    const proxyStatusText = document.getElementById('proxy-status-text');
    const testProxyBtn = document.getElementById('test-proxy-btn');
    const saveProxyBtn = document.getElementById('save-proxy-btn');
    const resetProxyBtn = document.getElementById('reset-proxy-btn');
    const autoDetectProxyBtn = document.getElementById('auto-detect-proxy-btn');
    
    // 加载当前配置
    const loadProxyConfig = () => {
        const currentProxy = localStorage.getItem('proxyBase') || 'https://pinyinxieci.vercel.app';
        if (proxyInput) {
            proxyInput.value = currentProxy;
        }
        // 延迟更新状态，确保 DOM 已准备好
        setTimeout(() => this.updateProxyStatus(), 100);
    };
    
    // 更新状态显示
    this.updateProxyStatus = () => {
        if (!proxyStatusText) {
            // 如果状态文本不存在，延迟重试
            setTimeout(() => this.updateProxyStatus(), 200);
            return;
        }
        
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        const currentProxy = localStorage.getItem('proxyBase');
        
        if (!isGitHubPages) {
            proxyStatusText.textContent = '本地环境，使用同源代理';
            proxyStatusText.className = 'text-success';
        } else if (currentProxy && currentProxy.trim()) {
            proxyStatusText.textContent = `已配置: ${currentProxy}`;
            proxyStatusText.className = 'text-success';
        } else {
            proxyStatusText.textContent = '未配置，识别功能不可用';
            proxyStatusText.className = 'text-danger';
        }
    };
    
    // 测试代理连接
    this.testProxy = async () => {
        if (!proxyInput || !testProxyBtn) return;
        
        const proxyUrl = proxyInput.value.trim();
        if (!proxyUrl) {
            this.showToast('warning', '请先输入代理地址');
            return;
        }
        
        const testUrl = `${proxyUrl.replace(/\/$/, '')}/api/baidu-proxy`;
        const originalText = testProxyBtn.innerHTML;
        testProxyBtn.disabled = true;
        testProxyBtn.innerHTML = '<i class="bi bi-hourglass-split"></i> 测试中...';
        
        if (proxyStatusText) {
            proxyStatusText.textContent = '测试中...';
            proxyStatusText.className = 'text-info';
        }
        
        // 调试日志
        if (typeof Debug !== 'undefined') {
            Debug.log('info', `开始测试代理连接: ${testUrl}`, 'network');
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时
            
            const response = await fetch(testUrl, { 
                method: 'GET',
                signal: controller.signal,
                mode: 'cors'
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`HTTP ${response.status}: ${errorText || '服务器错误'}`);
            }
            
            const data = await response.json().catch(() => ({}));
            
            if (data.ok || response.ok) {
                this.showToast('success', '✅ 代理连接正常！');
                if (proxyStatusText) {
                    proxyStatusText.textContent = '✅ 连接正常';
                    proxyStatusText.className = 'text-success';
                }
                // 自动保存配置
                localStorage.setItem('proxyBase', proxyUrl);
            } else {
                throw new Error('代理响应异常');
            }
        } catch (error) {
            let errorMsg = error.message;
            if (error.name === 'AbortError') {
                errorMsg = '连接超时（10秒）';
            } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                errorMsg = '网络错误：无法连接到代理服务器。请检查地址是否正确，或网络是否正常';
            }
            
            this.showToast('danger', `❌ 连接失败: ${errorMsg}`);
            if (proxyStatusText) {
                proxyStatusText.textContent = `❌ 连接失败: ${errorMsg}`;
                proxyStatusText.className = 'text-danger';
            }
        } finally {
            testProxyBtn.disabled = false;
            testProxyBtn.innerHTML = originalText;
        }
    };
    
    // 保存代理配置
    this.saveProxyConfig = () => {
        if (!proxyInput) return;
        
        const proxyUrl = proxyInput.value.trim();
        if (!proxyUrl) {
            this.showToast('warning', '请输入有效的代理地址');
            return;
        }
        
        // 验证URL格式
        try {
            new URL(proxyUrl);
        } catch (e) {
            this.showToast('danger', '无效的URL格式，请以 http:// 或 https:// 开头');
            return;
        }
        
        localStorage.setItem('proxyBase', proxyUrl);
        this.updateProxyStatus();
        this.showToast('success', '代理配置已保存');
        
        // 触发自动配置（如果识别模块已初始化）
        if (typeof Recognition !== 'undefined' && Recognition.autoConfigureProxy) {
            // 已自动配置，这里只更新状态
        }
    };
    
    // 恢复默认配置
    this.resetProxyConfig = () => {
        const defaultProxy = 'https://pinyinxieci.vercel.app';
        if (proxyInput) {
            proxyInput.value = defaultProxy;
        }
        localStorage.setItem('proxyBase', defaultProxy);
        this.updateProxyStatus();
        this.showToast('info', '已恢复默认配置');
    };
    
    // 自动检测
    this.autoDetectProxy = () => {
        const isGitHubPages = window.location.hostname.includes('github.io') || 
                              window.location.hostname.includes('github.com');
        
        if (!isGitHubPages) {
            this.showToast('info', '本地环境，无需配置云端代理');
            return;
        }
        
        // 触发自动配置
        if (typeof Recognition !== 'undefined' && Recognition.autoConfigureProxy) {
            Recognition.autoConfigureProxy();
            loadProxyConfig();
            this.showToast('success', '已自动检测并配置');
        } else {
            this.resetProxyConfig();
        }
    };
    
    // 绑定事件
    if (testProxyBtn) {
        testProxyBtn.addEventListener('click', () => this.testProxy());
    }
    
    if (saveProxyBtn) {
        saveProxyBtn.addEventListener('click', () => this.saveProxyConfig());
    }
    
    if (resetProxyBtn) {
        resetProxyBtn.addEventListener('click', () => this.resetProxyConfig());
    }
    
    if (autoDetectProxyBtn) {
        autoDetectProxyBtn.addEventListener('click', () => this.autoDetectProxy());
    }
    
    // 初始化加载
    loadProxyConfig();
    
    // 监听页面显示时刷新状态
    const observer = new MutationObserver(() => {
        const wordbankSection = document.getElementById('wordbank');
        if (wordbankSection && !wordbankSection.classList.contains('d-none')) {
            loadProxyConfig();
        }
    });
    
    const container = document.querySelector('.container-fluid');
    if (container) {
        observer.observe(container, { attributes: true, attributeFilter: ['class'] });
    }
};
