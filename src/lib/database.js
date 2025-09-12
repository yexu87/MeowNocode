import { supabase, TABLES } from './supabase'

// 数据同步服务
export class DatabaseService {
  // 同步用户数据到Supabase
  static async syncUserData(userId) {
    try {
      // 获取本地数据
      const localData = {
        memos: JSON.parse(localStorage.getItem('memos') || '[]'),
        pinnedMemos: JSON.parse(localStorage.getItem('pinnedMemos') || '[]'),
        themeColor: localStorage.getItem('themeColor') || '#818CF8',
        darkMode: localStorage.getItem('darkMode') || 'false',
        hitokotoConfig: JSON.parse(localStorage.getItem('hitokotoConfig') || '{"enabled":true,"types":["a","b","c","d","i","j","k"]}'),
        fontConfig: JSON.parse(localStorage.getItem('fontConfig') || '{"selectedFont":"default"}'),
  backgroundConfig: JSON.parse(localStorage.getItem('backgroundConfig') || '{"imageUrl":"","brightness":50,"blur":10,"useRandom":false}'),
  avatarConfig: JSON.parse(localStorage.getItem('avatarConfig') || '{"imageUrl":""}'),
  canvasConfig: JSON.parse(localStorage.getItem('canvasState') || 'null'),
  musicConfig: JSON.parse(localStorage.getItem('musicConfig') || '{"enabled":true,"customSongs":[]}'),
  s3Config: JSON.parse(localStorage.getItem('s3Config') || '{"enabled":false,"endpoint":"","accessKeyId":"","secretAccessKey":"","bucket":"","region":"auto","publicUrl":"","provider":"r2"}')
      }

      // 同步memos
      for (const memo of localData.memos) {
        await this.upsertMemo(userId, memo)
      }

      // 同步用户设置
      await this.upsertUserSettings(userId, {
        pinnedMemos: localData.pinnedMemos,
        themeColor: localData.themeColor,
        darkMode: localData.darkMode,
        hitokotoConfig: localData.hitokotoConfig,
        fontConfig: localData.fontConfig,
  backgroundConfig: localData.backgroundConfig,
  avatarConfig: localData.avatarConfig,
  canvasConfig: localData.canvasConfig,
  musicConfig: localData.musicConfig,
  s3Config: localData.s3Config
      })

      return { success: true, message: '数据同步成功' }
    } catch (error) {
      console.error('数据同步失败:', error)
      return { success: false, message: error.message }
    }
  }

