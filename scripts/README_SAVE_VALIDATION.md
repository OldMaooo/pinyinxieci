# Save Reliability Readonly Validation

这个脚本用于在上线前后做**只读校验**（不会写数据库）：
- 检查 `mastery_records` 总行数
- 生成确定性摘要 `digest`
- 输出头尾抽样数据
- 对比迁移前后是否出现非预期变更

## 1) 迁移前保存基线

```bash
node scripts/validate-mastery-readonly.mjs \
  --sample-size 20 \
  --save-baseline backups/mastery-baseline-before-migration.json
```

## 2) 执行 migration 后做对比

```bash
node scripts/validate-mastery-readonly.mjs \
  --sample-size 20 \
  --compare backups/mastery-baseline-before-migration.json
```

## 3) 返回码说明

- `0`：通过（无差异）
- `2`：检测到差异（added/removed/changed）
- `1`：脚本错误（环境变量或连接问题）

## 可选参数

- `--include-updated-at`：把 `updated_at` 纳入摘要。默认不纳入（避免仅时间字段变化导致误报）。

## ID 命名空间核对（`-test` 合并前后）

先执行只读核对脚本，确认 `-test` 数据规模与冲突样本：

```bash
node scripts/validate-id-namespace.mjs --sample-size 20
```

脚本会输出：
- `total_test_rows`
- `target_exists_rows` / `target_missing_rows`
- `test_wins_on_conflict` / `prod_wins_on_conflict`
- 冲突样本与缺失目标样本

执行合并 SQL：
- `scripts/migrations/merge-test-id-namespace.sql`

合并后再次执行同一核对脚本，确认正式 ID 已覆盖历史数据。
