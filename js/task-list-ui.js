/**
 * 任务清单UI管理模块
 * 处理任务清单的显示和交互
 */

const TaskListUI = {
    /**
     * 初始化
     */
    init() {
        this.bindEvents();
        this.updateBadge();
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        // 清空全部按钮（需要家长验证）
        const clearAllBtn = document.getElementById('task-list-clear-all-btn');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.showDeleteConfirm(null, true); // true表示清空全部
            });
        }
        
        // 任务拆分弹窗相关事件
        const splitModal = document.getElementById('task-split-modal');
        if (splitModal) {
            const perTaskInput = document.getElementById('task-split-per-task');
            if (perTaskInput) {
                perTaskInput.addEventListener('input', () => {
                    this.updateSplitPreview();
                });
            }
            
            const confirmBtn = document.getElementById('task-split-confirm-btn');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', () => {
                    this.confirmSplitTask();
                });
            }
        }
    },
    
    /**
     * 渲染任务清单
     */
    render() {
        const container = document.getElementById('task-list-container');
        if (!container) return;
        
        const tasks = TaskList.getAllTasks();
        
        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-3">暂无任务</p>
                </div>
            `;
            return;
        }
        
        // 按状态分组
        const grouped = {
            [TaskList.STATUS.IN_PROGRESS]: [],
            [TaskList.STATUS.PENDING]: [],
            [TaskList.STATUS.PAUSED]: [],
            [TaskList.STATUS.COMPLETED]: []
        };
        
        tasks.forEach(task => {
            if (grouped[task.status]) {
                grouped[task.status].push(task);
            }
        });
        
        let html = '';
        
        // 进行中
        if (grouped[TaskList.STATUS.IN_PROGRESS].length > 0) {
            html += this.renderTaskGroup('进行中', grouped[TaskList.STATUS.IN_PROGRESS]);
        }
        
        // 待开始
        if (grouped[TaskList.STATUS.PENDING].length > 0) {
            html += this.renderTaskGroup('待开始', grouped[TaskList.STATUS.PENDING]);
        }
        
        // 已暂停
        if (grouped[TaskList.STATUS.PAUSED].length > 0) {
            html += this.renderTaskGroup('已暂停', grouped[TaskList.STATUS.PAUSED]);
        }
        
        // 已完成
        if (grouped[TaskList.STATUS.COMPLETED].length > 0) {
            html += this.renderTaskGroup('已完成', grouped[TaskList.STATUS.COMPLETED]);
        }
        
        container.innerHTML = html;
        
        // 绑定任务卡片事件
        this.bindTaskCardEvents();
    },
    
    /**
     * 渲染任务组
     */
    renderTaskGroup(title, tasks) {
        let html = `
            <div class="mb-4">
                <h6 class="text-muted mb-3">${title} (${tasks.length})</h6>
                <div class="row g-3">
        `;
        
        tasks.forEach(task => {
            html += this.renderTaskCard(task);
        });
        
        html += `
                </div>
            </div>
        `;
        
        return html;
    },
    
    /**
     * 渲染任务卡片
     */
    renderTaskCard(task) {
        const progress = task.progress || { total: 0, completed: 0, correct: 0 };
        const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        const statusBadge = this.getStatusBadge(task.status);
        const typeIcon = task.type === TaskList.TYPE.REVIEW ? 'bi-arrow-repeat' : 'bi-pencil-square';
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card task-card" data-task-id="${task.id}" style="cursor: pointer;" title="点击查看任务详情">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">
                                    <i class="bi ${typeIcon}"></i> ${this.escapeHtml(task.name)}
                                </h6>
                                <span class="badge ${statusBadge.class}">${statusBadge.text}</span>
                            </div>
                            <button class="btn btn-sm btn-outline-danger task-delete-btn" data-task-id="${task.id}" title="删除">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                        <div class="mt-2">
                            <div class="d-flex justify-content-between small text-muted mb-1">
                                <span>进度: ${progress.completed}/${progress.total}</span>
                                <span>${progressPercent}%</span>
                            </div>
                            <div class="progress" style="height: 6px;">
                                <div class="progress-bar" role="progressbar" style="width: ${progressPercent}%" 
                                     aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                            </div>
                        </div>
                        <div class="mt-3 d-flex gap-2">
                            ${task.status === TaskList.STATUS.PENDING || task.status === TaskList.STATUS.PAUSED ? `
                                <button class="btn btn-sm btn-primary flex-grow-1 task-start-btn" data-task-id="${task.id}">
                                    <i class="bi bi-play-fill"></i> ${task.status === TaskList.STATUS.PAUSED ? '继续' : '开始'}
                                </button>
                            ` : ''}
                            ${task.status === TaskList.STATUS.IN_PROGRESS ? `
                                <button class="btn btn-sm btn-primary flex-grow-1 task-continue-btn" data-task-id="${task.id}">
                                    <i class="bi bi-play-fill"></i> 继续
                                </button>
                            ` : ''}
                            ${task.status === TaskList.STATUS.COMPLETED ? `
                                <button class="btn btn-sm btn-outline-primary flex-grow-1 task-restart-btn" data-task-id="${task.id}">
                                    <i class="bi bi-arrow-clockwise"></i> 重新开始
                                </button>
                            ` : ''}
                        </div>
                        <div class="mt-2 small text-muted">
                            <div>创建: ${this.formatDate(task.createdAt)}</div>
                            ${task.updatedAt ? `<div>更新: ${this.formatDate(task.updatedAt)}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 获取状态徽章
     */
    getStatusBadge(status) {
        const badges = {
            [TaskList.STATUS.PENDING]: { class: 'bg-secondary', text: '待开始' },
            [TaskList.STATUS.IN_PROGRESS]: { class: 'bg-primary', text: '进行中' },
            [TaskList.STATUS.COMPLETED]: { class: 'bg-success', text: '已完成' },
            [TaskList.STATUS.PAUSED]: { class: 'bg-warning', text: '已暂停' }
        };
        return badges[status] || badges[TaskList.STATUS.PENDING];
    },
    
    /**
     * 绑定任务卡片事件
     */
    bindTaskCardEvents() {
        // 任务卡片点击事件（查看详情）
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是按钮，不触发卡片点击
                if (e.target.closest('button') || e.target.closest('a')) {
                    return;
                }
                const taskId = card.getAttribute('data-task-id');
                this.showTaskDetail(taskId);
            });
        });
        
        // 删除按钮（需要家长验证）
        document.querySelectorAll('.task-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = btn.getAttribute('data-task-id');
                this.showDeleteConfirm(taskId);
            });
        });
        
        // 开始/继续按钮
        document.querySelectorAll('.task-start-btn, .task-continue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = btn.getAttribute('data-task-id');
                this.startTask(taskId);
            });
        });
        
        // 重新开始按钮
        document.querySelectorAll('.task-restart-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = btn.getAttribute('data-task-id');
                if (confirm('确定要重新开始这个任务吗？进度将被重置。')) {
                    TaskList.updateTask(taskId, {
                        status: TaskList.STATUS.PENDING,
                        progress: {
                            total: TaskList.getTask(taskId).wordIds.length,
                            completed: 0,
                            correct: 0,
                            errors: []
                        }
                    });
                    this.render();
                    this.startTask(taskId);
                }
            });
        });
    },
    
    /**
     * 显示任务详情
     */
    showTaskDetail(taskId) {
        const task = TaskList.getTask(taskId);
        if (!task) {
            alert('任务不存在');
            return;
        }
        
        const modal = new bootstrap.Modal(document.getElementById('task-detail-modal'));
        const contentEl = document.getElementById('task-detail-content');
        
        // 显示加载中
        contentEl.innerHTML = '<div class="text-center text-muted py-3"><span class="spinner-border spinner-border-sm me-2"></span>加载中...</div>';
        modal.show();
        
        // 获取任务包含的题目
        const wordBank = Storage.getWordBank();
        const taskWords = wordBank.filter(w => task.wordIds.includes(w.id));
        
        // 按学期和单元分组
        const grouped = this.groupWordsBySemesterUnit(taskWords);
        const semesters = this.sortSemesters(Object.keys(grouped));
        
        // 获取字的掌握状态（用于显示完成率）
        const logs = (Storage.getPracticeLogsFiltered && Storage.getPracticeLogsFiltered()) || Storage.getPracticeLogs() || [];
        const errorWords = Storage.getErrorWordsFiltered() || [];
        const errorWordIds = new Set(errorWords.map(ew => ew.wordId));
        
        // 统计每个字的正确次数
        const wordCorrectCount = new Map();
        logs.forEach(log => {
            if (log.details && Array.isArray(log.details)) {
                log.details.forEach(detail => {
                    if (detail.correct) {
                        wordCorrectCount.set(detail.wordId, (wordCorrectCount.get(detail.wordId) || 0) + 1);
                    }
                });
            }
        });
        
        // 渲染详情内容（使用表格视图）
        let html = `
            <div class="mb-3">
                <h6>任务信息</h6>
                <div class="small text-muted">
                    <div>任务名称: <strong>${this.escapeHtml(task.name)}</strong></div>
                    <div>题目总数: ${task.progress.total}</div>
                    <div>已完成: ${task.progress.completed}</div>
                    <div>正确: ${task.progress.correct}</div>
                    <div>错误: ${task.progress.errors.length}</div>
                </div>
            </div>
            <hr>
            <h6 class="mb-3">题目列表</h6>
        `;
        
        if (semesters.length === 0) {
            html += '<div class="text-center text-muted py-3">暂无题目</div>';
        } else {
            // 按学期划分，每个学期一个表格
            semesters.forEach(semester => {
                const units = this.sortUnits(grouped[semester]);
                
                // 计算学期的完成率
                let semesterMasteredCount = 0;
                let semesterTotalCount = 0;
                units.forEach(unitKey => {
                    const words = grouped[semester][unitKey];
                    if (Array.isArray(words) && words.length > 0) {
                        semesterTotalCount += words.length;
                        words.forEach(w => {
                            const isError = errorWordIds.has(w.id);
                            const hasCorrect = wordCorrectCount.get(w.id) > 0;
                            const isMastered = hasCorrect && !isError;
                            if (isMastered) semesterMasteredCount++;
                        });
                    }
                });
                const semesterPieHtml = typeof PracticeRange !== 'undefined' && PracticeRange.generateCompletionPie 
                    ? PracticeRange.generateCompletionPie(semesterMasteredCount, semesterTotalCount)
                    : '';
                
                html += `
                    <div class="mb-4">
                        <div class="d-flex align-items-center mb-2">
                            <h6 class="mb-0 text-primary">${semester}</h6>
                            <span style="margin-left: 0.5rem; display: inline-flex; align-items: center;">${semesterPieHtml}</span>
                        </div>
                        <table class="table table-sm mb-0 practice-range-table">
                            <thead>
                                <tr>
                                    <th style="width: 130px;">单元</th>
                                    <th style="min-width: 300px;">汉字</th>
                                    <th style="width: 60px; text-align: center;">字数</th>
                                    <th style="width: 60px; text-align: center;">完成</th>
                                </tr>
                            </thead>
                            <tbody>
                `;
                
                units.forEach(unitKey => {
                    const words = grouped[semester][unitKey];
                    if (!Array.isArray(words) || words.length === 0) {
                        return;
                    }
                    const unitLabel = words.unitLabel || this.formatUnitLabel(unitKey);
                    
                    // 计算每个字的状态和完成率
                    let masteredCount = 0;
                    const wordTags = words.map(w => {
                        const isError = errorWordIds.has(w.id) || task.progress.errors.includes(w.id);
                        const hasCorrect = wordCorrectCount.get(w.id) > 0;
                        const isMastered = hasCorrect && !isError;
                        if (isMastered) masteredCount++;
                        
                        // 确定tag样式（优先级：已掌握 > 有错误 > 未测试）
                        let tagClass = 'word-tag-default';
                        if (isMastered) {
                            tagClass = 'word-tag-mastered';
                        } else if (isError) {
                            tagClass = 'word-tag-error';
                        }
                        
                        return `<span class="word-tag ${tagClass}">${w.word}</span>`;
                    }).join('');
                    
                    // 计算完成率并生成饼图
                    const completionRateHtml = typeof PracticeRange !== 'undefined' && PracticeRange.generateCompletionPie
                        ? PracticeRange.generateCompletionPie(masteredCount, words.length)
                        : '';
                    
                    html += `<tr class="unit-row" data-semester="${semester}" data-unit="${unitKey}">`;
                    html += `<td>${unitLabel}</td>`;
                    html += `<td class="word-tags-cell">${wordTags}</td>`;
                    html += `<td style="text-align: center;">${words.length}</td>`;
                    html += `<td style="text-align: center;">${completionRateHtml}</td>`;
                    html += `</tr>`;
                });
                
                html += `
                            </tbody>
                        </table>
                    </div>
                `;
            });
        }
        
        contentEl.innerHTML = html;
    },
    
    /**
     * 按学期和单元分组题目（复用PracticeRange的逻辑）
     */
    groupWordsBySemesterUnit(words) {
        if (typeof PracticeRange !== 'undefined' && PracticeRange.groupWordsBySemesterUnit) {
            return PracticeRange.groupWordsBySemesterUnit(words);
        }
        
        // 降级方案
        const grouped = {};
        words.forEach(word => {
            const gradeLabel = this.formatGradeLabel(word.grade);
            const semesterLabel = this.formatSemesterLabel(word.semester);
            const semesterKey = `${gradeLabel}${semesterLabel}`;
            const unitLabel = word.unitLabel || this.formatUnitLabel(word.unit);
            const unitKey = unitLabel || '未分类单元';
            
            if (!grouped[semesterKey]) grouped[semesterKey] = {};
            if (!grouped[semesterKey][unitKey]) {
                grouped[semesterKey][unitKey] = [];
            }
            grouped[semesterKey][unitKey].push(word);
        });
        return grouped;
    },
    
    /**
     * 排序学期（复用PracticeRange的逻辑）
     */
    sortSemesters(semesters) {
        if (typeof PracticeRange !== 'undefined' && PracticeRange.sortSemesters) {
            return PracticeRange.sortSemesters(semesters);
        }
        
        // 降级方案
        return semesters.sort((a, b) => {
            const gradeMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6 };
            const aMatch = a.match(/([一二三四五六])年级([上下])册/);
            const bMatch = b.match(/([一二三四五六])年级([上下])册/);
            
            if (!aMatch || !bMatch) return a.localeCompare(b);
            
            const aGrade = gradeMap[aMatch[1]] || 0;
            const bGrade = gradeMap[bMatch[1]] || 0;
            if (aGrade !== bGrade) return aGrade - bGrade;
            
            return aMatch[2] === '上' ? -1 : 1;
        });
    },
    
    /**
     * 排序单元
     */
    sortUnits(units) {
        // units是一个对象，key是unitKey，value是words数组
        return Object.keys(units).sort((a, b) => {
            const aWords = units[a];
            const bWords = units[b];
            const aOrder = aWords.order ?? 999;
            const bOrder = bWords.order ?? 999;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return a.localeCompare(b);
        });
    },
    
    /**
     * 格式化年级标签
     */
    formatGradeLabel(grade) {
        const map = { '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
        return map[grade] || grade;
    },
    
    /**
     * 格式化学期标签
     */
    formatSemesterLabel(semester) {
        return semester === '上' ? '年级上册' : '年级下册';
    },
    
    /**
     * 格式化单元标签
     */
    formatUnitLabel(unit) {
        if (typeof PracticeRange !== 'undefined' && PracticeRange.formatUnitLabel) {
            return PracticeRange.formatUnitLabel(unit);
        }
        // 降级方案
        const match = unit?.match(/(\d+)/);
        if (match) {
            return `第${match[1]}单元`;
        }
        return unit || '未分类';
    },
    
    /**
     * 开始任务
     */
    startTask(taskId) {
        const task = TaskList.getTask(taskId);
        if (!task) {
            alert('任务不存在');
            return;
        }
        
        // 更新任务状态
        if (task.status === TaskList.STATUS.PENDING || task.status === TaskList.STATUS.PAUSED) {
            TaskList.updateTask(taskId, {
                status: TaskList.STATUS.IN_PROGRESS
            });
        }
        
        // 跳转到练习页面并开始
        if (typeof Main !== 'undefined') {
            Main.showPage('practice');
        }
        
        // 设置任务ID到localStorage，让Practice模块知道这是从任务清单开始的
        localStorage.setItem('current_task_id', taskId);
        
        // 触发开始练习
        if (typeof Practice !== 'undefined') {
            Practice.start({ taskId: taskId });
        }
    },
    
    /**
     * 更新导航栏徽章
     */
    updateBadge() {
        const badge = document.getElementById('task-list-badge');
        if (!badge) return;
        
        const stats = TaskList.getStats();
        const total = stats.total;
        
        if (total > 0) {
            badge.textContent = total;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    },
    
    /**
     * 显示任务拆分弹窗
     */
    showSplitModal(wordIds, taskName) {
        console.log('[TaskListUI] showSplitModal called with:', { wordIdsCount: wordIds.length, taskName });
        const modal = new bootstrap.Modal(document.getElementById('task-split-modal'));
        const totalInput = document.getElementById('task-split-total');
        const perTaskInput = document.getElementById('task-split-per-task');
        const countInput = document.getElementById('task-split-count');
        const nameInput = document.getElementById('task-split-name');
        
        if (totalInput) totalInput.value = wordIds.length;
        if (perTaskInput) perTaskInput.value = 50;
        if (nameInput) {
            nameInput.value = taskName || '未命名任务';
            console.log('[TaskListUI] taskName set to:', taskName);
        }
        
        // 存储当前拆分数据（确保taskName不为空）
        this._splitData = { wordIds, taskName: taskName || '未命名任务' };
        console.log('[TaskListUI] _splitData:', this._splitData);
        
        this.updateSplitPreview();
        modal.show();
    },
    
    /**
     * 更新拆分预览
     */
    updateSplitPreview() {
        if (!this._splitData) return;
        
        const perTaskInput = document.getElementById('task-split-per-task');
        const countInput = document.getElementById('task-split-count');
        const previewList = document.getElementById('task-split-preview-list');
        
        if (!perTaskInput || !countInput || !previewList) return;
        
        const perTask = parseInt(perTaskInput.value) || 50;
        const { wordIds, taskName } = this._splitData;
        
        const tasks = TaskList.splitTask({
            wordIds,
            name: taskName,
            questionsPerTask: perTask
        });
        
        countInput.value = tasks.length;
        
        let html = '<div class="list-group list-group-flush">';
        tasks.forEach((task, index) => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${task.name}</strong>
                        <div class="small text-muted">${task.wordIds.length} 题</div>
                    </div>
                    <span class="badge bg-secondary">${index + 1}</span>
                </div>
            `;
        });
        html += '</div>';
        
        previewList.innerHTML = html;
    },
    
    /**
     * 确认拆分任务
     */
    confirmSplitTask() {
        if (!this._splitData) return;
        
        const perTaskInput = document.getElementById('task-split-per-task');
        const autoStartCheck = document.getElementById('task-split-auto-start');
        
        if (!perTaskInput) return;
        
        const perTask = parseInt(perTaskInput.value) || 50;
        const autoStart = autoStartCheck ? autoStartCheck.checked : false;
        
        const { wordIds, taskName } = this._splitData;
        
        const tasks = TaskList.splitTask({
            wordIds,
            name: taskName,
            questionsPerTask: perTask
        });
        
        let addedCount = 0;
        let duplicateCount = 0;
        let firstTaskId = null;
        
        tasks.forEach((task, index) => {
            const result = TaskList.addTask(task);
            if (result.success) {
                addedCount++;
                if (index === 0) {
                    firstTaskId = result.task.id;
                }
            } else {
                duplicateCount++;
            }
        });
        
        // 关闭弹窗
        const modal = bootstrap.Modal.getInstance(document.getElementById('task-split-modal'));
        if (modal) modal.hide();
        
        // 显示结果
        let message = `成功添加 ${addedCount} 个任务`;
        if (duplicateCount > 0) {
            message += `，${duplicateCount} 个任务已存在`;
        }
        
        // 如果开启了自动开始，且第一个任务成功添加
        if (autoStart && firstTaskId) {
            setTimeout(() => {
                this.startTask(firstTaskId);
            }, 500);
        }
        
        alert(message);
        
        // 刷新任务清单
        this.render();
        this.updateBadge();
        
        // 清除临时数据
        this._splitData = null;
    },
    
    /**
     * 格式化日期
     */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    /**
     * 检查家长验证是否在有效期内（5分钟）
     */
    isAdminVerified() {
        const verifiedTime = localStorage.getItem('admin_verified_time');
        if (!verifiedTime) return false;
        
        const now = Date.now();
        const elapsed = now - parseInt(verifiedTime);
        const fiveMinutes = 5 * 60 * 1000; // 5分钟（毫秒）
        
        return elapsed < fiveMinutes;
    },
    
    /**
     * 保存家长验证时间戳
     */
    saveAdminVerified() {
        localStorage.setItem('admin_verified_time', Date.now().toString());
    },
    
    /**
     * 显示删除确认（需要家长验证）
     * @param {string|null} taskId - 任务ID，如果为null且isClearAll为true，则清空全部
     * @param {boolean} isClearAll - 是否清空全部
     */
    showDeleteConfirm(taskId, isClearAll = false) {
        // 检查是否在5分钟内已验证过
        if (this.isAdminVerified()) {
            // 直接执行删除操作
            this.executeDelete(taskId, isClearAll);
            return;
        }
        
        // 需要重新验证
        const password = prompt('请输入管理员密码以确认删除：\n（输入英文字母Admin，区分大小写）');
        if (password === 'Admin') {
            // 保存验证时间戳
            this.saveAdminVerified();
            // 执行删除操作
            this.executeDelete(taskId, isClearAll);
        } else if (password !== null) {
            alert('密码错误，删除操作已取消。');
        }
    },
    
    /**
     * 执行删除操作
     */
    executeDelete(taskId, isClearAll) {
        if (isClearAll) {
            if (confirm('确定要清空所有任务吗？此操作不可恢复。')) {
                TaskList.clearAllTasks();
                this.render();
                this.updateBadge();
            }
        } else if (taskId) {
            if (confirm('确定要删除这个任务吗？')) {
                TaskList.deleteTask(taskId);
                this.render();
                this.updateBadge();
            }
        }
    },
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

