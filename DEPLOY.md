# 部署指南

## 部署到 GitHub Pages

### 1. 创建GitHub仓库

1. 访问 [GitHub](https://github.com) 并登录
2. 点击右上角的 "+" 按钮，选择 "New repository"
3. 仓库名称建议：`chinese-handwriting-practice` 或 `看拼音写词`
4. 设置为 **Public**（GitHub Pages需要公开仓库）
5. 不要勾选 "Add a README file"（我们已经有了）
6. 点击 "Create repository"

### 2. 初始化并推送代码

```bash
cd "/Users/mao/Documents/Coding/Development/Projects/Web/看拼音写词"

# 初始化git（如果还没有）
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit: 看拼音写词应用"

# 添加远程仓库（替换YOUR_USERNAME为你的GitHub用户名）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送到main分支
git branch -M main
git push -u origin main
```

### 3. 启用GitHub Pages

1. 在GitHub仓库页面，点击 **Settings** 标签
2. 滚动到左侧菜单的 **Pages** 部分
3. 在 **Source** 下选择 **GitHub Actions**
4. GitHub Actions会自动部署（已经在 `.github/workflows/deploy.yml` 中配置）

### 4. 访问应用

部署完成后（通常几分钟），你的应用将在以下地址可用：
```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME
```

---

## ⚠️ 重要提示

### API CORS 问题

GitHub Pages 只能托管静态文件，**无法运行Node.js代理服务器**。

**解决方案：**

1. **使用服务端中转（推荐）**
   - 创建一个简单的后端服务（如使用 Vercel Serverless Functions）
   - 后端调用百度API，前端调用自己的服务

2. **使用浏览器扩展（仅开发测试）**
   - 安装CORS扩展（如"Allow CORS"）
   - 仅用于个人测试，不推荐生产环境

3. **使用其他部署平台**
   - **Vercel**: 支持静态文件和Serverless Functions
   - **Netlify**: 支持静态文件和Functions

### 部署时排除的文件

以下文件不会被部署到GitHub Pages：
- `proxy-server.js` - 本地代理服务器
- `start-proxy.sh` - 启动脚本
- `upload/` - 上传的PDF文件
- `*.md` - 文档文件
- `extract_pdf.py` - Python脚本
- `package.json` - Node.js依赖（不需要）

---

## 后续更新

每次更新代码后：

```bash
git add .
git commit -m "更新描述"
git push origin main
```

GitHub Actions会自动重新部署。

---

## 其他部署选项

### Vercel 部署（推荐，支持Serverless Functions）

1. 推送代码到GitHub（同上）
2. 访问 [Vercel](https://vercel.com) 并登录
3. 点击 "New Project"，导入GitHub仓库
4. 配置项目：
   - Framework Preset: Other
   - Build Command: （留空，这是纯前端）
   - Output Directory: `./`
5. 如果需要API代理，可以在 `api/` 目录下创建Serverless Functions
6. 点击 "Deploy"

### Netlify 部署

1. 推送代码到GitHub
2. 访问 [Netlify](https://netlify.com) 并登录
3. 点击 "New site from Git"
4. 选择 GitHub 并授权
5. 选择你的仓库
6. 配置构建设置：
   - Build command: （留空）
   - Publish directory: `./`
7. 点击 "Deploy site"

