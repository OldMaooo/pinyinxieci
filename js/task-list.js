/**
 * 任务清单模块
 * 管理练习任务的创建、拆分、存储和继续
 */

const TaskList = {
    // 存储键名
    KEY: 'task_list',
    
    // 任务状态
    STATUS: {
        PENDING: 'pending',      // 未开始
        IN_PROGRESS: 'in-progress', // 进行中
        COMPLETED: 'completed',   // 已完成
        PAUSED: 'paused'         // 已暂停
    },
    
    // 任务类型
    TYPE: {
        PRACTICE: 'practice',    // 普通练习
        REVIEW: 'review'        // 复习任务
    },
    
    /**
     * 获取所有任务
     */
    getAllTasks() {
        try {
            const data = localStorage.getItem(this.KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error('[TaskList] 获取任务列表失败:', e);
            return [];
        }
    },
    
    /**
     * 保存所有任务
     */
    saveAllTasks(tasks) {
        console.log('[TaskList.saveAllTasks] ===== 开始保存任务列表 =====');
        console.log('[TaskList.saveAllTasks] 任务数量:', tasks?.length || 0);
        console.log('[TaskList.saveAllTasks] 存储键名:', this.KEY);
        
        try {
            const jsonString = JSON.stringify(tasks || []);
            console.log('[TaskList.saveAllTasks] JSON 字符串长度:', jsonString.length);
            localStorage.setItem(this.KEY, jsonString);
            
            // 验证保存是否成功
            const verify = localStorage.getItem(this.KEY);
            if (verify) {
                const parsed = JSON.parse(verify);
                console.log('[TaskList.saveAllTasks] ✅ 保存成功，验证通过，任务数量:', parsed.length);
                console.log('[TaskList.saveAllTasks] ===== 保存任务列表完成 =====');
                return true;
            } else {
                console.error('[TaskList.saveAllTasks] ❌ 保存失败，验证时 localStorage 为空');
                return false;
            }
        } catch (e) {
            console.error('[TaskList.saveAllTasks] ❌ 保存任务列表失败:', e);
            console.error('[TaskList.saveAllTasks] 错误详情:', { message: e.message, stack: e.stack });
            return false;
        }
    },
    
    /**
     * 添加任务
     */
    addTask(task) {
        console.log('[TaskList.addTask] ===== 开始添加任务 =====');
        console.log('[TaskList.addTask] 任务数据:', { name: task.name, wordIdsCount: task.wordIds?.length, id: task.id });
        
        const tasks = this.getAllTasks();
        console.log('[TaskList.addTask] 当前任务列表长度:', tasks.length);
        
        // 检查是否重复（比较题目ID列表）
        const isDuplicate = tasks.some(t => {
            if (t.wordIds.length !== task.wordIds.length) return false;
            const tIds = [...t.wordIds].sort().join(',');
            const taskIds = [...task.wordIds].sort().join(',');
            return tIds === taskIds;
        });
        
        if (isDuplicate) {
            console.warn('[TaskList.addTask] ⚠️ 任务重复，跳过添加');
            return { success: false, message: '任务已存在，无需重复添加' };
        }
        
        // 生成任务ID
        if (!task.id) {
            task.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            console.log('[TaskList.addTask] 生成任务ID:', task.id);
        }
        
        // 设置默认值
        task.status = task.status || this.STATUS.PENDING;
        task.type = task.type || this.TYPE.PRACTICE;
        task.createdAt = task.createdAt || new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        
        if (!task.progress) {
            task.progress = {
                total: task.wordIds.length,
                completed: 0,
                correct: 0,
                errors: []
            };
        }
        
        console.log('[TaskList.addTask] 准备添加的任务:', { id: task.id, name: task.name, status: task.status, type: task.type, progress: task.progress });
        
        tasks.push(task);
        console.log('[TaskList.addTask] 任务已推入数组，新长度:', tasks.length);
        
        const saveResult = this.saveAllTasks(tasks);
        console.log('[TaskList.addTask] 保存结果:', saveResult);
        
        // 验证保存是否成功
        const verifyTasks = this.getAllTasks();
        const found = verifyTasks.find(t => t.id === task.id);
        if (found) {
            console.log('[TaskList.addTask] ✅ 任务保存成功，验证通过');
        } else {
            console.error('[TaskList.addTask] ❌ 任务保存失败，验证时找不到任务');
        }
        
        console.log('[TaskList.addTask] ===== 添加任务完成 =====');
        return { success: true, task: task };
    },
    
    /**
     * 更新任务
     */
    updateTask(taskId, updates) {
        const tasks = this.getAllTasks();
        const index = tasks.findIndex(t => t.id === taskId);
        
        if (index === -1) {
            return { success: false, message: '任务不存在' };
        }
        
        tasks[index] = {
            ...tasks[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        this.saveAllTasks(tasks);
        return { success: true, task: tasks[index] };
    },
    
    /**
     * 删除任务
     */
    deleteTask(taskId) {
        const tasks = this.getAllTasks();
        const filtered = tasks.filter(t => t.id !== taskId);
        this.saveAllTasks(filtered);
        return { success: true };
    },
    
    /**
     * 批量删除任务
     */
    deleteTasks(taskIds) {
        const tasks = this.getAllTasks();
        const filtered = tasks.filter(t => !taskIds.includes(t.id));
        this.saveAllTasks(filtered);
        return { success: true, deleted: tasks.length - filtered.length };
    },
    
    /**
     * 清空所有任务
     */
    clearAllTasks() {
        this.saveAllTasks([]);
        return { success: true };
    },
    
    /**
     * 获取任务
     */
    getTask(taskId) {
        const tasks = this.getAllTasks();
        return tasks.find(t => t.id === taskId) || null;
    },
    
    /**
     * 拆分任务
     * @param {Object} options - 拆分选项
     * @param {Array<string>} options.wordIds - 题目ID列表
     * @param {string} options.name - 任务名称（基础名称）
     * @param {number} options.questionsPerTask - 每个任务的题数
     * @returns {Array<Object>} 拆分后的任务列表
     */
    splitTask(options) {
        const { wordIds, name, questionsPerTask } = options;
        
        if (!wordIds || wordIds.length === 0) {
            return [];
        }
        
        const totalQuestions = wordIds.length;
        const taskCount = Math.ceil(totalQuestions / questionsPerTask);
        
        const tasks = [];
        for (let i = 0; i < taskCount; i++) {
            const start = i * questionsPerTask;
            const end = Math.min(start + questionsPerTask, totalQuestions);
            const taskWordIds = wordIds.slice(start, end);
            
            const taskName = `${name}（${i + 1}/${taskCount}）`;
            
            tasks.push({
                name: taskName,
                wordIds: taskWordIds,
                type: this.TYPE.PRACTICE,
                status: this.STATUS.PENDING,
                progress: {
                    total: taskWordIds.length,
                    completed: 0,
                    correct: 0,
                    errors: []
                }
            });
        }
        
        return tasks;
    },
    
    /**
     * 生成任务名称
     * @param {Array} selectedUnits - 选中的单元列表
     * @returns {string} 任务名称
     */
    generateTaskName(selectedUnits) {
        if (!selectedUnits || selectedUnits.length === 0) {
            return '未命名任务';
        }
        
        // 按学期分组
        const bySemester = {};
        selectedUnits.forEach(unit => {
            // 学期格式：一年级上册 -> 一上，二年级下册 -> 二下
            const gradeNum = this._gradeToNumber(unit.grade);
            const semester = `${gradeNum}${unit.semester}`;
            if (!bySemester[semester]) {
                bySemester[semester] = [];
            }
            bySemester[semester].push(unit);
        });
        
        const semesterKeys = Object.keys(bySemester).sort();
        
        // 如果只有一个学期
        if (semesterKeys.length === 1) {
            const semester = semesterKeys[0];
            const units = bySemester[semester];
            
            // 提取单元编号并排序
            // 优先从unit中提取（格式如"语文园地一__1"或"识字 2__2"），如果没有则从unitLabel提取
            const unitNumbers = units.map((u, index) => {
                // 先从unit中提取（格式：xxx__数字）
                let match = (u.unit || '').match(/__(\d+)$/);
                if (match) {
                    return parseInt(match[1]);
                }
                // 从unitLabel中提取数字
                match = (u.unitLabel || '').match(/(\d+)/);
                if (match) {
                    return parseInt(match[1]);
                }
                // 如果都没有数字，使用索引+1作为编号
                return index + 1;
            }).sort((a, b) => a - b);
            
            if (unitNumbers.length === 1) {
                return `${semester}_${unitNumbers[0]}单元`;
            } else if (unitNumbers.length <= 3) {
                // 1-3个单元，显示所有：三上_1/3/8单元
                return `${semester}_${unitNumbers.join('/')}单元`;
            } else {
                // 多个单元，显示范围：三上_1-8单元
                return `${semester}_${unitNumbers[0]}-${unitNumbers[unitNumbers.length - 1]}单元`;
            }
        }
        
        // 多个学期，显示主要学期和单元范围
        if (semesterKeys.length <= 2) {
            const parts = semesterKeys.map(semester => {
                const units = bySemester[semester];
                const unitNumbers = units.map(u => {
                    const match = (u.unitLabel || u.unit || '').match(/(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                }).filter(n => n > 0).sort((a, b) => a - b);
                
                if (unitNumbers.length === 0) {
                    return `${semester}_${units.length}个单元`;
                } else if (unitNumbers.length === 1) {
                    return `${semester}_${unitNumbers[0]}单元`;
                } else {
                    return `${semester}_${unitNumbers[0]}-${unitNumbers[unitNumbers.length - 1]}单元`;
                }
            });
            return parts.join('、');
        }
        
        // 超过2个学期，显示学期范围
        return `${semesterKeys[0]}-${semesterKeys[semesterKeys.length - 1]}`;
    },
    
    /**
     * 年级转数字（一->1, 二->2, ...）
     */
    _gradeToNumber(grade) {
        const map = {
            '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6',
            '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6'
        };
        return map[grade] || grade;
    },
    
    /**
     * 获取任务统计
     */
    getStats() {
        const tasks = this.getAllTasks();
        return {
            total: tasks.length,
            pending: tasks.filter(t => t.status === this.STATUS.PENDING).length,
            inProgress: tasks.filter(t => t.status === this.STATUS.IN_PROGRESS).length,
            completed: tasks.filter(t => t.status === this.STATUS.COMPLETED).length,
            paused: tasks.filter(t => t.status === this.STATUS.PAUSED).length
        };
    },
    
    /**
     * 生成每日复习任务
     * 从复习计划中获取指定日期需要复习的字，创建复习任务
     * @param {Date} date - 日期（默认为今天）
     * @returns {Object|null} 复习任务对象，如果该日期没有需要复习的字则返回null
     */
    generateDailyReviewTask(date = new Date()) {
        if (typeof ReviewPlan === 'undefined' || !ReviewPlan.getTodayReviewPlans) {
            return null;
        }
        
        // 获取该日期需要复习的计划
        const reviewPlans = ReviewPlan.getTodayReviewPlans(date);
        if (!reviewPlans || reviewPlans.length === 0) {
            return null;
        }
        
        // 提取所有需要复习的字的ID
        const wordIds = reviewPlans.map(plan => plan.wordId);
        
        // 格式化日期为YYYY-MM-DD
        const dateStr = this.formatDateForTask(date);
        
        // 检查是否已存在该日期的复习任务
        const existingTasks = this.getAllTasks();
        const existingReviewTask = existingTasks.find(t => 
            t.type === this.TYPE.REVIEW && 
            t.scheduledDate === dateStr
        );
        
        if (existingReviewTask) {
            // 更新现有任务的wordIds（可能新增了需要复习的字）
            const existingWordIds = new Set(existingReviewTask.wordIds || []);
            wordIds.forEach(id => existingWordIds.add(id));
            existingReviewTask.wordIds = Array.from(existingWordIds);
            existingReviewTask.progress.total = existingReviewTask.wordIds.length;
            this.updateTask(existingReviewTask.id, {
                wordIds: existingReviewTask.wordIds,
                progress: existingReviewTask.progress
            });
            return existingReviewTask;
        }
        
        // 创建新的复习任务
        const task = {
            name: `复习计划 - ${this.formatDateDisplay(date)}`,
            wordIds: wordIds,
            type: this.TYPE.REVIEW,
            status: this.STATUS.PENDING,
            scheduledDate: dateStr, // 任务日期（YYYY-MM-DD格式）
            createdAt: new Date().toISOString(),
            progress: {
                total: wordIds.length,
                completed: 0,
                correct: 0,
                errors: []
            }
        };
        
        const result = this.addTask(task);
        return result.success ? result.task : null;
    },
    
    /**
     * 格式化日期为任务日期格式（YYYY-MM-DD）
     */
    formatDateForTask(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * 格式化日期显示（用于任务名称）
     */
    formatDateDisplay(date) {
        const d = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const taskDate = new Date(d);
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
            return d.toLocaleDateString('zh-CN', {
                month: 'long',
                day: 'numeric'
            });
        }
    },
    
    /**
     * 获取所有任务（包括自动生成的复习任务）
     * 如果某天的复习任务不存在，自动生成
     * @param {number} daysAhead - 提前生成多少天的复习任务（默认7天）
     */
    getAllTasksWithAutoReview(daysAhead = 7) {
        const tasks = this.getAllTasks();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // 为未来几天自动生成复习任务
        for (let i = 0; i <= daysAhead; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() + i);
            const dateStr = this.formatDateForTask(date);
            
            // 检查是否已有该日期的复习任务
            const hasReviewTask = tasks.some(t => 
                t.type === this.TYPE.REVIEW && 
                t.scheduledDate === dateStr
            );
            
            if (!hasReviewTask) {
                // 尝试生成该日期的复习任务
                const reviewTask = this.generateDailyReviewTask(date);
                if (reviewTask) {
                    tasks.push(reviewTask);
                }
            }
        }
        
        return tasks;
    }
};

