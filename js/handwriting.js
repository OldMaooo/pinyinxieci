/**
 * 手写输入模块
 * 处理Canvas手写输入（支持iPad和电脑）
 */

const Handwriting = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentPath: [],
    
    /**
     * 初始化Canvas
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas元素不存在');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        // 设置Canvas尺寸
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // 设置画笔样式（加粗）
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 5; // 加粗笔迹
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 绑定事件
        this.bindEvents();

        // 监听主题切换，更新画笔与网格
        window.addEventListener('storage', (e) => {
            if (e.key === 'theme') {
                this.updateInkAndGrid();
            }
        });
    },
    
    /**
     * 调整Canvas尺寸（响应式）
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        const containerRect = container ? container.getBoundingClientRect() : null;
        
        // 如果没有容器或者容器尺寸为0，使用默认尺寸
        let width = 500;
        let height = 400;
        
        if (containerRect && containerRect.width > 0) {
            width = Math.min(containerRect.width, 500);
            height = 400;
            if (window.innerWidth >= 768) {
                height = 500;
            }
        }
        
        const dpr = window.devicePixelRatio || 1;
        
        // 设置实际像素尺寸（考虑设备像素比）
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // 缩放上下文
        this.ctx.scale(dpr, dpr);
        
        // 设置显示尺寸
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // 重新设置画笔样式（根据主题）
        this.ctx.strokeStyle = this.getInkColor();
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // 绘制田字格背景
        this.drawTianZiGrid();
    },
    
    /**
     * 绑定事件（支持触摸和鼠标）
     */
    bindEvents() {
        // 触摸事件（iPad）
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.startDrawing(
                touch.clientX - rect.left,
                touch.clientY - rect.top
            );
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.isDrawing) {
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                this.continueDrawing(
                    touch.clientX - rect.left,
                    touch.clientY - rect.top
                );
            }
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
        
        // 鼠标事件（电脑）
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.startDrawing(
                e.clientX - rect.left,
                e.clientY - rect.top
            );
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDrawing) {
                const rect = this.canvas.getBoundingClientRect();
                this.continueDrawing(
                    e.clientX - rect.left,
                    e.clientY - rect.top
                );
            }
        });
        
        this.canvas.addEventListener('mouseup', () => {
            this.stopDrawing();
        });
        
        this.canvas.addEventListener('mouseleave', () => {
            this.stopDrawing();
        });
    },
    
    /**
     * 开始绘制
     */
    startDrawing(x, y) {
        this.isDrawing = true;
        this.currentPath = [{ x, y }];
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
    },
    
    /**
     * 继续绘制
     */
    continueDrawing(x, y) {
        if (!this.isDrawing) return;
        
        this.currentPath.push({ x, y });
        this.ctx.lineTo(x, y);
        this.ctx.stroke();
    },
    
    /**
     * 停止绘制
     */
    stopDrawing() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.ctx.beginPath();
        }
    },
    
    /**
     * 清除画布
     */
    clear() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        this.ctx.clearRect(0, 0, width, height);
        this.currentPath = [];
        this.drawTianZiGrid();
    },
    
    /**
     * 获取Canvas快照（Base64图片）
     * 优化：生成高对比度图片，便于识别
     */
    getSnapshot() {
        // 简化处理：只做基本优化，避免过度处理导致识别失败
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        
        // 创建一个临时canvas，尺寸放大2倍以提高识别准确率
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width * 2;
        tempCanvas.height = height * 2;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 设置白色背景
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 将原canvas内容绘制到临时canvas（放大2倍）
        tempCtx.drawImage(
            this.canvas,
            0, 0, width, height,
            0, 0, tempCanvas.width, tempCanvas.height
        );
        
        // 简化处理：只处理深色模式的颜色反转，不过度处理对比度
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        if (isDark) {
            // 深色模式：反转颜色（白色文字变黑色）
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // 反转RGB（保留透明度）
                data[i] = 255 - data[i];     // R
                data[i + 1] = 255 - data[i + 1]; // G
                data[i + 2] = 255 - data[i + 2]; // B
                // A 保持不变
            }
            tempCtx.putImageData(imageData, 0, 0);
        }
        
        // 生成高质量PNG（质量1.0）
        return tempCanvas.toDataURL('image/png', 1.0);
    },
    
    /**
     * 检查是否有内容
     */
    hasContent() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // 检查是否有非透明像素
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] !== 0) { // alpha通道不为0
                return true;
            }
        }
        return false;
    },

    /**
     * 获取当前主题下的画笔颜色
     */
    getInkColor() {
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        return isDark ? '#ffffff' : '#000000';
    },

    /**
     * 根据主题更新画笔与网格
     */
    updateInkAndGrid() {
        if (!this.ctx) return;
        this.ctx.strokeStyle = this.getInkColor();
        this.ctx.lineWidth = 5; // 保持加粗笔迹
        this.drawTianZiGrid();
    },
    
    /**
     * 在田字格中心绘制文字（用于显示正确答案）
     */
    drawCorrectWord(word) {
        if (!this.canvas || !this.ctx) return;
        
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        const padding = 2;
        const size = Math.min(width, height) * 0.75 - padding * 2;
        const x = (width - size) / 2;
        const y = (height - size) / 2;
        
        // 保存当前状态
        this.ctx.save();
        
        // 设置文字样式
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        this.ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        this.ctx.font = `bold ${size * 0.6}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        
        // 在田字格中心绘制文字
        const centerX = x + size / 2;
        const centerY = y + size / 2;
        this.ctx.fillText(word, centerX, centerY);
        
        // 恢复状态
        this.ctx.restore();
    }
};

/**
 * 绘制田字格（边框+虚线中线）
 */
Handwriting.drawTianZiGrid = function () {
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;
    const padding = 2; // 上下左右相等的padding
    const size = Math.min(width, height) * 0.75 - padding * 2; // 缩小到75%，确保按钮可见
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    const ctx = this.ctx;
    
    // 清空背景（避免反复缩放导致残影）
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.restore();
    
    // 外边框
    ctx.save();
    const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
    ctx.strokeStyle = isDark ? '#495057' : '#ced4da';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, size, size);
    
    // 中横中竖虚线
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    // 竖线
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    // 横线
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.strokeStyle = isDark ? '#495057' : '#adb5bd';
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
};
