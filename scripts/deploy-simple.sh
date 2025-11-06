#!/bin/bash
# 快速部署脚本 - 推送到GitHub

echo "🚀 开始部署看拼音写词应用到GitHub..."

cd "$(dirname "$0")"

# 检查git状态
if [ ! -d ".git" ]; then
    echo "❌ 错误：未找到Git仓库"
    exit 1
fi

# 检查远程仓库
if ! git remote get-url origin > /dev/null 2>&1; then
    echo ""
    echo "⚠️  未设置远程仓库"
    echo ""
    echo "请先运行："
    echo "  git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"
    echo ""
    echo "然后再次运行此脚本"
    exit 1
fi

# 添加所有更改
echo "📦 添加文件..."
git add .

# 检查是否有更改
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ 没有需要提交的更改"
else
    echo "📝 提交更改..."
    git commit -m "Update: $(date '+%Y-%m-%d %H:%M:%S')"
fi

# 推送到GitHub
echo "📤 推送到GitHub..."
git push origin main

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 代码已推送到GitHub！"
    echo ""
    echo "🎉 GitHub Actions会自动部署到GitHub Pages"
    echo ""
    echo "📋 下一步："
    echo "1. 访问你的GitHub仓库"
    echo "2. 进入 Settings > Pages"
    echo "3. 确保 Source 设置为 'GitHub Actions'"
    echo "4. 等待几分钟，应用将自动部署"
    echo ""
    REMOTE_URL=$(git remote get-url origin)
    if [[ $REMOTE_URL =~ github.com[:/]([^/]+)/([^/]+)\.git ]]; then
        USERNAME="${BASH_REMATCH[1]}"
        REPO="${BASH_REMATCH[2]}"
        echo "🌐 部署完成后，应用将在以下地址可用："
        echo "   https://${USERNAME}.github.io/${REPO}/"
    fi
else
    echo "❌ 推送失败，请检查错误信息"
    exit 1
fi

