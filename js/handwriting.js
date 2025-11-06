/**
 * 手写输入模块
 * 处理Canvas手写输入（支持iPad和电脑）
 */

const Handwriting = {
    GRID_SIZE: 360, // 固定田字格边长（CSS像素）
    GRID_RATIO_IN_CANVAS: 0.95, // 田字格在画布中占比
    canvas: null,
    ctx: null,
    isDrawing: false,
    currentPath: [],
    paths: [], // 所有笔画路径历史
    
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
        window.addEventListener('resize', () => this.resizeCanvas(true));
        
        // 设置画笔样式（加粗 x2）
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 10; // 加粗笔迹
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
    resizeCanvas(preserve = false) {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        // 需要保留内容则先截图
        let prevImage = null;
        if (preserve) {
            try { prevImage = this.canvas.toDataURL('image/png'); } catch(e) { prevImage = null; }
        }
        const containerRect = container ? container.getBoundingClientRect() : null;
        
        // 以固定田字格尺寸为基准，计算画布尺寸，使田字格≈95%占比
        const gridSize = this.GRID_SIZE;
        let side = Math.round(gridSize / this.GRID_RATIO_IN_CANVAS);
        // 避免超出容器：如容器较窄，则按容器宽度等比缩放（同时保持固定网格相对比例）
        if (containerRect && containerRect.width > 0 && side > containerRect.width) {
            side = Math.floor(containerRect.width);
        }
        let width = side;
        let height = side;
        
        const dpr = window.devicePixelRatio || 1;
        
        // 设置实际像素尺寸（考虑设备像素比）
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        
        // 缩放上下文
        this.ctx.setTransform(1,0,0,1,0,0);
        this.ctx.scale(dpr, dpr);
        
        // 设置显示尺寸
        this.canvas.style.width = width + 'px';
        this.canvas.style.height = height + 'px';
        
        // 重新设置画笔样式（根据主题）
        this.ctx.strokeStyle = this.getInkColor();
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        // 绘制田字格背景
        this.drawTianZiGrid();
        // 恢复之前笔迹
        if (preserve && prevImage) {
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, 0, 0, width, height);
            };
            img.src = prevImage;
        }
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
            // 保存当前路径到历史
            if (this.currentPath.length > 0) {
                this.paths.push([...this.currentPath]);
            }
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
        this.paths = [];
        this.drawTianZiGrid();
    },

    /**
     * 撤销最后一笔
     */
    undo() {
        if (this.paths.length === 0) return;
        // 移除最后一条路径
        this.paths.pop();
        // 重绘画布
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);
        this.ctx.clearRect(0, 0, width, height);
        this.drawTianZiGrid();
        // 重新绘制所有路径
        this.ctx.strokeStyle = this.getInkColor();
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.paths.forEach(path => {
            if (path.length === 0) return;
            this.ctx.beginPath();
            this.ctx.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
            this.ctx.stroke();
        });
    },
    
    /**
     * 获取Canvas快照（Base64图片）
     * 优化：生成高对比度图片，便于识别
     */
    getSnapshot() {
        // 分离显示逻辑和提交逻辑：
        // 1. 只提取笔画，排除田字格
        // 2. 统一转换为白底黑字（深色模式下的白字需要反转）
        // 3. 裁剪到文字区域
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        
        // 第一步：获取canvas的实际像素尺寸（已经是考虑了dpr的）
        // canvas.width 和 canvas.height 是实际像素尺寸，不需要除以dpr
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // 创建临时canvas，适度放大（不超过400px）
        const maxSize = 320; // 降低处理分辨率以提速
        const scale = Math.min(1.5, maxSize / Math.max(canvasWidth, canvasHeight));
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.round(canvasWidth * scale);
        tempCanvas.height = Math.round(canvasHeight * scale);
        const tempCtx = tempCanvas.getContext('2d');
        
        // 深色模式特殊处理：先绘制原canvas（包含深色背景和白色文字）
        if (isDark) {
            // 深色模式：直接绘制原canvas（深色背景+白色文字）
            tempCtx.drawImage(
                this.canvas,
                0, 0, canvasWidth, canvasHeight,
                0, 0, tempCanvas.width, tempCanvas.height
            );
            
            // 对整个图片进行反转：深色背景变白色，白色文字变黑色
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
            
            // 浅色模式：设置白色背景，然后绘制原canvas（黑色文字）
        } else {
            // 设置白色背景
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            
            // 将原canvas内容绘制到临时canvas
            tempCtx.drawImage(
                this.canvas,
                0, 0, canvasWidth, canvasHeight,
                0, 0, tempCanvas.width, tempCanvas.height
            );
        }
        
        // 第二步：获取图像数据，分离笔画和网格（此时已经是白底黑字）
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;
        
        // 田字格的颜色（浅色模式：灰色，深色模式：反转后是浅灰色）
        const gridColorLight = { r: 173, g: 181, b: 189 }; // #adb5bd
        const gridColorDark = { r: 182, g: 175, b: 168 };  // 反转后的#6c757d
        const gridColor = isDark ? gridColorDark : gridColorLight;
        
        // 找到文字的边界框
        let minX = tempCanvas.width, minY = tempCanvas.height, maxX = 0, maxY = 0;
        let hasContent = false;
        
        // 先扫描一遍，找出文字区域（排除网格）
        // 改进：使用更宽松的网格识别阈值，确保能正确排除网格
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            const x = (i / 4) % tempCanvas.width;
            const y = Math.floor((i / 4) / tempCanvas.width);
            
            // 判断是否为网格线（颜色接近网格颜色，使用更宽松的阈值）
            const gridDistance = Math.abs(r - gridColor.r) + Math.abs(g - gridColor.g) + Math.abs(b - gridColor.b);
            const isGrid = gridDistance < 50 && a > 30; // 放宽阈值，确保能识别网格线
            
            // 判断是否为文字
            // 注意：深色模式下已经反转，所以现在是白底黑字（黑色文字）
            // 浅色模式下也是白底黑字（黑色文字）
            const isBlack = r < 50 && g < 50 && b < 50;
            const hasAlpha = a > 30; // 放宽透明度要求
            
            // 判断是否为文字：有透明度，不是网格，且是黑色（反转后都是黑色文字）
            const isText = hasAlpha && !isGrid && isBlack;
            
            if (isText) {
                hasContent = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
        
        // 第三步：二值化处理（只保留文字，排除网格）
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            
            // 判断是否为网格线（使用与扫描时相同的阈值）
            const gridDistance = Math.abs(r - gridColor.r) + Math.abs(g - gridColor.g) + Math.abs(b - gridColor.b);
            const isGrid = gridDistance < 50 && a > 30;
            
            // 判断是否为文字（使用与扫描时相同的逻辑）
            // 注意：深色模式下已经反转，所以现在是白底黑字
            const isBlack = r < 50 && g < 50 && b < 50;
            const hasAlpha = a > 30;
            const isText = hasAlpha && !isGrid && isBlack;
            
            if (isText) {
                // 文字：统一转为纯黑（反转后已经是黑色，直接设为纯黑）
                data[i] = 0;     // R
                data[i + 1] = 0; // G
                data[i + 2] = 0; // B
                data[i + 3] = 255; // A
            } else {
                // 背景或网格：纯白
                data[i] = 255;
                data[i + 1] = 255;
                data[i + 2] = 255;
                data[i + 3] = 255;
            }
        }
        
        tempCtx.putImageData(imageData, 0, 0);
        
        // 第四步：裁剪到文字区域
        if (hasContent && minX < maxX && minY < maxY) {
            const padding = 15;
            minX = Math.max(0, minX - padding);
            minY = Math.max(0, minY - padding);
            maxX = Math.min(tempCanvas.width, maxX + padding);
            maxY = Math.min(tempCanvas.height, maxY + padding);
            
            const cropWidth = maxX - minX;
            const cropHeight = maxY - minY;
            
            if (cropWidth >= 15 && cropHeight >= 15) {
                const croppedCanvas = document.createElement('canvas');
                croppedCanvas.width = cropWidth;
                croppedCanvas.height = cropHeight;
                const croppedCtx = croppedCanvas.getContext('2d');
                
                // 确保白色背景（先填充白色）
                croppedCtx.fillStyle = '#ffffff';
                croppedCtx.fillRect(0, 0, cropWidth, cropHeight);
                
                // 绘制裁剪区域（已经二值化处理过的，文字是黑色，背景是白色）
                croppedCtx.drawImage(
                    tempCanvas,
                    minX, minY, cropWidth, cropHeight,
                    0, 0, cropWidth, cropHeight
                );
                
                // 再次确保背景是白色（处理可能的透明度问题）
                const croppedImageData = croppedCtx.getImageData(0, 0, cropWidth, cropHeight);
                const croppedData = croppedImageData.data;
                for (let i = 0; i < croppedData.length; i += 4) {
                    // 如果像素不是纯黑（文字），则设为纯白（背景）
                    if (!(croppedData[i] === 0 && croppedData[i + 1] === 0 && croppedData[i + 2] === 0)) {
                        croppedData[i] = 255;     // R
                        croppedData[i + 1] = 255; // G
                        croppedData[i + 2] = 255; // B
                        croppedData[i + 3] = 255; // A
                    }
                }
                croppedCtx.putImageData(croppedImageData, 0, 0);
                
                return croppedCanvas.toDataURL('image/png', 1.0);
            }
        }
        
        // 如果没有检测到文字，返回处理后的原图（至少是二值化的白底）
        // 确保最终图片是白底
        const finalImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const finalData = finalImageData.data;
        for (let i = 0; i < finalData.length; i += 4) {
            // 如果像素不是纯黑（文字），则设为纯白（背景）
            if (!(finalData[i] === 0 && finalData[i + 1] === 0 && finalData[i + 2] === 0)) {
                finalData[i] = 255;
                finalData[i + 1] = 255;
                finalData[i + 2] = 255;
                finalData[i + 3] = 255;
            }
        }
        tempCtx.putImageData(finalImageData, 0, 0);
        
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
        this.ctx.lineWidth = 10; // 保持加粗笔迹
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
        const padding = Math.round(Math.min(width, height) * 0.025); // 约等于5%边距
        const size = Math.min(width, height) * this.GRID_RATIO_IN_CANVAS - padding * 2; // 田字格≈95%
        const x = (width - size) / 2;
        const y = (height - size) / 2;
        
        // 保存当前状态
        this.ctx.save();
        
        // 设置文字样式 - 使用楷体，撑满田字格
        const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
        this.ctx.fillStyle = isDark ? '#ffffff' : '#000000';
        // 使用楷体，字体大小约为田字格的80-90%，确保撑满
        const fontSize = size * 0.85;
        this.ctx.font = `bold ${fontSize}px "KaiTi", "Kaiti SC", "楷体", "STKaiti", "Songti SC", "Songti", "宋体", "SimSun", "Heiti SC", "黑体", "SimHei", serif`;
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
    const padding = Math.round(Math.min(width, height) * 0.025);
    const size = Math.min(width, height) * Handwriting.GRID_RATIO_IN_CANVAS - padding * 2;
    const x = (width - size) / 2;
    const y = (height - size) / 2;
    const ctx = this.ctx;
    
    // 清空背景（避免反复缩放导致残影）
    ctx.save();
    ctx.clearRect(0, 0, width, height);
    ctx.restore();
    
    // 去掉外边框，只绘制田字格内部虚线（增强对比度）
    // 绘制田字格的边界作为虚线（增强对比度）
    ctx.save();
    const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'light') === 'dark';
    // 增强虚线对比度：深色模式用更亮的灰色，浅色模式用更深的灰色
    ctx.strokeStyle = isDark ? '#6c757d' : '#868e96'; // 增强对比度
    ctx.lineWidth = 1.5; // 稍微加粗以增强对比度
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    // 竖线（从顶部到底部）
    ctx.moveTo(x + size / 2, y);
    ctx.lineTo(x + size / 2, y + size);
    // 横线（从左到右）
    ctx.moveTo(x, y + size / 2);
    ctx.lineTo(x + size, y + size / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // 绘制田字格外边框（使用虚线，增强对比度）
    ctx.strokeStyle = isDark ? '#6c757d' : '#868e96';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 4]); // 外边框用稍长的虚线
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
};
