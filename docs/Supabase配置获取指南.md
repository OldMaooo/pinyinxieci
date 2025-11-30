# Supabase URL 和 anonKey 获取指南

## 什么是 Supabase URL 和 anonKey？

### Supabase URL（项目 URL）
- **作用**：这是你的 Supabase 项目的唯一地址，用于连接到你的云端数据库
- **格式**：`https://xxxxx.supabase.co`
- **示例**：`https://abcdefghijklmnop.supabase.co`
- **说明**：每个 Supabase 项目都有唯一的 URL，类似于你的数据库服务器地址

### anonKey（匿名密钥）
- **作用**：这是 Supabase 提供的公开 API 密钥，用于在客户端（浏览器）中访问数据库
- **格式**：一个很长的字符串，以 `eyJ` 开头
- **示例**：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
- **说明**：
  - 这是**公开密钥**，可以安全地放在前端代码中
  - 它受到 Row Level Security (RLS) 策略保护，只能访问你允许的数据
  - 不要与 `service_role` 密钥混淆（那个是服务端密钥，有完全权限，不能放在前端）

## 如何获取这两个值？

### 步骤 1：登录 Supabase

1. 访问 [https://supabase.com](https://supabase.com)
2. 点击右上角 **"Sign In"** 登录（如果没有账号，先注册）
3. 登录后，你会看到你的项目列表

### 步骤 2：创建项目（如果还没有）

1. 点击 **"New Project"** 按钮
2. 填写项目信息：
   - **Name**：项目名称（例如：`看拼音写词`）
   - **Database Password**：设置数据库密码（**请务必记住这个密码！**）
   - **Region**：选择区域（建议选择 `Southeast Asia (Singapore)` 或 `East Asia (Tokyo)`，离中国较近）
3. 点击 **"Create new project"**
4. 等待项目创建完成（约 2 分钟）

### 步骤 3：获取 URL 和 anonKey

1. 在项目列表中，点击你刚创建的项目
2. 进入项目 Dashboard（控制台）
3. 点击左侧菜单栏的 **"Settings"**（设置图标 ⚙️）
4. 在 Settings 页面中，点击 **"API"** 标签页
5. 在 API 页面中，你会看到：

   ```
   Project URL
   https://xxxxx.supabase.co
   
   anon public
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

6. **复制这两个值**：
   - **Project URL**：这就是 `Supabase URL`
   - **anon public**：这就是 `anonKey`

### 步骤 4：在应用中配置

#### 方式一：页面配置（推荐）
1. 打开应用首页
2. 展开「数据导入导出」区域
3. 点击齿轮图标 ⚙️
4. 在「项目 URL」输入框中粘贴你的 Supabase URL
5. 在「匿名密钥」输入框中粘贴你的 anonKey
6. 点击「保存配置」

#### 方式二：浏览器控制台
打开浏览器控制台（F12），执行：
```javascript
Config.saveSupabase({
    url: "https://你的项目ID.supabase.co",
    anonKey: "你的anonKey"
});
```

## 配置示例

假设你的 Supabase 项目信息如下：
- **Project URL**: `https://abcdefghijklmnop.supabase.co`
- **anon public**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

那么在页面配置时：
- **项目 URL** 输入框填写：`https://abcdefghijklmnop.supabase.co`
- **匿名密钥** 输入框填写：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

## 重要提示

1. **anonKey 是公开的**：这个密钥可以安全地放在前端代码中，因为：
   - 它受到 RLS（行级安全）策略保护
   - 只能访问你明确允许的数据
   - 不能执行危险操作（如删除表、修改表结构等）

2. **不要泄露 service_role 密钥**：
   - 在 API 页面中，你还会看到 `service_role` 密钥
   - **千万不要**把这个密钥放在前端代码中！
   - 它拥有完全权限，只能用于服务端

3. **配置后测试**：
   - 配置完成后，点击「云端同步」按钮测试
   - 如果配置正确，会显示「同步成功」
   - 如果配置错误，会显示错误信息

## 常见问题

### Q: 我找不到 API 页面？
A: 确保你已经登录 Supabase，并且已经创建了项目。API 设置在 Settings → API 标签页中。

### Q: anonKey 太长了，复制不全？
A: 点击 anonKey 旁边的复制按钮（📋 图标），会自动复制完整的密钥。

### Q: 配置后还是提示"配置未设置"？
A: 
1. 检查是否点击了「保存配置」按钮
2. 检查浏览器控制台是否有错误
3. 尝试刷新页面后重新配置

### Q: 可以修改配置吗？
A: 可以，随时点击齿轮图标 ⚙️ 重新配置，新配置会覆盖旧配置。

## 下一步

配置完成后，记得：
1. 执行 SQL 脚本创建数据库表（参考 `Supabase设置说明.md`）
2. 测试同步功能
3. 在 iPad 和 Mac 上分别测试，确保数据能正常同步

