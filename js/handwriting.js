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
        // 修复：正确区分文字和背景，避免全黑图片
        const dpr = window.devicePixelRatio || 1;
        const width = this.canvas.width / dpr;
        const height = this.canvas.height / dpr;
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        
        // 第一步：创建临时canvas，适度放大（不超过400px）
        const maxSize = 400; // 限制最大尺寸，避免图片过大
        const scale = Math.min(2, maxSize / Math.max(width, height));
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.round(width * scale);
        tempCanvas.height = Math.round(height * scale);
        const tempCtx = tempCanvas.getContext('2d');
        
        // 设置白色背景
        tempCtx.fillStyle = '#ffffff';
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // 将原canvas内容绘制到临时canvas
        tempCtx.drawImage(
            this.canvas,
            0, 0, width, height,
            0, 0, tempCanvas.width, tempCanvas.height
        );
        
        // 第二步：获取图像数据并处理
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        // 找到文字的边界框（用于裁剪）
        let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
        let hasContent = false;
        
        // 先找出所有非白色像素（文字区域）
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            const x = (i / 4) % tempCanvas.width;
            const y = Math.floor((i / 4) / tempCanvas.width);
            
            // 判断是否为文字像素：
            // 1. 透明度足够（非完全透明）
            // 2. 不是纯白色（RGB接近255）
            const isWhite = r > 250 && g > 250 && b > 250;
            const hasAlpha = a > 50; // 有足够的不透明度
            
            if (hasAlpha && !isWhite) {
                // 这是文字或网格线
                hasContent = true;
                // 记录文字边界
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        
        // 第三步：二值化处理（只处理文字区域）
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            const x = (i / 4) % tempCanvas.width;
            const y = Math.floor((i / 4) / tempCanvas.width);
            
            // 判断是否为文字像素
            const isWhite = r > 250 && g > 250 && b > 250;
            const hasAlpha = a > 50;
            
            if (hasAlpha && !isWhite) {
                // 文字：转为纯黑
                data[i] = 0;     // R
                data[i + 1] = 0; // G
                data[i + 2] = 0; // B
                data[i + 3] = 255; // A
            } else {
                // 背景：纯白
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                data[i + 3] = 255;
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        // 第四步：裁剪到文字区域（如果有内容）
        if (hasContent && minX < maxX && minY < maxY) {
            // 添加边距
            const padding = 15;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(tempCanvas.width, maxX + padding);
            maxY = Math.min(tempCanvas.height, maxY + padding);
            
            const cropWidth = maxX - minX;
            const cropHeight = maxY - minY;
            
            // 确保最小尺寸（百度API要求≥15px）
            if (cropWidth >= 15 && cropHeight >= 15) {
                // 创建裁剪后的canvas
                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = cropWidth;
                croppedCanvas.height = cropHeight;
                const croppedCtx = croppedCanvas.getContext('2d');
                
                // 设置白色背景
                croppedCtx.fillStyle = '#ffffff';
                croppedCtx.fillRect(0, 0, cropWidth, cropHeight);
                
                // 绘制裁剪区域
                croppedCtx.drawImage(
                    tempCanvas,
                    minX, minY, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );
                
                return croppedCanvas.toDataURL('image/png', 1.0);
            }
        }
        
        // 如果没有检测到文字或裁剪失败，返回处理后的原图（至少是二值化的）
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
        const size = Math.min(width, height) - padding * 2;
        const x = padding;
        const y = padding;
        
        // 保存当前状态
        this.ctx.save();
        
        // 设置文字样式 - 使用楷体，撑满田字格
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        this.ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        // 使用楷体，字体大小约为田字格的80-90%，确保撑满
        const fontSize = size * 0.85;
        this.ctx.font = `bold ${fontSize}px "KaiTi", "Kaiti SC", "楷体", "STKaiti", serif`;
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
    const padding = 2; // 田字格边界的padding（只是外边框的间距）
    const size = Math.min(width, height) - padding * 2; // 田字格大小 = 画布大小 - 2px padding
    const x = padding; // 从padding位置开始
    const y = padding;
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
