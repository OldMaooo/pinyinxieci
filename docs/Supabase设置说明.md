# Supabase 云端同步设置说明

## 概述

本项目已集成 Supabase 云端同步功能，支持在 iPad 和 Mac 设备之间同步以下数据：
- 字的掌握状态（已掌握/错题/未练习）
- 错题记录
- 复习计划
- 任务清单

## 设置步骤

### 1. 创建 Supabase 项目

1. 访问 [Supabase](https://supabase.com/)
2. 注册/登录账号
3. 点击 "New Project" 创建新项目
4. 填写项目信息：
   - **Name**: 看拼音写词（或任意名称）
   - **Database Password**: 设置数据库密码（请妥善保存）
   - **Region**: 选择离你最近的区域（建议选择 `Southeast Asia (Singapore)` 或 `East Asia (Tokyo)`）
5. 等待项目创建完成（约 2 分钟）

### 2. 创建数据库表

在 Supabase Dashboard 中，进入 **SQL Editor**，执行以下 SQL 语句：

```sql
-- 创建用户数据表（单用户模式）
CREATE TABLE IF NOT EXISTS user_data (
    id TEXT PRIMARY KEY DEFAULT 'single_user',
    sync_data JSONB NOT NULL DEFAULT '{}',
    last_sync_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_data_updated_at BEFORE UPDATE ON user_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 启用 Row Level Security (RLS)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 创建策略：允许匿名用户读取和写入（单用户模式）
CREATE POLICY "Allow anonymous access for single user" ON user_data
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### 3. 获取 API 配置信息

1. 在 Supabase Dashboard 中，进入 **Settings** → **API**
2. 找到以下信息：
   - **Project URL**: 例如 `https://xxxxx.supabase.co`
   - **anon public key**: 例如 `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 4. 配置项目

打开 `js/config.js` 文件，填入你的 Supabase 配置：

```javascript
// Supabase 配置（单用户模式）
supabase: {
    url: 'https://xxxxx.supabase.co', // 替换为你的 Project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // 替换为你的 anon public key
},
```

### 5. 测试同步功能

1. 在 Mac 上打开应用，点击首页的 **「云端同步」** 按钮
2. 如果配置正确，会显示 "同步成功"
3. 在 iPad 上打开应用，点击 **「云端同步」** 按钮
4. 数据应该会自动同步到 iPad

## 使用说明

### 云端同步按钮

- **云端同步**（主按钮）：智能合并模式
  - 先上传本地数据到云端
  - 下载云端数据
  - 合并到本地
  - 再次上传合并后的数据
  - 确保两端数据一致

- **上传**（小按钮）：仅上传本地数据到云端
- **下载**（小按钮）：仅从云端下载数据并合并到本地

### 同步状态显示

- 同步按钮下方会显示当前状态
- 最后同步时间会显示在状态下方

## 注意事项

1. **单用户模式**：当前实现为单用户模式，所有设备共享同一份数据
2. **数据合并策略**：
   - 掌握状态：云端数据会覆盖本地数据（相同 wordId）
   - 错题：合并模式会保留所有错题记录
   - 任务清单：合并模式会保留所有任务（去重）
3. **网络要求**：同步功能需要网络连接
4. **数据安全**：Supabase 使用 HTTPS 加密传输，数据存储在云端数据库

## 故障排查

### 问题：提示 "Supabase 配置未设置"

**解决方案**：检查 `js/config.js` 中的 `supabase.url` 和 `supabase.anonKey` 是否已正确填写

### 问题：提示 "Supabase 客户端库未加载"

**解决方案**：检查网络连接，确保 Supabase CDN 可以访问

### 问题：同步失败，提示权限错误

**解决方案**：
1. 检查 Supabase Dashboard 中的 RLS 策略是否正确设置
2. 确认 `anon public key` 是否正确
3. 检查 SQL 策略是否允许匿名访问

### 问题：数据没有同步

**解决方案**：
1. 检查浏览器控制台是否有错误信息
2. 确认网络连接正常
3. 尝试先点击「上传」，再点击「下载」进行手动同步

## 数据格式

同步的数据格式与 `Storage.exportSyncData()` 返回的格式一致：

```json
{
    "version": "1.1",
    "type": "sync",
    "exportDate": "2025-12-01T10:00:00.000Z",
    "wordMastery": {
        "word_001": "mastered",
        "word_002": "error"
    },
    "errorWords": [...],
    "reviewPlans": [...],
    "taskList": [...]
}
```

## 技术支持

如有问题，请检查：
1. 浏览器控制台的错误信息
2. Supabase Dashboard 中的日志
3. 网络连接状态

