-- 创建memos表
CREATE TABLE IF NOT EXISTS memos (
  id BIGSERIAL PRIMARY KEY,
  memo_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  tags JSONB DEFAULT '[]'::jsonb,
  backlinks JSONB DEFAULT '[]'::jsonb,
  audio_clips JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  UNIQUE(memo_id, user_id)
);

-- 创建用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  pinned_memos JSONB DEFAULT '[]'::jsonb,
  theme_color TEXT DEFAULT '#818CF8',
  dark_mode BOOLEAN DEFAULT false,
  hitokoto_config JSONB DEFAULT '{"enabled":true,"types":["a","b","c","d","i","j","k"]}'::jsonb,
  font_config JSONB DEFAULT '{"selectedFont":"default"}'::jsonb,
  background_config JSONB DEFAULT '{"imageUrl":"","brightness":50,"blur":10}'::jsonb,
  avatar_config JSONB DEFAULT '{"imageUrl":""}'::jsonb,
  canvas_config JSONB,
  music_config JSONB DEFAULT '{"enabled":true,"customSongs":[]}'::jsonb,
  s3_config JSONB DEFAULT '{"enabled":false,"endpoint":"","accessKeyId":"","secretAccessKey":"","bucket":"","region":"auto","publicUrl":"","provider":"r2"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_memos_user_id ON memos(user_id);
CREATE INDEX IF NOT EXISTS idx_memos_created_at ON memos(created_at);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 启用行级安全策略 (RLS)
ALTER TABLE memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略 - memos表
CREATE POLICY "Users can view their own memos" ON memos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memos" ON memos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memos" ON memos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memos" ON memos
  FOR DELETE USING (auth.uid() = user_id);

-- 创建RLS策略 - user_settings表
CREATE POLICY "Users can view their own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings" ON user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- 创建/更新触发器函数：仅在未显式提供 updated_at 时才自动更新时间
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  -- 对 INSERT：如果未提供 updated_at，则填充为 NOW()；若已提供则尊重客户端值
  IF TG_OP = 'INSERT' THEN
    IF NEW.updated_at IS NULL THEN
      NEW.updated_at = NOW();
    END IF;
  ELSE
    -- 对 UPDATE：仅当未提供或仍等于旧值时，才自动更新时间
    IF NEW.updated_at IS NULL OR NEW.updated_at = OLD.updated_at THEN
      NEW.updated_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- 为user_settings表创建触发器
CREATE TRIGGER update_user_settings_updated_at 
  BEFORE UPDATE ON user_settings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 为memos表创建触发器
CREATE TRIGGER update_memos_updated_at 
  BEFORE UPDATE ON memos 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
