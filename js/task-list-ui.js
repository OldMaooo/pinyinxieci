/**
 * 任务清单UI管理模块
 * 处理任务清单的显示和交互
 */

const TaskListUI = {
    /**
     * 当前视图类型（日历/卡片）
     */
    currentViewType: 'cards', // 'calendar' | 'cards'
    
    /**
     * 是否处于批量操作模式
     */
    _isBatchMode: false,
    
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
        // 清空全部按钮（需要家长验证）- 使用克隆节点方式，避免重复绑定
        const clearAllBtn = document.getElementById('task-list-clear-all-btn');
        if (clearAllBtn) {
            const newClearAllBtn = clearAllBtn.cloneNode(true);
            clearAllBtn.parentNode.replaceChild(newClearAllBtn, clearAllBtn);
            newClearAllBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[TaskListUI] 清空全部按钮被点击');
                this.showDeleteConfirm(null, true); // true表示清空全部
            });
        }
        
        // 查看已完成按钮
        const viewCompletedBtn = document.getElementById('task-list-view-completed-btn');
        if (viewCompletedBtn) {
            viewCompletedBtn.addEventListener('click', () => {
                this.showCompletedTasks();
            });
        }
        
        // 批量操作模式按钮
        const batchModeBtn = document.getElementById('task-list-batch-mode-btn');
        if (batchModeBtn) {
            batchModeBtn.addEventListener('click', () => {
                this.toggleBatchMode();
            });
        }
        
        // 全选按钮
        const selectAllBtn = document.getElementById('task-list-select-all-btn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllTasks();
            });
        }
        
        // 取消全选按钮
        const deselectAllBtn = document.getElementById('task-list-deselect-all-btn');
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                this.deselectAllTasks();
            });
        }
        
        // 批量删除按钮
        const batchDeleteBtn = document.getElementById('task-list-batch-delete-btn');
        if (batchDeleteBtn) {
            batchDeleteBtn.addEventListener('click', () => {
                this.batchDeleteTasks();
            });
        }
        
        // 视图类型切换（日历/卡片）- 已移除，只使用卡片视图
        // document.querySelectorAll('input[name="task-view-type"]').forEach(radio => {
        //     radio.addEventListener('change', (e) => {
        //         this.currentViewType = e.target.value;
        //         this.updateViewTypeUI();
        //         this.load();
        //     });
        // });
        
        // 显示模式切换（合并/拆分）- 已移除
        
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
     * 更新视图类型UI（显示/隐藏相关控件）
     */
    updateViewTypeUI() {
        // 已移除显示模式切换，无需更新
    },
    
    /**
     * 加载任务清单（只使用卡片视图）
     * @param {boolean} skipAutoGenerate - 是否跳过自动生成复习任务（用于清空所有任务后避免立即重新生成）
     */
    load(skipAutoGenerate = false) {
        console.log('[TaskListUI.load] ===== 开始加载任务清单 =====');
        console.log('[TaskListUI.load] 显示已完成:', this._showingCompleted);
        console.log('[TaskListUI.load] 跳过自动生成:', skipAutoGenerate);
        
        // 确保自动生成复习任务（除非明确跳过）
        const allTasks = TaskList.getAllTasksWithAutoReview(30, skipAutoGenerate);
        console.log('[TaskListUI.load] 获取所有任务（含自动生成）:', allTasks.length);
        
        // 只使用卡片视图
        console.log('[TaskListUI.load] 渲染卡片视图...');
        this.renderCardsView();
        
        console.log('[TaskListUI.load] ===== 加载任务清单完成 =====');
    },
    
    /**
     * 渲染日历视图
     */
    renderCalendarView() {
        const calendarContainer = document.getElementById('task-calendar-container');
        const cardsContainer = document.getElementById('task-cards-container');
        if (!calendarContainer) {
            console.error('[TaskListUI] task-calendar-container not found');
            return;
        }
        
        // 隐藏卡片容器，显示日历容器
        if (cardsContainer) cardsContainer.classList.add('d-none');
        calendarContainer.classList.remove('d-none');
        
        const tasks = TaskList.getAllTasksWithAutoReview(30); // 生成30天的任务
        
        // 根据是否显示已完成来过滤任务
        const activeTasks = this._showingCompleted 
            ? tasks.filter(t => t.status === TaskList.STATUS.COMPLETED)
            : tasks.filter(t => t.status !== TaskList.STATUS.COMPLETED);
        
        // 渲染日历
        this.renderCalendar(calendarContainer, activeTasks);
        
        // 渲染待排期任务（只在显示进行中任务时显示）
        if (!this._showingCompleted) {
            this.renderInboxTasks(activeTasks, 'calendar');
        } else {
            // 隐藏待排期区域
            const inboxArea = document.getElementById('task-inbox-area-calendar');
            if (inboxArea) inboxArea.style.display = 'none';
        }
        
        // 绑定拖拽事件
        this.bindDragEvents();
    },
    
    /**
     * 格式化日期标签
     */
    formatDateLabel(date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = new Date(date);
        taskDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((taskDate - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '今天';
        } else if (diffDays === 1) {
            return '明天';
        } else if (diffDays === -1) {
            return '昨天';
        } else if (diffDays > 1 && diffDays <= 7) {
            return `${diffDays}天后`;
        } else if (diffDays < -1 && diffDays >= -7) {
            return `${Math.abs(diffDays)}天前`;
        } else {
            return date.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long'
            });
        }
    },
    
    /**
     * 渲染日历
     */
    renderCalendar(container, tasks) {
        const calendarArea = container.querySelector('#task-calendar-area');
        if (!calendarArea) return;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 获取当前月份的第一天和最后一天
        const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        // 按日期分组任务（区分练习任务和复习任务）
        const tasksByDate = {};
        tasks.forEach(task => {
            if (task.scheduledDate) {
                if (!tasksByDate[task.scheduledDate]) {
                    tasksByDate[task.scheduledDate] = {
                        practice: [],
                        review: []
                    };
                }
                if (task.type === TaskList.TYPE.REVIEW) {
                    tasksByDate[task.scheduledDate].review.push(task);
                } else {
                    tasksByDate[task.scheduledDate].practice.push(task);
                }
            }
        });
        
        // 生成日历HTML
        let html = `
            <div class="calendar-header mb-3">
                <h5 class="mb-0">${currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</h5>
            </div>
            <div class="calendar-grid">
                <div class="calendar-weekdays">
                    <div class="calendar-weekday">日</div>
                    <div class="calendar-weekday">一</div>
                    <div class="calendar-weekday">二</div>
                    <div class="calendar-weekday">三</div>
                    <div class="calendar-weekday">四</div>
                    <div class="calendar-weekday">五</div>
                    <div class="calendar-weekday">六</div>
                </div>
                <div class="calendar-days">
        `;
        
        // 获取第一天是星期几（0=周日）
        const firstDay = currentMonth.getDay();
        
        // 填充空白（上个月的日期）
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="calendar-day empty"></div>';
        }
        
        // 生成当前月的日期
        const daysInMonth = nextMonth.getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateTasks = tasksByDate[dateStr] || { practice: [], review: [] };
            const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
            const isToday = date.getTime() === today.getTime();
            
            html += `
                <div class="calendar-day ${isToday ? 'today' : ''}" 
                     data-date="${dateStr}" 
                     data-droppable="true">
                    <div class="calendar-day-number">${day}</div>
                    <div class="calendar-day-tasks">
            `;
            
            // 默认使用合并模式：一天只显示一张卡片（如果有多个任务，合并显示）
            const allTasks = [...dateTasks.practice, ...dateTasks.review];
            if (allTasks.length > 0) {
                html += this.renderCalendarTaskCardMerged(dateTasks.practice, dateTasks.review);
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        html += `
                </div>
            </div>
        `;
        
        calendarArea.innerHTML = html;
    },
    
    /**
     * 渲染日历中的任务卡片（简化版）
     * @param {Object} task - 任务对象
     * @param {boolean} draggable - 是否可拖拽（练习任务可拖拽，复习任务不可拖拽）
     */
    renderCalendarTaskCard(task, draggable = true) {
        const typeIcon = task.type === TaskList.TYPE.REVIEW ? 'bi-arrow-repeat' : 'bi-pencil-square';
        const typeClass = task.type === TaskList.TYPE.REVIEW ? 'review-task' : 'practice-task';
        const progress = task.progress || { total: 0, completed: 0 };
        const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        
        return `
            <div class="calendar-task-card ${typeClass}" 
                 data-task-id="${task.id}" 
                 data-task-type="${task.type}"
                 ${draggable ? 'draggable="true"' : ''}
                 title="${this.escapeHtml(task.name)}">
                <i class="bi ${typeIcon}"></i>
                <span class="calendar-task-name">${this.escapeHtml(task.name.length > 10 ? task.name.substring(0, 10) + '...' : task.name)}</span>
                <div class="calendar-task-progress">
                    <div class="progress" style="height: 3px;">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染合并模式的任务卡片（合并练习任务和复习任务）
     * @param {Array} practiceTasks - 练习任务列表
     * @param {Array} reviewTasks - 复习任务列表
     */
    renderCalendarTaskCardMerged(practiceTasks, reviewTasks) {
        const allTasks = [...practiceTasks, ...reviewTasks];
        if (allTasks.length === 0) return '';
        
        // 计算总进度
        let totalProgress = 0;
        let totalCompleted = 0;
        allTasks.forEach(task => {
            const progress = task.progress || { total: 0, completed: 0 };
            totalProgress += progress.total;
            totalCompleted += progress.completed;
        });
        const progressPercent = totalProgress > 0 ? Math.round((totalCompleted / totalProgress) * 100) : 0;
        
        // 生成任务名称（如果有多个任务，显示汇总信息）
        let taskName = '';
        if (practiceTasks.length > 0 && reviewTasks.length > 0) {
            taskName = `练习(${practiceTasks.length}) + 复习(${reviewTasks.length})`;
        } else if (practiceTasks.length > 0) {
            taskName = practiceTasks.length === 1 
                ? practiceTasks[0].name 
                : `练习任务(${practiceTasks.length})`;
        } else if (reviewTasks.length > 0) {
            taskName = reviewTasks.length === 1 
                ? reviewTasks[0].name 
                : `复习任务(${reviewTasks.length})`;
        }
        
        // 合并卡片可拖拽（如果包含练习任务）
        const isDraggable = practiceTasks.length > 0;
        const taskIds = allTasks.map(t => t.id).join(',');
        
        return `
            <div class="calendar-task-card merged-task" 
                 data-task-ids="${taskIds}"
                 data-has-practice="${practiceTasks.length > 0}"
                 ${isDraggable ? 'draggable="true"' : ''}
                 title="${this.escapeHtml(taskName)}">
                <i class="bi bi-layers"></i>
                <span class="calendar-task-name">${this.escapeHtml(taskName.length > 10 ? taskName.substring(0, 10) + '...' : taskName)}</span>
                <div class="calendar-task-progress">
                    <div class="progress" style="height: 3px;">
                        <div class="progress-bar" style="width: ${progressPercent}%"></div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染待排期任务（Inbox）
     * @param {Array} tasks - 所有任务
     * @param {string} viewType - 视图类型 'calendar' | 'cards'
     */
    renderInboxTasks(tasks, viewType = 'calendar') {
        const inboxListId = viewType === 'cards' ? 'task-inbox-list-cards' : 'task-inbox-list-calendar';
        const inboxAreaId = viewType === 'cards' ? 'task-inbox-area-cards' : 'task-inbox-area-calendar';
        
        const inboxList = document.getElementById(inboxListId);
        const inboxArea = document.getElementById(inboxAreaId);
        
        if (!inboxList || !inboxArea) return;
        
        const unscheduledTasks = tasks.filter(t => !t.scheduledDate);
        
        // 如果没有待排期任务，隐藏整个区域
        if (unscheduledTasks.length === 0) {
            inboxArea.style.display = 'none';
            return;
        }
        
        // 显示区域
        inboxArea.style.display = '';
        
        let html = '';
        unscheduledTasks.forEach(task => {
            html += `
                <div class="task-inbox-item mb-2" 
                     data-task-id="${task.id}">
                    ${this.renderTaskCard(task, true)}
                </div>
            `;
        });
        
        inboxList.innerHTML = html;
    },
    
    /**
     * 渲染卡片视图
     */
    renderCardsView() {
        console.log('[TaskListUI.renderCardsView] ===== 开始渲染卡片视图 =====');
        const calendarContainer = document.getElementById('task-calendar-container');
        const cardsContainer = document.getElementById('task-cards-container');
        
        if (!cardsContainer) {
            console.error('[TaskListUI.renderCardsView] ❌ task-cards-container 不存在');
            return;
        }
        console.log('[TaskListUI.renderCardsView] 容器元素找到');
        
        // 隐藏日历容器，显示卡片容器
        if (calendarContainer) calendarContainer.classList.add('d-none');
        cardsContainer.classList.remove('d-none');
        
        const tasks = TaskList.getAllTasksWithAutoReview(30);
        console.log('[TaskListUI.renderCardsView] 获取所有任务:', tasks.length);
        
        // 根据是否显示已完成来过滤任务
        const activeTasks = this._showingCompleted 
            ? tasks.filter(t => t.status === TaskList.STATUS.COMPLETED)
            : tasks.filter(t => t.status !== TaskList.STATUS.COMPLETED);
        console.log('[TaskListUI.renderCardsView] 活跃任务数:', activeTasks.length);
        console.log('[TaskListUI.renderCardsView] 任务列表:', activeTasks.map(t => ({ id: t.id, name: t.name, status: t.status, scheduledDate: t.scheduledDate })));
        
        // 渲染卡片
        console.log('[TaskListUI.renderCardsView] 开始渲染卡片...');
        this.renderCards(cardsContainer, activeTasks);
        console.log('[TaskListUI.renderCardsView] 卡片渲染完成');
        
        // 渲染待排期任务（只在显示进行中任务时显示）
        if (!this._showingCompleted) {
            console.log('[TaskListUI.renderCardsView] 开始渲染待排期任务...');
            this.renderInboxTasks(activeTasks, 'cards');
            console.log('[TaskListUI.renderCardsView] 待排期任务渲染完成');
        } else {
            // 隐藏待排期区域
            const inboxArea = document.getElementById('task-inbox-area-cards');
            if (inboxArea) inboxArea.style.display = 'none';
        }
        
        // 绑定所有事件（包括待排期卡片的日期选择按钮）
        console.log('[TaskListUI.renderCardsView] 绑定事件...');
        this.bindTaskCardEvents();
        // 更新批量操作模式的UI显示
        this.updateBatchModeUI();
        console.log('[TaskListUI.renderCardsView] 事件绑定完成');
        
        // 绑定拖拽事件
        this.bindDragEvents();
        console.log('[TaskListUI.renderCardsView] ===== 渲染卡片视图完成 =====');
    },
    
    /**
     * 渲染卡片列表
     */
    renderCards(container, tasks) {
        const cardsArea = container.querySelector('#task-cards-area');
        if (!cardsArea) return;
        
        // 如果显示已完成任务，直接显示所有已完成任务
        if (this._showingCompleted) {
            const completedTasks = tasks.filter(t => t.status === TaskList.STATUS.COMPLETED);
            
            if (completedTasks.length === 0) {
                cardsArea.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="bi bi-check-circle" style="font-size: 3rem;"></i>
                        <p class="mt-3">暂无已完成任务</p>
                    </div>
                `;
                return;
            }
            
            // 按完成时间排序（最新的在前）
            completedTasks.sort((a, b) => {
                const dateA = new Date(a.updatedAt || a.createdAt || 0);
                const dateB = new Date(b.updatedAt || b.createdAt || 0);
                return dateB - dateA;
            });
            
            let html = '<div class="task-cards-grid">';
            completedTasks.forEach(task => {
                html += `
                    <div class="task-card-item" data-task-id="${task.id}">
                        ${this.renderTaskCardForCardsView(task, true)}
                    </div>
                `;
            });
            html += '</div>';
            cardsArea.innerHTML = html;
            return;
        }
        
        // 显示进行中的任务：只显示已排期的任务
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const scheduledTasks = tasks.filter(t => t.scheduledDate).sort((a, b) => {
            const dateA = new Date(a.scheduledDate + 'T00:00:00');
            const dateB = new Date(b.scheduledDate + 'T00:00:00');
            return dateA - dateB;
        });
        
        if (scheduledTasks.length === 0) {
            cardsArea.innerHTML = `
                <div class="text-center text-muted py-5">
                    <i class="bi bi-inbox" style="font-size: 3rem;"></i>
                    <p class="mt-3">暂无已排期任务</p>
                </div>
            `;
            return;
        }
        
        // 分离今天的任务和未来的任务（过期任务也算到今日任务中）
        const todayTasks = [];
        const futureTasks = [];
        
        scheduledTasks.forEach(task => {
            const taskDate = new Date(task.scheduledDate + 'T00:00:00');
            // 今天或今天之前的任务都算到今日任务中
            if (taskDate.getTime() <= today.getTime()) {
                todayTasks.push(task);
            } else {
                futureTasks.push(task);
            }
        });
        
        let html = '<div class="task-cards-grid">';
        
        // 今天任务区域
        if (todayTasks.length > 0) {
            html += `
                <div class="task-cards-section-header">
                    <h5 class="mb-0 text-primary">
                        <i class="bi bi-calendar-check"></i> 今天
                    </h5>
                </div>
            `;
            todayTasks.forEach(task => {
                html += `
                    <div class="task-card-item" data-task-id="${task.id}" data-date="${task.scheduledDate}">
                        ${this.renderTaskCardForCardsView(task, true)}
                    </div>
                `;
            });
        }
        
        // 未来任务区域
        if (futureTasks.length > 0) {
            html += `
                <div class="task-cards-section-header">
                    <h5 class="mb-0 text-primary">
                        <i class="bi bi-calendar-event"></i> 未来任务
                    </h5>
                </div>
            `;
            futureTasks.forEach(task => {
                html += `
                    <div class="task-card-item" data-task-id="${task.id}" data-date="${task.scheduledDate}">
                        ${this.renderTaskCardForCardsView(task, true)}
                    </div>
                `;
            });
        }
        
        html += '</div>';
        cardsArea.innerHTML = html;
        
        // 绑定任务卡片事件
        this.bindTaskCardEvents();
        // 更新批量操作模式的UI显示
        this.updateBatchModeUI();
        
        // 绑定卡片视图中的任务卡片点击事件
        document.querySelectorAll('.task-card-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // 如果点击的是按钮或输入框，不触发卡片点击
                if (e.target.closest('button') || 
                    e.target.closest('input') ||
                    e.target.closest('.task-schedule-date-input')) {
                    return;
                }
                const taskId = item.getAttribute('data-task-id');
                if (taskId) {
                    this.showTaskDetail(taskId);
                }
            });
        });
    },
    
    /**
     * 获取相对时间标签
     */
    getRelativeTimeLabel(date, today) {
        const diffDays = Math.floor((date - today) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            return '今天';
        } else if (diffDays === 1) {
            return '明天';
        } else if (diffDays === -1) {
            return '昨天';
        } else if (diffDays > 1 && diffDays <= 7) {
            return `${diffDays}天后`;
        } else if (diffDays < -1 && diffDays >= -7) {
            return `${Math.abs(diffDays)}天前`;
        } else if (diffDays > 7 && diffDays <= 30) {
            const weeks = Math.floor(diffDays / 7);
            return `${weeks}周后`;
        } else if (diffDays > 30) {
            const months = Math.floor(diffDays / 30);
            return `${months}个月后`;
        } else if (diffDays < -7 && diffDays >= -30) {
            const weeks = Math.floor(Math.abs(diffDays) / 7);
            return `${weeks}周前`;
        } else {
            const months = Math.floor(Math.abs(diffDays) / 30);
            return `${months}个月前`;
        }
    },
    
    /**
     * 渲染卡片视图中的任务卡片
     * @param {Object} task - 任务对象
     * @param {boolean} noCardWrapper - 是否不包含外层card（用于卡片视图）
     */
    renderTaskCardForCardsView(task, noCardWrapper = false) {
        const progress = task.progress || { total: 0, completed: 0, correct: 0 };
        const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        const typeIcon = task.type === TaskList.TYPE.REVIEW ? 'bi-arrow-repeat' : 'bi-pencil-square';
        const typeClass = task.type === TaskList.TYPE.REVIEW ? 'review-task' : 'practice-task';
        
        // 格式化日期显示
        const scheduledDate = task.scheduledDate;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = scheduledDate ? new Date(scheduledDate + 'T00:00:00') : null;
        const isToday = taskDate && taskDate.getTime() === today.getTime();
        
        // 日期显示：如果是今天，显示"今天"，否则显示完整日期
        const dateDisplay = scheduledDate 
            ? (isToday 
                ? '今天' 
                : taskDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }))
            : '待排期';
        
        // 只有练习任务可以修改日期
        const canSchedule = task.type === TaskList.TYPE.PRACTICE;
        // 根据任务类型显示不同的标签
        const dateLabel = task.type === TaskList.TYPE.REVIEW ? '复习日期：' : '练习日期：';
        
        // 进度条颜色：100%为绿色，其他为默认蓝色
        const progressBarClass = progressPercent === 100 ? 'bg-success' : '';
        
        const cardWrapper = noCardWrapper ? '' : '<div class="card task-card ' + typeClass + '" style="cursor: pointer;" title="点击查看任务详情"><div class="card-body">';
        const cardWrapperEnd = noCardWrapper ? '' : '</div></div>';
        
        return `
            ${cardWrapper}
            <div class="position-relative mb-2">
                <div class="d-flex align-items-center gap-2">
                    <input type="checkbox" class="form-check-input task-select-checkbox" 
                           data-task-id="${task.id}" 
                           style="flex-shrink: 0; ${this._isBatchMode ? 'display: block;' : 'display: none;'}"
                           id="task-checkbox-${task.id}">
                    <h6 class="card-title mb-1 flex-grow-1">
                        <i class="bi ${typeIcon}"></i> ${this.escapeHtml(task.name)}
                    </h6>
                    <button class="btn btn-sm btn-outline-danger task-delete-btn" 
                            data-task-id="${task.id}" 
                            title="删除"
                            style="z-index: 10; ${this._isBatchMode ? 'display: none;' : 'display: block;'}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
            <div class="mb-2 d-flex align-items-center gap-2">
                <label class="small text-muted mb-0" style="min-width: 70px;">${dateLabel}</label>
                ${task.status === TaskList.STATUS.COMPLETED ? `
                <span class="small text-muted">${this.escapeHtml(dateDisplay)}</span>
                ` : canSchedule ? `
                <input type="date" 
                       class="form-control form-control-sm task-schedule-date-input" 
                       data-task-id="${task.id}" 
                       value="${task.scheduledDate || ''}"
                       title="选择日期">
                ` : `
                <span class="small text-muted">${this.escapeHtml(dateDisplay)}</span>
                `}
            </div>
            ${task.status === TaskList.STATUS.COMPLETED ? `
            <div class="mt-2">
                ${(() => {
                    const score = progress.total > 0 ? Math.round((progress.correct / progress.total) * 100) : 0;
                    const errorCount = progress.total - progress.correct;
                    return `
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <span class="small text-muted">分数: <strong class="text-primary">${score}</strong></span>
                        <span class="small text-muted">对: <strong class="text-success">${progress.correct}</strong> 错: <strong class="text-danger">${errorCount}</strong></span>
                    </div>
                    `;
                })()}
            </div>
            ` : `
            <div class="mt-2">
                <div class="d-flex justify-content-between small text-muted mb-1">
                    <span>进度: ${progress.completed}/${progress.total}</span>
                    <span>${progressPercent}%</span>
                </div>
                <div class="progress" style="height: 6px;">
                    <div class="progress-bar ${progressBarClass}" role="progressbar" style="width: ${progressPercent}%" 
                         aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                </div>
            </div>
            `}
            <div class="mt-3 d-flex gap-2">
                ${task.status === TaskList.STATUS.PENDING || task.status === TaskList.STATUS.PAUSED ? `
                    <button class="btn btn-sm btn-primary task-start-btn" data-task-id="${task.id}">
                        <i class="bi bi-play-fill"></i> ${task.status === TaskList.STATUS.PAUSED ? '继续' : '开始'}
                    </button>
                ` : ''}
                ${task.status === TaskList.STATUS.IN_PROGRESS ? `
                    <button class="btn btn-sm btn-primary task-continue-btn" data-task-id="${task.id}">
                        <i class="bi bi-play-fill"></i> 继续
                    </button>
                ` : ''}
                ${task.status === TaskList.STATUS.COMPLETED ? `
                    <button class="btn btn-sm btn-outline-primary task-restart-btn" data-task-id="${task.id}">
                        <i class="bi bi-arrow-clockwise"></i> 重新开始
                    </button>
                ` : ''}
            </div>
            ${cardWrapperEnd}
        `;
    },
    
    /**
     * 绑定拖拽事件
     */
    bindDragEvents() {
        // 待排期任务拖拽 - 已禁用，确保日期选择按钮可以正常点击
        // document.querySelectorAll('.task-inbox-item').forEach(item => {
        //     item.addEventListener('dragstart', (e) => {
        //         e.dataTransfer.effectAllowed = 'move';
        //         const taskId = item.getAttribute('data-task-id');
        //         e.dataTransfer.setData('text/plain', taskId);
        //         e.dataTransfer.setData('source', 'inbox');
        //         item.classList.add('dragging');
        //     });
        //     
        //     item.addEventListener('dragend', (e) => {
        //         item.classList.remove('dragging');
        //     });
        // });
        
        // 日历中的任务卡片拖拽（只有练习任务可拖拽）
        document.querySelectorAll('.calendar-task-card[draggable="true"]').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                // 检查是否是合并模式的任务卡片
                const taskIds = item.getAttribute('data-task-ids');
                const hasPractice = item.getAttribute('data-has-practice') === 'true';
                const taskType = item.getAttribute('data-task-type');
                
                // 只有练习任务或包含练习任务的合并卡片才能拖拽
                if (taskType === TaskList.TYPE.PRACTICE || (taskIds && hasPractice)) {
                    e.dataTransfer.effectAllowed = 'move';
                    const taskId = item.getAttribute('data-task-id') || (taskIds ? taskIds.split(',')[0] : null);
                    e.dataTransfer.setData('text/plain', taskId);
                    e.dataTransfer.setData('source', 'calendar');
                    e.dataTransfer.setData('task-ids', taskIds || taskId);
                    item.classList.add('dragging');
                } else {
                    // 复习任务不可拖拽
                    e.preventDefault();
                }
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });
        
        // 卡片视图中的任务卡片拖拽（只有练习任务可拖拽）
        document.querySelectorAll('.task-card-item .task-card.practice-task').forEach(item => {
            const cardItem = item.closest('.task-card-item');
            if (!cardItem) return;
            
            cardItem.setAttribute('draggable', 'true');
            cardItem.style.cursor = 'move';
            
            cardItem.addEventListener('dragstart', (e) => {
                const taskId = cardItem.getAttribute('data-task-id');
                const task = TaskList.getTask(taskId);
                
                // 只有练习任务可拖拽
                if (task && task.type === TaskList.TYPE.PRACTICE) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', taskId);
                    e.dataTransfer.setData('source', 'cards');
                    cardItem.classList.add('dragging');
                } else {
                    e.preventDefault();
                }
            });
            
            cardItem.addEventListener('dragend', (e) => {
                cardItem.classList.remove('dragging');
            });
        });
        
        // 日历日期拖放
        document.querySelectorAll('.calendar-day[data-droppable="true"]').forEach(day => {
            day.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                day.classList.add('drag-over');
            });
            
            day.addEventListener('dragleave', (e) => {
                day.classList.remove('drag-over');
            });
            
            day.addEventListener('drop', (e) => {
                e.preventDefault();
                day.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                const source = e.dataTransfer.getData('source');
                const taskIds = e.dataTransfer.getData('task-ids');
                const targetDate = day.getAttribute('data-date');
                
                if (taskId && targetDate) {
                    // 如果是合并模式的任务卡片，需要处理多个任务ID
                    if (taskIds && taskIds.includes(',')) {
                        const ids = taskIds.split(',');
                        // 只移动练习任务
                        ids.forEach(id => {
                            const task = TaskList.getTask(id);
                            if (task && task.type === TaskList.TYPE.PRACTICE) {
                                this.scheduleTask(id, targetDate);
                            }
                        });
                    } else {
                        this.scheduleTask(taskId, targetDate);
                    }
                    
                    // 重新渲染
                    setTimeout(() => {
                        this.load();
                    }, 100);
                }
            });
        });
        
        // 卡片视图中的日期区域拖放（可以拖到其他卡片上更改日期）
        document.querySelectorAll('.task-card-item').forEach(cardItem => {
            cardItem.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                cardItem.classList.add('drag-over');
            });
            
            cardItem.addEventListener('dragleave', (e) => {
                cardItem.classList.remove('drag-over');
            });
            
            cardItem.addEventListener('drop', (e) => {
                e.preventDefault();
                cardItem.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                const source = e.dataTransfer.getData('source');
                const targetDate = cardItem.getAttribute('data-date');
                
                if (taskId && targetDate && source !== 'cards') {
                    // 从待排期或其他地方拖过来的任务，排期到目标日期
                    const task = TaskList.getTask(taskId);
                    if (task && task.type === TaskList.TYPE.PRACTICE) {
                        this.scheduleTask(taskId, targetDate);
                    }
                    
                    // 重新渲染
                    setTimeout(() => {
                        this.load();
                    }, 100);
                }
            });
        });
        
        // 待排期区域作为拖放目标（可以从外面拖到待排期）
        document.querySelectorAll('.task-inbox-list').forEach(inboxList => {
            inboxList.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                inboxList.classList.add('drag-over');
            });
            
            inboxList.addEventListener('dragleave', (e) => {
                inboxList.classList.remove('drag-over');
            });
            
            inboxList.addEventListener('drop', (e) => {
                e.preventDefault();
                inboxList.classList.remove('drag-over');
                
                const taskId = e.dataTransfer.getData('text/plain');
                const source = e.dataTransfer.getData('source');
                
                if (taskId && source !== 'inbox') {
                    // 从外面拖到待排期，取消排期
                    const task = TaskList.getTask(taskId);
                    if (task && task.type === TaskList.TYPE.PRACTICE) {
                        TaskList.updateTask(taskId, {
                            scheduledDate: null
                        });
                        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                            WordBank.showToast('success', '已移动到待排期');
                        }
                        
                        // 重新渲染
                        setTimeout(() => {
                            this.load();
                        }, 100);
                    }
                }
            });
        });
    },
    
    /**
     * 将任务排期到指定日期
     */
    scheduleTask(taskId, dateStr) {
        const task = TaskList.getTask(taskId);
        if (!task) return;
        
        TaskList.updateTask(taskId, {
            scheduledDate: dateStr
        });
        
        // 重新渲染
        this.load();
        
        if (typeof WordBank !== 'undefined' && WordBank.showToast) {
            WordBank.showToast('success', '任务已排期');
        }
    },
    
    /**
     * 渲染任务清单（保持向后兼容）
     */
    render() {
        this.load();
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
     * @param {Object} task - 任务对象
     * @param {boolean} inInbox - 是否在待排期区域（true时卡片宽度100%，不包含col类）
     */
    renderTaskCard(task, inInbox = false) {
        const progress = task.progress || { total: 0, completed: 0, correct: 0 };
        const progressPercent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
        const typeIcon = task.type === TaskList.TYPE.REVIEW ? 'bi-arrow-repeat' : 'bi-pencil-square';
        
        // 格式化日期显示
        const scheduledDate = task.scheduledDate;
        const dateDisplay = scheduledDate 
            ? new Date(scheduledDate + 'T00:00:00').toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
            : '待排期';
        
        // 进度条颜色：100%为绿色，其他为默认蓝色
        const progressBarClass = progressPercent === 100 ? 'bg-success' : '';
        
        const cardWrapper = inInbox ? '' : '<div class="col-md-6 col-lg-4">';
        const cardWrapperEnd = inInbox ? '' : '</div>';
        
        return `
            ${cardWrapper}
            <div class="card task-card" data-task-id="${task.id}" style="cursor: pointer; ${inInbox ? 'width: 100%; max-width: 350px;' : ''}" title="点击查看任务详情">
                <div class="card-body">
                    <div class="position-relative mb-2">
                        <div class="d-flex align-items-center gap-2">
                            <input type="checkbox" class="form-check-input task-select-checkbox" 
                                   data-task-id="${task.id}" 
                                   style="flex-shrink: 0; ${this._isBatchMode ? 'display: block;' : 'display: none;'}"
                                   id="task-checkbox-${task.id}">
                            <h6 class="card-title mb-1 flex-grow-1">
                                <i class="bi ${typeIcon}"></i> ${this.escapeHtml(task.name)}
                            </h6>
                            <button class="btn btn-sm btn-outline-danger task-delete-btn" 
                                    data-task-id="${task.id}" 
                                    title="删除"
                                    style="z-index: 10; ${this._isBatchMode ? 'display: none;' : 'display: block;'}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                    ${inInbox ? `
                    <div class="mb-2 d-flex align-items-center gap-2">
                        <label class="small text-muted mb-0" style="min-width: 70px;">${task.type === TaskList.TYPE.REVIEW ? '复习日期：' : '练习日期：'}</label>
                        ${task.type === TaskList.TYPE.PRACTICE ? `
                        <input type="date" 
                               class="form-control form-control-sm task-schedule-date-input" 
                               data-task-id="${task.id}" 
                               value="${task.scheduledDate || ''}"
                               title="选择日期">
                        ` : `
                        <span class="small text-muted">${this.escapeHtml(dateDisplay)}</span>
                        `}
                    </div>
                    ` : ''}
                    <div class="mt-2">
                        <div class="d-flex justify-content-between small text-muted mb-1">
                            <span>进度: ${progress.completed}/${progress.total}</span>
                            <span>${progressPercent}%</span>
                        </div>
                        <div class="progress" style="height: 6px;">
                            <div class="progress-bar ${progressBarClass}" role="progressbar" style="width: ${progressPercent}%" 
                                 aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                    </div>
                        <div class="mt-3 d-flex gap-2">
                            ${task.status === TaskList.STATUS.PENDING || task.status === TaskList.STATUS.PAUSED ? `
                                ${this.isTaskReady(task) ? `
                                    <button class="btn btn-sm btn-primary task-start-btn" data-task-id="${task.id}">
                                        <i class="bi bi-play-fill"></i> ${task.status === TaskList.STATUS.PAUSED ? '继续' : '开始'}
                                    </button>
                                ` : `
                                    <button class="btn btn-sm btn-secondary task-start-btn" data-task-id="${task.id}" disabled title="任务未到时间，无法开始">
                                        <i class="bi bi-play-fill"></i> ${task.status === TaskList.STATUS.PAUSED ? '继续' : '开始'}
                                    </button>
                                `}
                            ` : ''}
                            ${task.status === TaskList.STATUS.IN_PROGRESS ? `
                                <button class="btn btn-sm btn-primary task-continue-btn" data-task-id="${task.id}">
                                    <i class="bi bi-play-fill"></i> 继续
                                </button>
                            ` : ''}
                            ${task.status === TaskList.STATUS.COMPLETED ? `
                                <button class="btn btn-sm btn-outline-primary task-restart-btn" data-task-id="${task.id}">
                                    <i class="bi bi-arrow-clockwise"></i> 重新开始
                                </button>
                            ` : ''}
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
     * 检查任务是否已到时间（包括复习任务和练习任务）
     */
    isTaskReady(task) {
        // 如果没有scheduledDate，始终可用
        if (!task.scheduledDate) {
            return true;
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const scheduledDate = new Date(task.scheduledDate + 'T00:00:00');
        scheduledDate.setHours(0, 0, 0, 0);
        
        // 如果任务日期在今天或之前，则可以开始
        return scheduledDate <= today;
    },
    
    /**
     * 绑定任务卡片事件
     */
    bindTaskCardEvents() {
        // 任务卡片点击事件（查看详情）
        document.querySelectorAll('.task-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // 如果点击的是按钮、链接或输入框，不触发卡片点击
                if (e.target.closest('button') || 
                    e.target.closest('a') || 
                    e.target.closest('input') ||
                    e.target.closest('.task-schedule-date-input')) {
                    return;
                }
                const taskId = card.getAttribute('data-task-id');
                this.showTaskDetail(taskId);
            });
        });
        
        // 删除按钮（需要家长验证）- 直接绑定，避免事件委托的问题
        document.querySelectorAll('.task-delete-btn').forEach(btn => {
            // 先移除可能存在的旧监听器（通过克隆节点）
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            // 使用箭头函数确保 this 上下文正确
            const self = this;
            newBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                e.stopImmediatePropagation(); // 阻止其他事件处理器
                const taskId = this.getAttribute('data-task-id');
                console.log('[TaskListUI.bindTaskCardEvents] 删除按钮被点击', {
                    taskId: taskId,
                    button: this,
                    event: e
                });
                if (taskId) {
                    self.showDeleteConfirm(taskId);
                } else {
                    console.error('[TaskListUI.bindTaskCardEvents] 删除按钮没有 taskId 属性', this);
                }
            });
        });
        
        // 批量选择复选框事件
        document.querySelectorAll('.task-select-checkbox').forEach(checkbox => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            newCheckbox.addEventListener('change', () => {
                this.updateSelectedCount();
            });
            
            // 阻止点击复选框时触发卡片点击事件
            newCheckbox.addEventListener('click', (e) => {
                e.stopPropagation();
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
        
        // 日期选择输入框（卡片视图和待排期区域）
        document.querySelectorAll('.task-schedule-date-input').forEach(input => {
            // 阻止点击事件冒泡，避免触发任务详情弹窗
            input.addEventListener('click', (e) => {
                e.stopPropagation();
            });
            
            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });
            
            input.addEventListener('change', (e) => {
                e.stopPropagation();
                const taskId = input.getAttribute('data-task-id');
                const selectedDate = input.value;
                
                if (selectedDate) {
                    TaskList.updateTask(taskId, {
                        scheduledDate: selectedDate
                    });
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('success', '已设置排期日期');
                    }
                } else {
                    TaskList.updateTask(taskId, {
                        scheduledDate: null
                    });
                    if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                        WordBank.showToast('success', '已取消排期');
                    }
                }
                
                // 重新渲染
                setTimeout(() => {
                    this.load();
                }, 100);
            });
        });
    },
    
    /**
     * 显示日期选择器
     */
    showDatePicker(taskId) {
        const task = TaskList.getTask(taskId);
        if (!task) return;
        
        // 只有练习任务可以排期
        if (task.type !== TaskList.TYPE.PRACTICE) {
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('warning', '复习任务不能排期');
            }
            return;
        }
        
        // 创建或获取模态框
        const modalId = 'date-picker-modal';
        let modalEl = document.getElementById(modalId);
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = modalId;
            modalEl.className = 'modal fade';
            modalEl.innerHTML = `
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">选择日期</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="date-picker-input" class="form-label">选择日期：</label>
                                <input type="date" class="form-control" id="date-picker-input">
                            </div>
                            <div class="d-flex gap-2">
                                <button type="button" class="btn btn-secondary flex-grow-1" id="date-picker-cancel-btn">取消排期</button>
                                <button type="button" class="btn btn-primary flex-grow-1" id="date-picker-confirm-btn">确认</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modalEl);
        }
        
        const inputEl = document.getElementById('date-picker-input');
        const confirmBtn = document.getElementById('date-picker-confirm-btn');
        const cancelBtn = document.getElementById('date-picker-cancel-btn');
        
        // 设置当前日期（如果有排期日期则使用，否则留空，不自动设置今天）
        const currentDate = task.scheduledDate || '';
        inputEl.value = currentDate;
        
        // 防止iPad上自动选择日期：禁用input的自动行为
        inputEl.setAttribute('readonly', 'readonly');
        inputEl.addEventListener('focus', (e) => {
            e.target.removeAttribute('readonly');
        });
        inputEl.addEventListener('blur', (e) => {
            e.target.setAttribute('readonly', 'readonly');
        });
        
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
        
        // 移除旧的事件监听器（通过克隆节点）
        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        // 确认按钮
        newConfirmBtn.addEventListener('click', () => {
            const selectedDate = inputEl.value;
            if (selectedDate) {
                TaskList.updateTask(taskId, {
                    scheduledDate: selectedDate
                });
                if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                    WordBank.showToast('success', '已设置排期日期');
                }
            }
            modal.hide();
            this.load();
        });
        
        // 取消排期按钮（还原）
        newCancelBtn.addEventListener('click', () => {
            // 清空日期输入框
            inputEl.value = '';
            // 更新任务，清空排期日期
            TaskList.updateTask(taskId, {
                scheduledDate: null
            });
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('success', '已取消排期');
            }
            modal.hide();
            this.load();
        });
        
        // Enter键确认
        inputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                newConfirmBtn.click();
            }
        });
        
        // 模态框关闭时聚焦输入框（但保持readonly，防止自动选择）
        modalEl.addEventListener('shown.bs.modal', () => {
            // 不自动聚焦，避免iPad上自动选择日期
            // inputEl.focus();
        });
    },
    
    /**
     * 显示已完成任务（切换视图显示已完成任务）
     */
    showCompletedTasks() {
        // 切换视图状态
        this._showingCompleted = !this._showingCompleted;
        
        // 重新加载视图
        this.load();
        
        // 更新按钮文本
        const btn = document.getElementById('task-list-view-completed-btn');
        if (btn) {
            if (this._showingCompleted) {
                btn.innerHTML = '<i class="bi bi-list-check"></i> 查看进行中';
                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-secondary');
            } else {
                btn.innerHTML = '<i class="bi bi-check-circle"></i> 查看已完成';
                btn.classList.remove('btn-secondary');
                btn.classList.add('btn-outline-secondary');
            }
        }
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
        const modalEl = document.getElementById('task-detail-modal');
        const titleEl = document.getElementById('task-detail-title');
        const contentEl = document.getElementById('task-detail-content');
        
        // 设置弹窗标题为任务名称
        if (titleEl) {
            titleEl.textContent = task.name;
        }
        
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
                <div class="d-flex justify-content-between align-items-center flex-wrap gap-2 small">
                    <div><span class="text-muted">题目总数:</span> <strong>${task.progress.total}</strong></div>
                    <div><span class="text-muted">已完成:</span> <strong>${task.progress.completed}</strong></div>
                    <div><span class="text-muted">正确:</span> <strong class="text-success">${task.progress.correct}</strong></div>
                    <div><span class="text-muted">错误:</span> <strong class="text-danger">${task.progress.errors.length}</strong></div>
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
        
        // 设置任务ID到localStorage，让Practice模块知道这是从任务清单开始的
        localStorage.setItem('current_task_id', taskId);
        
        // 授权进入练习页面
        if (typeof Practice !== 'undefined' && Practice.allowPracticePageOnce) {
            Practice.allowPracticePageOnce();
        }
        
        // 直接调用Main.showPage，它会处理授权检查和页面切换
        // Main.showPage已经改进了逻辑，可以处理hashchange重复触发的情况
        if (typeof Main !== 'undefined') {
            Main.showPage('practice');
        }
        
        // 等待页面切换完成后再开始练习
        // 使用轮询检查practice页面是否已显示，确保DOM元素已准备好
        let checkCount = 0;
        const maxChecks = 40; // 最多检查2秒（40 * 50ms）
        const checkAndStart = () => {
            checkCount++;
            const practicePage = document.getElementById('practice');
            const practiceArea = document.getElementById('practice-area');
            console.log(`[TaskListUI.startTask] 检查页面就绪 (${checkCount}/${maxChecks}):`, {
                practicePageExists: !!practicePage,
                practicePageVisible: practicePage ? !practicePage.classList.contains('d-none') : false,
                practiceAreaExists: !!practiceArea
            });
            
            if (practicePage && !practicePage.classList.contains('d-none') && practiceArea) {
                // 页面已显示，开始练习
                console.log('[TaskListUI.startTask] 页面已就绪，开始练习');
                if (typeof Practice !== 'undefined') {
                    Practice.start({ taskId: taskId });
                } else {
                    console.error('[TaskListUI.startTask] Practice 模块未定义');
                }
            } else if (checkCount < maxChecks) {
                // 页面还未显示，继续等待
                setTimeout(checkAndStart, 50);
            } else {
                // 超时，显示错误
                console.error('[TaskListUI.startTask] 页面就绪检查超时');
                alert('页面加载超时，请刷新页面重试');
            }
        };
        // 初始延迟，确保Main.showPage执行完成
        setTimeout(checkAndStart, 100);
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
        console.log('[TaskListUI.confirmSplitTask] ===== 开始拆分任务 =====');
        console.log('[TaskListUI.confirmSplitTask] _splitData:', this._splitData);
        
        if (!this._splitData) {
            console.error('[TaskListUI.confirmSplitTask] ❌ _splitData 为空，无法拆分');
            return;
        }
        
        const perTaskInput = document.getElementById('task-split-per-task');
        const autoStartCheck = document.getElementById('task-split-auto-start');
        
        if (!perTaskInput) {
            console.error('[TaskListUI.confirmSplitTask] ❌ 找不到 task-split-per-task 输入框');
            return;
        }
        
        const perTask = parseInt(perTaskInput.value) || 50;
        const autoStart = autoStartCheck ? autoStartCheck.checked : false;
        console.log('[TaskListUI.confirmSplitTask] 拆分参数:', { perTask, autoStart });
        
        const { wordIds, taskName } = this._splitData;
        console.log('[TaskListUI.confirmSplitTask] 拆分数据:', { wordIdsCount: wordIds.length, taskName });
        
        const tasks = TaskList.splitTask({
            wordIds,
            name: taskName,
            questionsPerTask: perTask
        });
        console.log('[TaskListUI.confirmSplitTask] 拆分结果:', { taskCount: tasks.length, tasks: tasks.map(t => ({ name: t.name, wordCount: t.wordIds.length })) });
        
        let addedCount = 0;
        let duplicateCount = 0;
        let firstTaskId = null;
        
        // 先检查当前任务列表
        const beforeTasks = TaskList.getAllTasks();
        console.log('[TaskListUI.confirmSplitTask] 拆分前任务总数:', beforeTasks.length);
        
        tasks.forEach((task, index) => {
            console.log(`[TaskListUI.confirmSplitTask] 正在添加任务 ${index + 1}/${tasks.length}:`, { name: task.name, wordCount: task.wordIds.length });
            
            // 确保progress.total与wordIds.length一致
            if (task.progress) {
                task.progress.total = task.wordIds.length;
            } else {
                task.progress = {
                    total: task.wordIds.length,
                    completed: 0,
                    correct: 0,
                    errors: []
                };
            }
            
            const result = TaskList.addTask(task);
            console.log(`[TaskListUI.confirmSplitTask] 添加结果 ${index + 1}:`, result);
            if (result.success) {
                addedCount++;
                if (index === 0) {
                    firstTaskId = result.task.id;
                }
            } else {
                duplicateCount++;
                console.warn(`[TaskListUI.confirmSplitTask] ⚠️ 任务 ${index + 1} 添加失败:`, result.message);
            }
        });
        
        // 验证任务是否真的保存了
        const afterTasks = TaskList.getAllTasks();
        console.log('[TaskListUI.confirmSplitTask] 拆分后任务总数:', afterTasks.length);
        console.log('[TaskListUI.confirmSplitTask] 实际新增任务数:', afterTasks.length - beforeTasks.length);
        console.log('[TaskListUI.confirmSplitTask] 统计结果:', { addedCount, duplicateCount, firstTaskId });
        
        // 关闭弹窗
        const modal = bootstrap.Modal.getInstance(document.getElementById('task-split-modal'));
        if (modal) {
            modal.hide();
            console.log('[TaskListUI.confirmSplitTask] 弹窗已关闭');
        } else {
            console.warn('[TaskListUI.confirmSplitTask] ⚠️ 找不到弹窗实例');
        }
        
        // 显示结果
        let message = `成功添加 ${addedCount} 个任务`;
        if (duplicateCount > 0) {
            message += `，${duplicateCount} 个任务已存在`;
        }
        console.log('[TaskListUI.confirmSplitTask] 提示消息:', message);
        alert(message);
        
        // 刷新任务清单
        console.log('[TaskListUI.confirmSplitTask] 开始刷新任务清单...');
        this.render();
        this.updateBadge();
        console.log('[TaskListUI.confirmSplitTask] 任务清单刷新完成');
        
        // 拆分完成后自动跳转到任务清单，方便用户立即看到新任务
        try {
            if (typeof Main !== 'undefined') {
                console.log('[TaskListUI.confirmSplitTask] 跳转到任务清单页...');
                window.location.hash = 'tasklist';
                Main.showPage('tasklist');
                console.log('[TaskListUI.confirmSplitTask] 跳转完成');
            } else {
                console.error('[TaskListUI.confirmSplitTask] ❌ Main 未定义，无法跳转');
            }
        } catch (e) {
            console.error('[TaskListUI.confirmSplitTask] ❌ 跳转任务清单失败:', e);
        }
        
        // 清除临时数据
        this._splitData = null;
        console.log('[TaskListUI.confirmSplitTask] ===== 拆分任务完成 =====');
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
        console.log('[TaskListUI.showDeleteConfirm] 显示删除确认', { taskId, isClearAll });
        // 检查是否在5分钟内已验证过
        if (this.isAdminVerified()) {
            console.log('[TaskListUI.showDeleteConfirm] 已在5分钟内验证过，直接执行删除');
            // 直接执行删除操作
            this.executeDelete(taskId, isClearAll);
            return;
        }
        
        // 需要重新验证 - 使用自定义模态框替代 prompt()
        console.log('[TaskListUI.showDeleteConfirm] 需要验证密码');
        this._pendingDeleteTaskId = taskId;
        this._pendingDeleteIsClearAll = isClearAll;
        
        // 显示密码输入模态框
        const modal = new bootstrap.Modal(document.getElementById('task-delete-password-modal'));
        const passwordInput = document.getElementById('task-delete-password-input');
        const errorDiv = document.getElementById('task-delete-password-error');
        const confirmBtn = document.getElementById('task-delete-password-confirm-btn');
        
        // 清空输入和错误信息
        passwordInput.value = '';
        errorDiv.style.display = 'none';
        passwordInput.classList.remove('is-invalid');
        
        // 绑定确认按钮事件（移除旧的事件监听器）
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // 处理确认按钮点击
        newConfirmBtn.addEventListener('click', () => {
            const password = passwordInput.value.trim();
            console.log('[TaskListUI.showDeleteConfirm] 用户输入的密码:', password ? '已输入' : '空');
            
            if (password === 'Admin') {
                console.log('[TaskListUI.showDeleteConfirm] 密码正确，执行删除');
                // 保存验证时间戳
                this.saveAdminVerified();
                // 关闭模态框
                modal.hide();
                // 执行删除操作
                this.executeDelete(this._pendingDeleteTaskId, this._pendingDeleteIsClearAll);
                // 清空待删除信息
                this._pendingDeleteTaskId = null;
                this._pendingDeleteIsClearAll = false;
            } else {
                console.log('[TaskListUI.showDeleteConfirm] 密码错误');
                passwordInput.classList.add('is-invalid');
                errorDiv.style.display = 'block';
                passwordInput.focus();
            }
        });
        
        // 处理回车键
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                newConfirmBtn.click();
            }
        });
        
        // 处理模态框关闭事件（清空状态）
        const modalElement = document.getElementById('task-delete-password-modal');
        const handleModalHidden = () => {
            passwordInput.value = '';
            errorDiv.style.display = 'none';
            passwordInput.classList.remove('is-invalid');
            this._pendingDeleteTaskId = null;
            this._pendingDeleteIsClearAll = false;
            modalElement.removeEventListener('hidden.bs.modal', handleModalHidden);
        };
        modalElement.addEventListener('hidden.bs.modal', handleModalHidden);
        
        // 显示模态框并聚焦输入框
        modal.show();
        setTimeout(() => {
            passwordInput.focus();
        }, 300);
    },
    
    /**
     * 执行删除操作
     */
    executeDelete(taskId, isClearAll) {
        console.log('[TaskListUI.executeDelete] 开始执行删除操作', { taskId, isClearAll });
        if (isClearAll) {
            if (confirm('确定要清空所有任务吗？此操作不可恢复。')) {
                console.log('[TaskListUI.executeDelete] 清空所有任务');
                const result = TaskList.clearAllTasks();
                console.log('[TaskListUI.executeDelete] 清空结果:', result);
                
                // 验证是否真的清空了（包括自动生成的复习任务）
                const verifyTasks = TaskList.getAllTasks();
                if (verifyTasks.length > 0) {
                    console.warn('[TaskListUI.executeDelete] ⚠️ 清空后仍有任务残留，强制清空:', verifyTasks.length);
                    // 再次强制清空
                    localStorage.removeItem(TaskList.KEY);
                    console.log('[TaskListUI.executeDelete] 已强制清空localStorage');
                }
                
                // 清空后立即加载时，跳过自动生成复习任务，避免立即重新生成
                this.load(true); // 传入 true 跳过自动生成
                this.updateBadge();
            }
        } else if (taskId) {
            // 检查是否是批量删除（多个任务ID用逗号分隔）
            if (taskId.includes(',')) {
                const taskIds = taskId.split(',').filter(id => id.trim());
                if (confirm(`确定要删除这 ${taskIds.length} 个任务吗？此操作不可恢复。`)) {
                    console.log('[TaskListUI.executeDelete] 批量删除任务:', taskIds);
                    let deletedCount = 0;
                    taskIds.forEach(id => {
                        const result = TaskList.deleteTask(id.trim());
                        if (result.success) {
                            deletedCount++;
                        }
                    });
                    console.log('[TaskListUI.executeDelete] 批量删除结果:', { total: taskIds.length, deleted: deletedCount });
                    this.load();
                    this.updateBadge();
                    // 退出批量模式
                    if (this._isBatchMode) {
                        this.toggleBatchMode();
                    }
                }
            } else {
                if (confirm('确定要删除这个任务吗？')) {
                    console.log('[TaskListUI.executeDelete] 删除任务:', taskId);
                    const result = TaskList.deleteTask(taskId);
                    console.log('[TaskListUI.executeDelete] 删除结果:', result);
                    this.load(); // 使用 load() 而不是 render()，确保重新绑定事件
                    this.updateBadge();
                }
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
    },
    
    /**
     * 切换批量操作模式
     */
    toggleBatchMode() {
        this._isBatchMode = !this._isBatchMode;
        const toolbar = document.getElementById('task-list-batch-toolbar');
        const batchModeBtn = document.getElementById('task-list-batch-mode-btn');
        
        if (toolbar) {
            if (this._isBatchMode) {
                toolbar.classList.remove('d-none');
            } else {
                toolbar.classList.add('d-none');
                // 退出批量模式时，取消所有选择
                this.deselectAllTasks();
            }
        }
        
        // 更新按钮状态
        if (batchModeBtn) {
            if (this._isBatchMode) {
                batchModeBtn.classList.remove('btn-outline-secondary');
                batchModeBtn.classList.add('btn-secondary');
            } else {
                batchModeBtn.classList.remove('btn-secondary');
                batchModeBtn.classList.add('btn-outline-secondary');
            }
        }
        
        // 更新所有卡片的显示状态
        this.updateBatchModeUI();
    },
    
    /**
     * 更新批量操作模式的UI显示
     */
    updateBatchModeUI() {
        const checkboxes = document.querySelectorAll('.task-select-checkbox');
        const deleteBtns = document.querySelectorAll('.task-delete-btn');
        
        checkboxes.forEach(cb => {
            cb.style.display = this._isBatchMode ? 'block' : 'none';
        });
        
        deleteBtns.forEach(btn => {
            btn.style.display = this._isBatchMode ? 'none' : 'block';
        });
        
        // 更新已选择数量
        this.updateSelectedCount();
    },
    
    /**
     * 全选任务
     */
    selectAllTasks() {
        const checkboxes = document.querySelectorAll('.task-select-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = true;
        });
        this.updateSelectedCount();
    },
    
    /**
     * 取消全选任务
     */
    deselectAllTasks() {
        const checkboxes = document.querySelectorAll('.task-select-checkbox');
        checkboxes.forEach(cb => {
            cb.checked = false;
        });
        this.updateSelectedCount();
    },
    
    /**
     * 更新已选择任务数量
     */
    updateSelectedCount() {
        const checkboxes = document.querySelectorAll('.task-select-checkbox:checked');
        const count = checkboxes.length;
        const countEl = document.getElementById('task-list-selected-count');
        const batchDeleteBtn = document.getElementById('task-list-batch-delete-btn');
        
        if (countEl) {
            countEl.textContent = count;
        }
        
        if (batchDeleteBtn) {
            batchDeleteBtn.disabled = count === 0;
        }
    },
    
    /**
     * 批量删除任务
     */
    batchDeleteTasks() {
        const checkboxes = document.querySelectorAll('.task-select-checkbox:checked');
        const taskIds = Array.from(checkboxes).map(cb => cb.getAttribute('data-task-id'));
        
        if (taskIds.length === 0) {
            return;
        }
        
        console.log('[TaskListUI.batchDeleteTasks] 准备批量删除任务:', taskIds);
        this.showDeleteConfirm(taskIds.join(','), false); // 传递多个任务ID，用逗号分隔
    }
};

