#!/bin/bash
# 启动代理服务器脚本

cd "$(dirname "$0")"

echo "🚀 正在启动代理服务器..."
echo "📍 服务器地址: http://localhost:3001"
echo ""
echo "💡 提示："
echo "   - 保持此窗口打开"
echo "   - 在浏览器中打开 index.html"
echo "   - 按 Ctrl+C 停止服务器"
echo ""

node proxy-server.js
