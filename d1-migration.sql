-- D1数据库迁移脚本 - 添加公开博客功能
-- 为现有memos表添加is_public字段

-- 添加is_public字段（如果不存在）
-- 0 = 私有，1 = 公开
ALTER TABLE memos ADD COLUMN is_public INTEGER DEFAULT 0;

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_memos_is_public ON memos(is_public);
CREATE INDEX IF NOT EXISTS idx_memos_public_created_at ON memos(is_public, created_at);