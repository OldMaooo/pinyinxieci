# 检查 Vercel 项目状态

## 方法1：通过 Vercel 控制台（推荐）

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 登录你的账号
3. 找到项目 `pinyinxieci`（或你的项目名称）
4. 检查以下内容：

### 检查部署状态
- 进入项目 → **Deployments** 标签
- 查看最新部署的状态：
  - ✅ **Ready** = 部署成功
  - ⏳ **Building** = 正在构建
  - ❌ **Error** = 部署失败（点击查看错误日志）

### 检查环境变量
- 进入项目 → **Settings** → **Environment Variables**
- 确认以下变量已配置：
  - `BAIDU_API_KEY` = 你的百度 API Key
  - `BAIDU_SECRET_KEY` = 你的百度 Secret Key
- **重要**：确保环境变量已应用到 **Production** 环境

### 检查函数日志
- 进入项目 → **Deployments** → 点击最新部署
- 查看 **Functions** 标签
- 点击 `api/baidu-proxy` 函数
- 查看 **Logs** 标签，查看是否有错误信息

## 方法2：通过 API 测试

### 测试 GET 请求（健康检查）
```bash
curl https://pinyinxieci.vercel.app/api/baidu-proxy
```
应该返回：`{"ok":true,"message":"baidu-proxy ok"}`

### 测试 POST 请求（实际识别）
```bash
curl -X POST https://pinyinxieci.vercel.app/api/baidu-proxy \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"你的base64图片数据"}'
```

**可能的错误响应：**
- `{"error":"Missing BAIDU_API_KEY/BAIDU_SECRET_KEY"}` → 环境变量未配置
- `{"error":"Baidu token error: ..."}` → 百度 API 密钥错误
- `{"error_code":xxx,"error_msg":"..."}` → 百度 API 返回的错误

## 方法3：在应用中测试

1. 打开 GitHub Pages 上的应用
2. 进入 **设置** → **识别服务配置**
3. 点击 **"测试连接"** 按钮
4. 如果测试成功，尝试实际识别：
   - 进入练习页面
   - 写一个字并提交
   - 打开浏览器控制台（F12）查看错误信息

## 常见问题诊断

### 问题1：GET 成功但 POST 失败
**原因：** 环境变量未配置或配置错误
**解决：** 在 Vercel 控制台检查并配置环境变量

### 问题2：所有请求都超时
**原因：** 
- Vercel 项目被暂停或删除
- 网络连接问题
- 项目超出免费版限制
**解决：** 
- 检查 Vercel 控制台项目状态
- 检查使用量是否超出限制

### 问题3：返回 500 错误
**原因：** 
- 环境变量缺失
- 代码错误
- 百度 API 密钥无效
**解决：** 
- 查看 Vercel 函数日志
- 检查环境变量配置
- 验证百度 API 密钥是否有效

## 快速修复步骤

如果发现环境变量未配置：

1. **登录 Vercel 控制台**
2. **进入项目设置** → **Environment Variables**
3. **添加环境变量：**
   - Name: `BAIDU_API_KEY`
   - Value: 你的百度 API Key
   - Environment: 选择 **Production**（必须）
4. **添加第二个环境变量：**
   - Name: `BAIDU_SECRET_KEY`
   - Value: 你的百度 Secret Key
   - Environment: 选择 **Production**（必须）
5. **重新部署：**
   - 点击 **Deployments** → 最新部署 → **Redeploy**
   - 或推送代码到 GitHub 触发自动部署

## 验证修复

部署完成后，等待 1-2 分钟，然后：
1. 在应用中点击 **"测试连接"**
2. 尝试实际识别一个字
3. 查看浏览器控制台确认没有错误

