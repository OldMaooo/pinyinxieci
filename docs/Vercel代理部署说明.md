# Vercel 代理部署说明

## 问题说明

GitHub Pages 只能托管静态文件，无法运行服务器端代码。因此，手写识别功能需要通过 Vercel Serverless Function 来代理百度 API。

## 部署步骤

### 1. 创建 Vercel 项目

1. 访问 [Vercel](https://vercel.com) 并登录（可以使用 GitHub 账号）
2. 点击 **"Add New..."** → **"Project"**
3. 导入你的 GitHub 仓库（`看拼音写词` 项目）

### 2. 配置环境变量

在 Vercel 项目设置中添加以下环境变量：

- `BAIDU_API_KEY`: 你的百度 AI 开放平台 API Key
- `BAIDU_SECRET_KEY`: 你的百度 AI 开放平台 Secret Key

**如何获取百度 API 密钥：**
1. 访问 [百度 AI 开放平台](https://ai.baidu.com/)
2. 登录后，进入 **控制台** → **应用管理**
3. 创建应用（选择"文字识别"服务）
4. 获取 `API Key` 和 `Secret Key`

### 3. 配置项目设置

在 Vercel 项目设置中：

- **Framework Preset**: 选择 "Other" 或 "Other (No Framework)"
- **Root Directory**: `./`（项目根目录）
- **Build Command**: （留空，这是纯前端项目）
- **Output Directory**: `./`（项目根目录）

### 4. 部署

点击 **"Deploy"**，Vercel 会自动：
1. 检测 `api/` 目录下的 Serverless Functions
2. 部署 `api/baidu-proxy.js` 作为 API 端点
3. 生成项目 URL（例如：`https://pinyinxieci.vercel.app`）

### 5. 更新 GitHub Pages 配置

部署完成后，获取 Vercel 项目 URL，然后在 GitHub Pages 应用中：

1. 打开应用，进入 **设置** → **识别服务配置**
2. 在 **代理地址** 中输入你的 Vercel URL（例如：`https://pinyinxieci.vercel.app`）
3. 保存设置

或者，代码会自动检测 GitHub Pages 环境并尝试使用默认代理地址。

## 验证部署

### 测试 API 端点

访问以下 URL 应该返回 `{"ok":true,"message":"baidu-proxy ok"}`：

```
https://你的项目.vercel.app/api/baidu-proxy
```

### 在应用中测试

1. 打开 GitHub Pages 上的应用
2. 进入练习页面
3. 写一个字并提交
4. 查看浏览器控制台，确认识别请求是否成功

## 常见问题

### 1. API 返回 500 错误

**原因：** 环境变量未配置或配置错误

**解决：**
- 检查 Vercel 项目设置中的环境变量
- 确认 `BAIDU_API_KEY` 和 `BAIDU_SECRET_KEY` 已正确设置
- 重新部署项目

### 2. CORS 错误

**原因：** Vercel 函数未正确设置 CORS 头

**解决：**
- 检查 `api/baidu-proxy.js` 中的 CORS 配置
- 确认函数返回了正确的 CORS 头

### 3. 识别功能不可用

**原因：** 代理地址未配置或配置错误

**解决：**
- 在应用设置中配置正确的 Vercel 代理地址
- 确认代理地址格式为：`https://你的项目.vercel.app`（不带末尾斜杠）

## 更新代理

如果修改了 `api/baidu-proxy.js`：

1. 提交代码到 GitHub
2. Vercel 会自动检测并重新部署
3. 或者手动在 Vercel 控制台点击 **"Redeploy"**

## 注意事项

- Vercel 免费版有使用限制（每月 100GB 带宽，1000 次函数调用）
- 如果超出限制，考虑升级到付费版或使用其他代理方案
- 建议定期检查 Vercel 项目的使用情况

