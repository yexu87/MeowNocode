 // D1数据库API客户端，用于在Cloudflare Pages环境中访问D1数据库
export class D1ApiClient {
  static async getBaseUrl() {
    // 获取当前域名
    const currentUrl = window.location.origin;
    
    // 如果是在workers.dev或pages.dev域名下，使用相对路径
    if (currentUrl.includes('workers.dev') || currentUrl.includes('pages.dev')) {
      return '';
    }
    
    // 否则使用完整URL
    return currentUrl;
  }

  // 初始化数据库
  static async initDatabase() {
    try {
      const baseUrl = await this.getBaseUrl();
      const headers = {
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(`${baseUrl}/api/init`, {
        method: 'POST',
        headers,
      });
      
  const result = await response.json();
      return result;
    } catch (error) {
      console.error('初始化D1数据库失败:', error);
      return { success: false, message: error.message };
    }
  }

  // 同步用户数据到D1
  static async syncUserData(data) {
    try {
      const baseUrl = await this.getBaseUrl();
      
      // 同步memos
      for (const memo of data.memos) {
        await this.upsertMemo(memo);
      }

      // 同步用户设置
    await this.upsertUserSettings({
        pinnedMemos: data.pinnedMemos,
        themeColor: data.themeColor,
        darkMode: data.darkMode,
        hitokotoConfig: data.hitokotoConfig,
        fontConfig: data.fontConfig,
  backgroundConfig: data.backgroundConfig,
  avatarConfig: data.avatarConfig,
  canvasConfig: data.canvasConfig,
  musicConfig: data.musicConfig
      });

      return { success: true, message: '数据同步到D1成功' };
    } catch (error) {
      console.error('D1数据同步失败:', error);
      return { success: false, message: error.message };
    }
  }

  // 获取公开数据（游客模式使用）
  static async getPublicData() {
    try {
      const baseUrl = await this.getBaseUrl();

      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
      };

      // 获取公开memos
      const memosResponse = await fetch(`${baseUrl}/api/memos?public_only=true`, {
        method: 'GET',
        headers,
      });

      const memosResult = await memosResponse.json();

      if (!memosResult.success) {
        throw new Error(memosResult.message || '获取公开数据失败');
      }

      return {
        success: true,
        data: {
          memos: memosResult.data || [],
          settings: null // 游客模式不需要设置
        },
        message: '获取公开数据成功'
      };
    } catch (error) {
      console.error('获取公开数据失败:', error);
      return { success: false, message: error.message };
    }
  }

  // 从D1恢复用户数据
  static async restoreUserData() {
    try {
      const baseUrl = await this.getBaseUrl();
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // 获取memos
      const memosResponse = await fetch(`${baseUrl}/api/memos`, {
        method: 'GET',
        headers,
      });
      
      const memosResult = await memosResponse.json();
      
      // 获取用户设置
  const settingsResponse = await fetch(`${baseUrl}/api/settings`, {
        method: 'GET',
        headers,
      });
      
      const settingsResult = await settingsResponse.json();
      
      if (!memosResult.success || !settingsResult.success) {
        throw new Error(memosResult.message || settingsResult.message || '获取数据失败');
      }
      
  return {
        success: true,
        data: {
          memos: memosResult.data || [],
          settings: settingsResult.data
        },
        message: '从D1恢复数据成功'
      };
    } catch (error) {
      console.error('从D1恢复数据失败:', error);
      return { success: false, message: error.message };
    }
  }

  // 插入或更新memo
  static async upsertMemo(memo) {
    try {
      const baseUrl = await this.getBaseUrl();
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
      };
      
      // 确保时间戳不为空，使用当前时间作为备用
      const now = new Date().toISOString();
      const createdAt = memo.timestamp || now;
      const updatedAt = memo.lastModified || memo.timestamp || now;

      const response = await fetch(`${baseUrl}/api/memos`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          memo_id: memo.id,
          content: memo.content,
          tags: memo.tags || [],
          backlinks: Array.isArray(memo.backlinks) ? memo.backlinks : [],
          audio_clips: Array.isArray(memo.audioClips) ? memo.audioClips : [],
          is_public: memo.is_public ? 1 : 0, // 🔧 添加is_public字段
          created_at: createdAt,
          updated_at: updatedAt
        }),
      });
      
  const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '保存memo失败');
      }
      
      return result;
    } catch (error) {
      console.error('保存memo失败:', error);
      throw error;
    }
  }

  // 插入或更新用户设置
  static async upsertUserSettings(settings) {
    try {
      const baseUrl = await this.getBaseUrl();
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
      };
      
    const response = await fetch(`${baseUrl}/api/settings`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          pinned_memos: settings.pinnedMemos,
          theme_color: settings.themeColor,
          dark_mode: settings.darkMode === 'true',
          hitokoto_config: settings.hitokotoConfig,
          font_config: settings.fontConfig,
      background_config: settings.backgroundConfig,
      avatar_config: settings.avatarConfig,
  canvas_config: settings.canvasConfig,
  music_config: settings.musicConfig,
  s3_config: settings.s3Config
        }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '保存用户设置失败');
      }
      
      return result;
    } catch (error) {
      console.error('保存用户设置失败:', error);
      throw error;
    }
  }

  // 删除memo
  static async deleteMemo(memoId) {
    try {
      const baseUrl = await this.getBaseUrl();
      
      // 设置请求头
      const headers = {
        'Content-Type': 'application/json',
      };
      
      const response = await fetch(`${baseUrl}/api/memos?memoId=${memoId}`, {
        method: 'DELETE',
        headers,
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || '删除memo失败');
      }
      
      return result;
    } catch (error) {
      console.error('删除memo失败:', error);
      throw error;
    }
  }

  // 检查D1 API是否可用
  static async checkAvailability() {
    try {
      const baseUrl = await this.getBaseUrl();
      const apiUrl = `${baseUrl}/api/health`;
      console.log('正在检查D1 API可用性:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('API响应状态:', response.status, response.statusText);
      
      
      // 检查响应类型
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.error('API返回了非JSON响应:', contentType);
        const text = await response.text();
        console.error('响应内容:', text.substring(0, 200));
        return { available: false, requiresAuth: false };
      }
      
      const result = await response.json();
      console.log('API响应数据:', result);
      
      if (result.status === 'ok') {
        return { available: true, requiresAuth: false };
      }
      
      return { available: false, requiresAuth: false };
    } catch (error) {
      console.error('检查D1 API可用性失败:', error);
      return { available: false, requiresAuth: false };
    }
  }
}
