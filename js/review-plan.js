/**
 * 艾宾浩斯复习计划模块
 * 基于艾宾浩斯遗忘曲线的复习计划管理
 */

const ReviewPlan = {
    // 艾宾浩斯曲线时间节点（小时）
    REVIEW_INTERVALS: [1, 24, 72, 168, 336, 720], // 1小时、1天、3天、1周、2周、1个月
    
    // 周期名称映射
    STAGE_NAMES: ['1小时', '1天', '3天', '1周', '2周', '1个月'],
    
    /**
     * 计算复习时间点
     * @param {string} firstMarkedAt - 首次标记时间（ISO字符串）
     * @returns {Array} 复习时间点数组
     */
    calculateReviewSchedule(firstMarkedAt) {
        const firstDate = new Date(firstMarkedAt);
        return this.REVIEW_INTERVALS.map((hours, index) => {
            const scheduledAt = new Date(firstDate.getTime() + hours * 60 * 60 * 1000);
            return {
                stage: index + 1,
                scheduledAt: scheduledAt.toISOString(),
                completedAt: null,
                status: 'pending', // pending, completed, overdue
                passed: false // 该阶段是否通过（写对）
            };
        });
    },
    
    /**
     * 为错题创建复习计划
     * @param {Object} errorWord - 错题对象
     * @returns {Object|null} 复习计划对象
     */
    createPlanForErrorWord(errorWord) {
        if (!errorWord || !errorWord.wordId) return null;
        
        // 检查是否已有计划
        const existing = Storage.getReviewPlan(errorWord.wordId);
        if (existing) {
            return existing;
        }
        
        const plan = {
            id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            wordId: errorWord.wordId,
            word: errorWord.word,
            pinyin: errorWord.pinyin || '',
            unit: errorWord.unit || '',
            firstMarkedAt: errorWord.markedAt || new Date().toISOString(),
            stages: this.calculateReviewSchedule(errorWord.markedAt || new Date().toISOString()),
            currentStage: 1,
            currentCycle: 1, // 当前复习周期（如果最后一个周期未掌握，会重新开始）
            mastered: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const updatedPlan = this.updatePlanStatus(plan);
        Storage.saveReviewPlan(updatedPlan);
        return updatedPlan;
    },
    
    /**
     * 批量为错题创建复习计划
     * @param {Array} errorWords - 错题数组
     */
    createPlansForErrorWords(errorWords) {
        if (!errorWords || !Array.isArray(errorWords)) return;
        
        errorWords.forEach(errorWord => {
            this.createPlanForErrorWord(errorWord);
        });
    },
    
    /**
     * 更新复习计划状态
     * @param {Object} plan - 复习计划对象
     * @returns {Object} 更新后的计划
     */
    updatePlanStatus(plan) {
        if (!plan || !plan.stages) return plan;
        
        const now = new Date();
        plan.stages.forEach(stage => {
            const scheduledDate = new Date(stage.scheduledAt);
            
            if (stage.completedAt) {
                stage.status = 'completed';
            } else if (scheduledDate <= now) {
                // 如果计划日期已过但未完成，标记为逾期
                // 但允许顺延到次日，所以这里不标记为overdue，而是pending
                stage.status = 'pending';
            } else {
                stage.status = 'pending';
            }
        });
        
        // 更新当前阶段（第一个未完成的阶段）
        const firstPendingStage = plan.stages.find(s => s.status === 'pending' && !s.completedAt);
        if (firstPendingStage) {
            plan.currentStage = firstPendingStage.stage;
        } else {
            // 所有阶段都完成了
            plan.currentStage = plan.stages.length + 1;
        }
        
        plan.updatedAt = new Date().toISOString();
        return plan;
    },
    
    /**
     * 获取今天需要复习的字
     * @param {Date} date - 日期（默认为今天）
     * @returns {Array} 需要复习的计划列表
     */
    getTodayReviewPlans(date = new Date()) {
        const allPlans = Storage.getAllReviewPlans();
        const today = new Date(date);
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        return allPlans.filter(plan => {
            if (plan.mastered) return false;
            
            // 更新计划状态
            const updatedPlan = this.updatePlanStatus(plan);
            
            // 检查是否有今天或之前应该复习但未完成的阶段
            const pendingStages = updatedPlan.stages.filter(stage => {
                if (stage.completedAt) return false; // 已完成的跳过
                
                const scheduledDate = new Date(stage.scheduledAt);
                scheduledDate.setHours(0, 0, 0, 0);
                
                // 如果计划日期在今天或之前，且未完成，则需要复习
                return scheduledDate <= today;
            });
            
            return pendingStages.length > 0;
        }).map(plan => this.updatePlanStatus(plan));
    },
    
    /**
     * 完成一个阶段的复习
     * @param {string} wordId - 字的ID
     * @param {number} stage - 阶段编号（1-6）
     * @param {boolean} passed - 是否通过（写对）
     */
    completeStage(wordId, stage, passed) {
        const plan = Storage.getReviewPlan(wordId);
        if (!plan) {
            console.warn(`[ReviewPlan] 未找到复习计划: ${wordId}`);
            return null;
        }
        
        const stageObj = plan.stages.find(s => s.stage === stage);
        if (!stageObj) {
            console.warn(`[ReviewPlan] 未找到阶段: ${wordId}, stage ${stage}`);
            return null;
        }
        
        // 标记阶段为已完成
        stageObj.completedAt = new Date().toISOString();
        stageObj.status = 'completed';
        stageObj.passed = passed;
        
        // 更新计划状态
        const updatedPlan = this.updatePlanStatus(plan);
        
        // 检查是否是最后一个阶段
        const isLastStage = stage === plan.stages.length;
        
        if (isLastStage) {
            if (passed) {
                // 最后一个阶段通过了，标记为已掌握
                updatedPlan.mastered = true;
            } else {
                // 最后一个阶段未通过，重新计入下一个复习周期
                updatedPlan.currentCycle += 1;
                updatedPlan.currentStage = 1;
                
                // 重新计算复习时间点（基于当前时间）
                const newFirstMarkedAt = new Date().toISOString();
                updatedPlan.stages = this.calculateReviewSchedule(newFirstMarkedAt);
                updatedPlan.firstMarkedAt = newFirstMarkedAt;
            }
        }
        
        updatedPlan.updatedAt = new Date().toISOString();
        Storage.saveReviewPlan(updatedPlan);
        
        return updatedPlan;
    },
    
    /**
     * 获取复习计划的进度可视化
     * @param {Object} plan - 复习计划对象
     * @returns {string} 图形化字符串（●表示已完成，○表示待完成）
     */
    getProgressVisualization(plan) {
        if (!plan || !plan.stages) return '○○○○○○';
        const totalStages = plan.stages.length;
        const completedStages = plan.stages.filter(s => s.status === 'completed').length;
        const result = [];
        for (let i = 0; i < totalStages; i++) {
            result.push(i < completedStages ? '●' : '○');
        }
        return result.join('');
    },
    
    /**
     * 手动标记为已掌握
     * @param {string} wordId - 字的ID
     */
    markAsMastered(wordId) {
        const plan = Storage.getReviewPlan(wordId);
        if (!plan) return null;
        
        plan.mastered = true;
        plan.updatedAt = new Date().toISOString();
        Storage.saveReviewPlan(plan);
        return plan;
    },
    
    /**
     * 删除复习计划
     * @param {string} wordId - 字的ID
     */
    deletePlan(wordId) {
        Storage.deleteReviewPlan(wordId);
    }
};

