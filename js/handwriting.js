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
        
        // 设置画笔样式
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        // 绑定事件
        this.bindEvents();
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
        
        // 重新设置画笔样式
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
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
    },
    
    /**
     * 获取Canvas快照（Base64图片）
     */
    getSnapshot() {
        return this.canvas.toDataURL('image/png');
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
    }
};
