/**
 * 复习计划UI模块
 */

const ReviewPlanUI = {
    /**
     * 加载复习计划页面
     */
    load() {
        const container = document.getElementById('review-plan-container');
        if (!container) return;
        
        // 获取今天需要复习的计划
        const todayPlans = typeof ReviewPlan !== 'undefined' && ReviewPlan.getTodayReviewPlans
            ? ReviewPlan.getTodayReviewPlans()
            : [];
        
        // 获取所有未掌握的复习计划
        const allPlans = typeof Storage !== 'undefined' && Storage.getAllReviewPlans
            ? Storage.getAllReviewPlans().filter(p => !p.mastered)
            : [];
        
        this.render(container, todayPlans, allPlans);
        this.bindEvents();
    },
    
    /**
     * 渲染复习计划列表
     */
    render(container, todayPlans, allPlans) {
        let html = '';
        
        // 今天需要复习的
        html += `
            <div class="mb-4">
                <h6 class="mb-3">
                    <i class="bi bi-calendar-day"></i> 今天需要复习
                    <span class="badge bg-primary ms-2">${todayPlans.length}</span>
                </h6>
        `;
        
        if (todayPlans.length === 0) {
            html += '<div class="text-center text-muted py-3">今天没有需要复习的字</div>';
        } else {
            html += '<div class="row g-3">';
            todayPlans.forEach(plan => {
                html += this.renderPlanCard(plan, true);
            });
            html += '</div>';
        }
        
        html += '</div>';
        
        // 所有复习计划
        html += `
            <div class="mb-4">
                <h6 class="mb-3">
                    <i class="bi bi-list-ul"></i> 所有复习计划
                    <span class="badge bg-secondary ms-2">${allPlans.length}</span>
                </h6>
        `;
        
        if (allPlans.length === 0) {
            html += '<div class="text-center text-muted py-3">暂无复习计划</div>';
        } else {
            // 按学期和单元分组
            const grouped = this.groupPlansBySemesterUnit(allPlans);
            const semesters = Object.keys(grouped).sort();
            
            semesters.forEach(semester => {
                html += `<div class="mb-3"><h6 class="text-primary">${semester}</h6>`;
                const units = Object.keys(grouped[semester]).sort();
                
                html += '<div class="row g-2">';
                units.forEach(unit => {
                    const plans = grouped[semester][unit];
                    plans.forEach(plan => {
                        html += this.renderPlanCard(plan, false);
                    });
                });
                html += '</div></div>';
            });
        }
        
        html += '</div>';
        
        container.innerHTML = html;
    },
    
    /**
     * 渲染单个复习计划卡片
     */
    renderPlanCard(plan, isToday) {
        const progress = typeof ReviewPlan !== 'undefined' && ReviewPlan.getProgressVisualization
            ? ReviewPlan.getProgressVisualization(plan)
            : '○○○○○○';
        
        const currentStage = plan.currentStage || 1;
        const stageName = typeof ReviewPlan !== 'undefined' && ReviewPlan.STAGE_NAMES
            ? ReviewPlan.STAGE_NAMES[currentStage - 1] || `第${currentStage}周期`
            : `第${currentStage}周期`;
        
        // 找到当前需要复习的阶段
        const currentStageObj = plan.stages.find(s => s.stage === currentStage);
        const nextReviewDate = currentStageObj 
            ? new Date(currentStageObj.scheduledAt).toLocaleDateString('zh-CN')
            : '-';
        
        const cardClass = isToday ? 'border-primary' : 'border-secondary';
        const badgeClass = isToday ? 'bg-primary' : 'bg-secondary';
        
        return `
            <div class="col-md-6 col-lg-4">
                <div class="card ${cardClass} h-100">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h5 class="card-title mb-1">${plan.word || '未知'}</h5>
                                <small class="text-muted">${plan.pinyin || ''}</small>
                            </div>
                            <span class="badge ${badgeClass}">${isToday ? '今天' : '待复习'}</span>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted">进度：</small>
                            <div class="mt-1" style="font-size: 1.2em; letter-spacing: 0.2em;">${progress}</div>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted">当前阶段：</small>
                            <strong>${stageName}</strong>
                        </div>
                        <div class="mb-2">
                            <small class="text-muted">下次复习：</small>
                            <span>${nextReviewDate}</span>
                        </div>
                        ${plan.currentCycle > 1 ? `<div class="mb-2"><small class="text-warning">第${plan.currentCycle}个复习周期</small></div>` : ''}
                        <div class="d-flex gap-2 mt-3">
                            <button class="btn btn-sm btn-primary flex-fill" data-action="start-review" data-word-id="${plan.wordId}">
                                <i class="bi bi-play-fill"></i> 开始复习
                            </button>
                            <button class="btn btn-sm btn-outline-success" data-action="mark-mastered" data-word-id="${plan.wordId}">
                                <i class="bi bi-check-circle"></i> 已掌握
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },
    
    /**
     * 按学期和单元分组复习计划
     */
    groupPlansBySemesterUnit(plans) {
        const grouped = {};
        const wordBank = typeof Storage !== 'undefined' ? Storage.getWordBank() : [];
        
        plans.forEach(plan => {
            const word = wordBank.find(w => w.id === plan.wordId);
            if (!word) return;
            
            const gradeLabel = this.formatGradeLabel(word.grade);
            const semesterLabel = this.formatSemesterLabel(word.semester);
            const semesterKey = `${gradeLabel}${semesterLabel}`;
            const unitLabel = word.unitLabel || this.formatUnitLabel(word.unit);
            const unitKey = unitLabel || '未分类单元';
            
            if (!grouped[semesterKey]) grouped[semesterKey] = {};
            if (!grouped[semesterKey][unitKey]) {
                grouped[semesterKey][unitKey] = [];
            }
            grouped[semesterKey][unitKey].push(plan);
        });
        
        return grouped;
    },
    
    /**
     * 格式化年级标签
     */
    formatGradeLabel(grade) {
        const gradeMap = { 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六' };
        return gradeMap[grade] || grade || '';
    },
    
    /**
     * 格式化学期标签
     */
    formatSemesterLabel(semester) {
        const semesterMap = { '上': '上册', '下': '下册' };
        return semesterMap[semester] || semester || '';
    },
    
    /**
     * 格式化单元标签
     */
    formatUnitLabel(unit) {
        if (typeof unit === 'number') {
            return `第${unit}单元`;
        }
        return unit || '未分类单元';
    },
    
    /**
     * 绑定事件
     */
    bindEvents() {
        const container = document.getElementById('review-plan-container');
        if (!container) return;
        
        // 开始复习
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="start-review"]');
            if (btn) {
                const wordId = btn.dataset.wordId;
                this.startReview(wordId);
            }
        });
        
        // 标记为已掌握
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="mark-mastered"]');
            if (btn) {
                const wordId = btn.dataset.wordId;
                this.markAsMastered(wordId);
            }
        });
        
        // 刷新按钮
        const refreshBtn = document.getElementById('review-plan-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.load();
            });
        }
    },
    
    /**
     * 开始复习
     */
    startReview(wordId) {
        const plan = Storage.getReviewPlan(wordId);
        if (!plan) {
            alert('未找到复习计划');
            return;
        }
        
        const wordBank = Storage.getWordBank();
        const word = wordBank.find(w => w.id === wordId);
        if (!word) {
            alert('未找到该字');
            return;
        }
        
        // 开始练习该字
        if (typeof Practice !== 'undefined' && Practice.start) {
            Practice.start({ wordIds: [wordId] });
        }
    },
    
    /**
     * 标记为已掌握
     */
    markAsMastered(wordId) {
        if (!confirm('确定要将该字标记为已掌握吗？')) {
            return;
        }
        
        if (typeof ReviewPlan !== 'undefined' && ReviewPlan.markAsMastered) {
            ReviewPlan.markAsMastered(wordId);
            this.load();
            
            if (typeof WordBank !== 'undefined' && WordBank.showToast) {
                WordBank.showToast('success', '已标记为已掌握');
            }
        }
    }
};