  // 从Supabase恢复用户数据
  static async restoreUserData(userId) {
    try {
      // 获取用户的memos
      const { data: memos, error: memosError } = await supabase
        .from(TABLES.MEMOS)
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (memosError) throw memosError

      // 获取用户设置
      const { data: settings, error: settingsError } = await supabase
        .from(TABLES.USER_SETTINGS)
        .select('*')
        .eq('user_id', userId)
        .single()

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError
      }

      // 恢复到本地存储
      if (memos && memos.length > 0) {
        const localMemos = memos.map(memo => ({
          id: memo.memo_id,
          content: memo.content,
          tags: memo.tags || [],
          backlinks: memo.backlinks || [],
          audioClips: memo.audio_clips || [],
          timestamp: memo.created_at,
          lastModified: memo.updated_at,
          createdAt: memo.created_at,
          updatedAt: memo.updated_at
        }))
        localStorage.setItem('memos', JSON.stringify(localMemos))
      }

      if (settings) {
        if (settings.pinned_memos) {
          localStorage.setItem('pinnedMemos', JSON.stringify(settings.pinned_memos))
        }
        if (settings.theme_color) {
          localStorage.setItem('themeColor', settings.theme_color)
        }
        if (settings.dark_mode !== null) {
          localStorage.setItem('darkMode', settings.dark_mode.toString())
        }
        if (settings.hitokoto_config) {
          localStorage.setItem('hitokotoConfig', JSON.stringify(settings.hitokoto_config))
        }
        if (settings.font_config) {
          localStorage.setItem('fontConfig', JSON.stringify(settings.font_config))
        }
        if (settings.background_config) {
          localStorage.setItem('backgroundConfig', JSON.stringify(settings.background_config))
        }
        if (settings.avatar_config) {
          localStorage.setItem('avatarConfig', JSON.stringify(settings.avatar_config))
        }
        if (settings.canvas_config) {
          localStorage.setItem('canvasState', JSON.stringify(settings.canvas_config))
        }
        if (settings.music_config) {
          localStorage.setItem('musicConfig', JSON.stringify(settings.music_config))
        }
    if (settings.s3_config) {
          localStorage.setItem('s3Config', JSON.stringify(settings.s3_config))
        }
      }

      return { success: true, message: '数据恢复成功，请刷新页面查看' }
    } catch (error) {
      console.error('数据恢复失败:', error)
      return { success: false, message: error.message }
    }
  }

  // 插入或更新memo
  static async upsertMemo(userId, memo) {
    // 确保时间戳不为空，使用当前时间作为备用
    const now = new Date().toISOString()
    const createdAt = memo.createdAt || memo.timestamp || now
    const updatedAt = memo.updatedAt || memo.lastModified || memo.timestamp || now

    // 变更检测：若远端已有相同 memo，则仅在内容/字段发生变化时才更新，避免无用更新导致 updated_at 被重写
    const { data: existing, error: fetchErr } = await supabase
      .from(TABLES.MEMOS)
      .select('content,tags,backlinks,audio_clips,created_at,updated_at')
      .eq('user_id', userId)
      .eq('memo_id', memo.id)
      .maybeSingle()

    if (fetchErr && fetchErr.code !== 'PGRST116') {
      // 查询错误（非未找到），抛出
      throw fetchErr
    }

    const payload = {
      memo_id: memo.id,
      user_id: userId,
      content: memo.content,
      tags: memo.tags || [],
      backlinks: Array.isArray(memo.backlinks) ? memo.backlinks : [],
      audio_clips: Array.isArray(memo.audioClips) ? memo.audioClips : [],
      created_at: createdAt,
      updated_at: updatedAt
    }

    if (existing) {
      const sameContent = (existing.content || '') === (memo.content || '')
      const normalizeArr = (v) => Array.isArray(v) ? v : []
      const sameTags = JSON.stringify(normalizeArr(existing.tags)) === JSON.stringify(normalizeArr(memo.tags))
      const sameBacklinks = JSON.stringify(normalizeArr(existing.backlinks)) === JSON.stringify(normalizeArr(memo.backlinks))
      const sameAudio = JSON.stringify(normalizeArr(existing.audio_clips)) === JSON.stringify(normalizeArr(memo.audioClips))

      // 若主要字段均无变化，则跳过更新，避免无意义地触发 updated_at
      if (sameContent && sameTags && sameBacklinks && sameAudio) {
        return existing
      }
    }

    const { data, error } = await supabase
      .from(TABLES.MEMOS)
      .upsert(payload, { onConflict: 'memo_id,user_id' })

    if (error) throw error
    return data
  }

  // 插入或更新用户设置
  static async upsertUserSettings(userId, settings) {
    const { data, error } = await supabase
      .from(TABLES.USER_SETTINGS)
      .upsert({
        user_id: userId,
        pinned_memos: settings.pinnedMemos,
        theme_color: settings.themeColor,
    dark_mode: String(settings.darkMode) === 'true',
        hitokoto_config: settings.hitokotoConfig,
        font_config: settings.fontConfig,
  background_config: settings.backgroundConfig,
  avatar_config: settings.avatarConfig,
  canvas_config: settings.canvasConfig,
  music_config: settings.musicConfig,
  s3_config: settings.s3Config,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })

    if (error) throw error
    return data
  }

  // 删除memo
  static async deleteMemo(userId, memoId) {
    const { data, error } = await supabase
      .from(TABLES.MEMOS)
      .delete()
      .eq('user_id', userId)
      .eq('memo_id', memoId)

    if (error) throw error
    return data
  }

  // 获取用户的所有memos
  static async getUserMemos(userId) {
    const { data, error } = await supabase
      .from(TABLES.MEMOS)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  // 获取用户设置
  static async getUserSettings(userId) {
    const { data, error } = await supabase
      .from(TABLES.USER_SETTINGS)
      .select('*')
      .eq('user_id', userId)
      .single()

    if (error && error.code !== 'PGRST116') throw error
    return data
  }
}
