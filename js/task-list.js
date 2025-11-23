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
        try {
            localStorage.setItem(this.KEY, JSON.stringify(tasks || []));
            return true;
        } catch (e) {
            console.error('[TaskList] 保存任务列表失败:', e);
            return false;
        }
    },
    
    /**
     * 添加任务
     */
    addTask(task) {
        const tasks = this.getAllTasks();
        
        // 检查是否重复（比较题目ID列表）
        const isDuplicate = tasks.some(t => {
            if (t.wordIds.length !== task.wordIds.length) return false;
            const tIds = [...t.wordIds].sort().join(',');
            const taskIds = [...task.wordIds].sort().join(',');
            return tIds === taskIds;
        });
        
        if (isDuplicate) {
            return { success: false, message: '任务已存在，无需重复添加' };
        }
        
        // 生成任务ID
        if (!task.id) {
            task.id = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
        
        tasks.push(task);
        this.saveAllTasks(tasks);
        
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
            const semester = `${unit.grade}${unit.semester}`;
            if (!bySemester[semester]) {
                bySemester[semester] = [];
            }
            bySemester[semester].push(unit);
        });
        
        const semesterKeys = Object.keys(bySemester);
        
        // 如果只有一个学期，显示详细信息
        if (semesterKeys.length === 1) {
            const units = bySemester[semesterKeys[0]];
            if (units.length <= 3) {
                const unitNames = units.map(u => `${u.unit}`).join('、');
                return `${semesterKeys[0]}${unitNames}`;
            } else {
                return `${semesterKeys[0]}${units[0].unit}-${units[units.length - 1].unit}`;
            }
        }
        
        // 多个学期，显示主要范围
        if (semesterKeys.length <= 3) {
            return semesterKeys.join('、');
        }
        
        // 超过3个范围，显示"多单元"
        return '多单元';
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
    }
};

