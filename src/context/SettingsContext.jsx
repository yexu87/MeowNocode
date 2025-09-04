import React, { createContext, useContext, useState, useEffect } from 'react';
import { DatabaseService } from '@/lib/database';
import { D1DatabaseService } from '@/lib/d1';
import { D1ApiClient } from '@/lib/d1-api';
import { useAuth } from './AuthContext';
import { getDeletedMemoTombstones, removeDeletedMemoTombstones } from '@/lib/utils';
import largeFileStorage from '@/lib/largeFileStorage';
import { toast } from 'sonner';

const SettingsContext = createContext();

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }) {
  const { user } = useAuth();
  const [hitokotoConfig, setHitokotoConfig] = useState({
    enabled: true,
    types: ['a', 'b', 'c', 'd', 'i', 'j', 'k'] // 默认全选
  });
  const [fontConfig, setFontConfig] = useState({
    selectedFont: 'default' // default, jinghua, lxgw, kongshan
  });
  const [backgroundConfig, setBackgroundConfig] = useState({
    imageUrl: '',
    brightness: 50, // 0-100
  blur: 10, // 0-50 磨砂玻璃程度
  useRandom: false // 是否使用随机背景
  });
  const [avatarConfig, setAvatarConfig] = useState({
    imageUrl: '' // 用户自定义头像URL
  });
  const [cloudSyncEnabled, setCloudSyncEnabled] = useState(false);
  const [cloudProvider, setCloudProvider] = useState('supabase'); // 'supabase' 或 'd1'
  const [aiConfig, setAiConfig] = useState({
    baseUrl: '',
    apiKey: '',
    model: 'gpt-3.5-turbo',
    enabled: false
  });

  // 音乐功能配置（启动即从 localStorage 读取，避免初始空列表导致恢复失败）
  const [musicConfig, setMusicConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('musicConfig');
      return saved ? JSON.parse(saved) : { enabled: true, customSongs: [] };
    } catch {
      return { enabled: true, customSongs: [] };
    }
  });

  // S3存储配置
  const [s3Config, setS3Config] = useState({
    enabled: false,
    endpoint: '',
    accessKeyId: '',
    secretAccessKey: '',
    bucket: '',
    region: 'auto',
    publicUrl: '',
    provider: 'r2' // r2, s3, minio
  });

  const [keyboardShortcuts, setKeyboardShortcuts] = useState({
    toggleSidebar: 'Tab',
    openAIDialog: 'Ctrl+Space',
    openSettings: 'Ctrl+,',
  toggleCanvasMode: 'Ctrl+/',
  openDailyReview: 'Ctrl+\\'
  });

  // ---- Auto sync scheduler (debounced) ----
  const syncTimerRef = React.useRef(null);
  const hardTimerRef = React.useRef(null); // minimal interval limiter
  const syncingRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const lastSyncAtRef = React.useRef(0);

  const dispatchDataChanged = (detail = {}) => {
    try {
      window.dispatchEvent(new CustomEvent('app:dataChanged', { detail }));
    } catch {}
  };

  const doSync = React.useCallback(async () => {
    if (!cloudSyncEnabled) return;
    if (syncingRef.current) { pendingRef.current = true; return; }
    syncingRef.current = true;
    try {
      // 先下行：拉取云端，基于 lastCloudSyncAt 处理“远端删除”，避免本地旧数据回传导致复活
      const lastSyncAt = Number(localStorage.getItem('lastCloudSyncAt') || 0);
      let cloudMemos = [];
      if (cloudProvider === 'supabase') {
        if (user) {
          try { cloudMemos = await DatabaseService.getUserMemos(user.id); } catch {}
        }
      } else {
        try {
          const res = await D1ApiClient.restoreUserData();
          if (res?.success) {
            cloudMemos = (res.data?.memos || []).map(m => ({
              memo_id: m.memo_id,
              content: m.content,
              tags: JSON.parse(m.tags || '[]'),
              backlinks: JSON.parse(m.backlinks || '[]'),
              created_at: m.created_at,
              updated_at: m.updated_at
            }));
          } else {
            throw new Error('restore via API failed');
          }
        } catch {
          try {
            const ms = await D1DatabaseService.getAllMemos();
            cloudMemos = (ms || []).map(m => ({
              memo_id: m.memo_id,
              content: m.content,
              tags: JSON.parse(m.tags || '[]'),
              backlinks: JSON.parse(m.backlinks || '[]'),
              created_at: m.created_at,
              updated_at: m.updated_at
            }));
          } catch {}
        }
      }

      // 与本地对比并应用远端删除/更新/新增
      try {
  const localMemos = JSON.parse(localStorage.getItem('memos') || '[]');
  const pinned = JSON.parse(localStorage.getItem('pinnedMemos') || '[]');
  const pinnedMap = new Map((Array.isArray(pinned) ? pinned : []).map(m => [String(m.id), m]));
  const pinnedIds = new Set(Array.isArray(pinned) ? pinned.map(m => String(m.id)) : []);
        const localMap = new Map((localMemos || []).map(m => [String(m.id), m]));
        const cloudMap = new Map((cloudMemos || []).map(m => [String(m.memo_id), m]));
        
        // 获取当前的删除墓碑，避免恢复已标记删除的memo
        const tombstones = getDeletedMemoTombstones();
        const deletedSet = new Set((tombstones || []).map(t => String(t.id)));

        let changed = false;

        // 1) 远端不存在且本地更新时间 <= lastSyncAt -> 视为远端已删除，移除本地
        const keptLocal = [];
        const removedIds = [];
        for (const m of localMemos) {
          const id = String(m.id);
          // 若本地已标记删除，强制过滤掉，避免被下行合并回写复活
          if (deletedSet.has(id)) {
            removedIds.push(id);
            changed = true;
            continue;
          }
          if (cloudMap.has(id)) {
            keptLocal.push(m);
            continue;
          }
          const lRaw = m.updatedAt || m.lastModified || m.timestamp || m.createdAt || null;
          const lTime = lRaw ? new Date(lRaw).getTime() : NaN;
          if (!Number.isFinite(lTime) || lastSyncAt === 0 || lTime > lastSyncAt) {
            // 本地较新（可能离线新增/编辑），保留，待上行
            keptLocal.push(m);
          } else {
            // 远端删除，移除本地，避免“复活”
            removedIds.push(id);
            changed = true;
          }
        }

        // 2) 远端较新覆盖本地；远端新增补齐到本地
        const mergedById = new Map(keptLocal.map(m => [String(m.id), m]));
        let pinnedChanged = false;
        for (const [id, cm] of cloudMap.entries()) {
          // 跳过已标记删除的memo，避免恢复
          if (deletedSet.has(id)) {
            continue;
          }
          // 若该 memo 当前在本地处于置顶，则仅更新置顶数据，不回灌到 memos 列表，避免 pin 操作被下行合并“打回”
          if (pinnedIds.has(id)) {
            const pm = pinnedMap.get(id);
            const pTime = new Date(pm?.updatedAt || pm?.lastModified || pm?.timestamp || pm?.createdAt || 0).getTime();
            const cTime = new Date(cm.updated_at || cm.created_at || 0).getTime();
            if (cTime > pTime) {
              pinnedMap.set(id, {
                ...pm,
                content: cm.content,
                tags: cm.tags || [],
                backlinks: cm.backlinks || [],
                updatedAt: cm.updated_at,
                lastModified: cm.updated_at
              });
              pinnedChanged = true;
            }
            continue;
          }
          
          const lm = mergedById.get(id);
          const cTime = new Date(cm.updated_at || cm.created_at || 0).getTime();
          if (!lm) {
            // 本地没有，直接拉取进来
            mergedById.set(id, {
              id,
              content: cm.content,
              tags: cm.tags || [],
              backlinks: cm.backlinks || [],
              createdAt: cm.created_at,
              updatedAt: cm.updated_at,
              timestamp: cm.created_at,
              lastModified: cm.updated_at
            });
            changed = true;
          } else {
            const lTime = new Date(lm.updatedAt || lm.lastModified || lm.timestamp || lm.createdAt || 0).getTime();
            if (cTime > lTime) {
              // 云端较新，覆盖
              mergedById.set(id, {
                ...lm,
                content: cm.content,
                tags: cm.tags || [],
                backlinks: cm.backlinks || [],
                updatedAt: cm.updated_at,
                lastModified: cm.updated_at
              });
              changed = true;
            }
          }
        }

        if (changed) {
          const merged = Array.from(mergedById.values()).map(m => ({
            ...m,
            backlinks: Array.isArray(m.backlinks) ? m.backlinks : []
          })).sort((a, b) => new Date(b.createdAt || b.timestamp || 0) - new Date(a.createdAt || a.timestamp || 0));
          localStorage.setItem('memos', JSON.stringify(merged));
          if (removedIds.length && Array.isArray(pinned)) {
            const removedSet = new Set(removedIds.map(String));
            const nextPinned = pinned.filter((p) => {
              const pid = (p && typeof p === 'object') ? p.id : p;
              return !removedSet.has(String(pid));
            });
            if (nextPinned.length !== pinned.length) {
              localStorage.setItem('pinnedMemos', JSON.stringify(nextPinned));
            }
          }
          // 通知页面刷新本地缓存
          try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'sync.downmerge' } })); } catch {}
        }
        if (pinnedChanged) {
          const nextPinnedArr = Array.from(pinnedMap.values());
          localStorage.setItem('pinnedMemos', JSON.stringify(nextPinnedArr));
          try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'sync.downmerge' } })); } catch {}
        }
      } catch {
        // 忽略下行合并失败，继续尽力上行
      }

      // 再进行上行同步（upsert settings & memos）
      if (cloudProvider === 'supabase') {
        if (!user) return; // need auth
        await DatabaseService.syncUserData(user.id);
      } else {
        // d1
        await (async () => {
          // 优先 API 客户端，失败降级
          try {
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
              musicConfig: JSON.parse(localStorage.getItem('musicConfig') || '{"enabled":true,"customSongs":[]}')
            };
            await D1ApiClient.syncUserData(localData);
          } catch (_) {
            await D1DatabaseService.syncUserData();
          }
        })();
      }

      // 然后处理删除墓碑，推送云端删除
      const tombstones = getDeletedMemoTombstones();
      if (tombstones && tombstones.length) {
        const ids = tombstones.map(t => t.id);
        if (cloudProvider === 'supabase') {
          if (user) {
            for (const id of ids) {
              try { await DatabaseService.deleteMemo(user.id, id); } catch {}
            }
          }
        } else {
          for (const id of ids) {
            try { await D1ApiClient.deleteMemo(id); } catch { try { await D1DatabaseService.deleteMemo(id); } catch {} }
          }
        }
        removeDeletedMemoTombstones(ids);
      }
  lastSyncAtRef.current = Date.now();
      localStorage.setItem('lastCloudSyncAt', String(lastSyncAtRef.current));
    } finally {
      syncingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        // chain another run after a short delay to batch rapid changes
        clearTimeout(syncTimerRef.current);
        syncTimerRef.current = setTimeout(doSync, 500);
      }
    }
  }, [cloudSyncEnabled, cloudProvider, user]);

  const scheduleSync = React.useCallback((reason = 'change') => {
    if (!cloudSyncEnabled) return;
    // minimal interval 1500ms
    const now = Date.now();
    const since = now - lastSyncAtRef.current;
    // debounce immediate timer
    clearTimeout(syncTimerRef.current);
    const delay = since < 1500 ? 800 : 200; // small delay when not recently synced
    syncTimerRef.current = setTimeout(doSync, delay);
  }, [cloudSyncEnabled, doSync]);

  useEffect(() => {
    // 从localStorage加载一言设置
    const savedHitokotoConfig = localStorage.getItem('hitokotoConfig');
    if (savedHitokotoConfig) {
      try {
        setHitokotoConfig(JSON.parse(savedHitokotoConfig));
      } catch (error) {
        console.warn('Failed to parse Hitokoto config:', error);
      }
    }

    // 从localStorage加载字体设置
    const savedFontConfig = localStorage.getItem('fontConfig');
    if (savedFontConfig) {
      try {
        setFontConfig(JSON.parse(savedFontConfig));
      } catch (error) {
        console.warn('Failed to parse Font config:', error);
      }
    }

    // 从localStorage加载背景设置
  const savedBackgroundConfig = localStorage.getItem('backgroundConfig');
    if (savedBackgroundConfig) {
      try {
    const parsed = JSON.parse(savedBackgroundConfig);
    // 兼容旧版本缺少 useRandom/blur/brightness/imageUrl 字段
    setBackgroundConfig({ imageUrl: '', brightness: 50, blur: 10, useRandom: false, ...parsed });
      } catch (error) {
        console.warn('Failed to parse Background config:', error);
      }
    }

    // 从localStorage加载头像设置
    const savedAvatarConfig = localStorage.getItem('avatarConfig');
    if (savedAvatarConfig) {
      try {
        setAvatarConfig(JSON.parse(savedAvatarConfig));
      } catch (error) {
        console.warn('Failed to parse Avatar config:', error);
      }
    }

    // 从localStorage加载云端同步设置
    const savedCloudSyncEnabled = localStorage.getItem('cloudSyncEnabled');
    if (savedCloudSyncEnabled) {
      try {
        setCloudSyncEnabled(JSON.parse(savedCloudSyncEnabled));
      } catch (error) {
        console.warn('Failed to parse cloud sync config:', error);
      }
    }

    // 从localStorage加载云服务提供商设置
    const savedCloudProvider = localStorage.getItem('cloudProvider');
    if (savedCloudProvider) {
      try {
        setCloudProvider(savedCloudProvider);
      } catch (error) {
        console.warn('Failed to parse cloud provider config:', error);
      }
    }

  }, []);

  // 从localStorage加载S3配置
  useEffect(() => {
    try {
      const savedS3Config = localStorage.getItem('s3Config');
      if (savedS3Config) {
        const parsedConfig = JSON.parse(savedS3Config);
        setS3Config(parsedConfig);
        // 若配置已启用，则初始化 S3 客户端
        try {
          if (parsedConfig && parsedConfig.enabled) {
            const svc = require('@/lib/s3Storage').default;
            svc.init(parsedConfig);
          }
        } catch (e) {
          console.warn('Init S3 on load failed:', e);
        }
      }
    } catch (error) {
      console.warn('Failed to parse S3 config:', error);
    }
  }, []);

  // 从localStorage加载AI配置
  useEffect(() => {
    const savedAiConfig = localStorage.getItem('aiConfig');
    if (savedAiConfig) {
      try {
        setAiConfig(JSON.parse(savedAiConfig));
      } catch (error) {
        console.warn('Failed to parse AI config:', error);
      }
    }
  }, []);

  // 音乐配置已在初始化时读取，这里不再重复读取，避免覆盖正在编辑的状态

  // 从localStorage加载快捷键配置
  useEffect(() => {
    const savedKeyboardShortcuts = localStorage.getItem('keyboardShortcuts');
    if (savedKeyboardShortcuts) {
      try {
        setKeyboardShortcuts(JSON.parse(savedKeyboardShortcuts));
      } catch (error) {
        console.warn('Failed to parse keyboard shortcuts config:', error);
      }
    }
  }, []);



  useEffect(() => {
    // 保存一言设置到localStorage
    localStorage.setItem('hitokotoConfig', JSON.stringify(hitokotoConfig));
  dispatchDataChanged({ part: 'hitokoto' });
  }, [hitokotoConfig]);

  useEffect(() => {
    // 保存字体设置到localStorage
    localStorage.setItem('fontConfig', JSON.stringify(fontConfig));
  dispatchDataChanged({ part: 'font' });
  }, [fontConfig]);

  useEffect(() => {
    // 保存背景设置到localStorage（避免将巨大 data URL 直接写入）
    const persist = async () => {
      try {
        const cfg = backgroundConfig || {};
        const isDataUrl = typeof cfg.imageUrl === 'string' && cfg.imageUrl.startsWith('data:');
        const MAX_INLINE = 100_000; // ~100KB
        const tooLarge = isDataUrl && cfg.imageUrl.length > MAX_INLINE;

        let toSave = { ...cfg };

        if (tooLarge) {
          // 若无引用，先将 dataURL 存到 IndexedDB
          if (!toSave.imageRef || !toSave.imageRef.id) {
            try {
              const match = /^data:(.*?);base64,(.*)$/.exec(cfg.imageUrl || '');
              const mime = match ? (match[1] || 'image/png') : 'image/png';
              const base64Part = match ? match[2] : '';
              const approxSize = Math.floor(((cfg.imageUrl.length - (cfg.imageUrl.indexOf(',') + 1)) * 3) / 4);
              const stored = await largeFileStorage.storeFile({
                name: 'background-image',
                size: approxSize,
                type: mime,
                data: `data:${mime};base64,${base64Part}`,
              });
              toSave.imageRef = { id: stored.id, type: mime, storedAt: new Date().toISOString() };
            } catch (e) {
              console.warn('Store background image to IndexedDB failed:', e);
            }
          }
          // 避免写入巨大字符串
          toSave.imageUrl = '';
        }

        try {
          localStorage.setItem('backgroundConfig', JSON.stringify(toSave));
        } catch (err) {
          if (err && String(err.name || err).includes('QuotaExceededError')) {
            try {
              const minimal = { ...toSave, imageUrl: '' };
              localStorage.setItem('backgroundConfig', JSON.stringify(minimal));
              toast.error('本地存储空间不足，已停止缓存大图。建议使用外链或随机背景。');
            } catch {}
          } else {
            throw err;
          }
        }
      } finally {
        dispatchDataChanged({ part: 'background' });
      }
    };
    try { persist(); } catch {}
  }, [backgroundConfig]);

  // 如存在 IndexedDB 引用且 imageUrl 为空，则尝试在内存中恢复图片数据（不写回 localStorage）
  useEffect(() => {
    const recover = async () => {
      try {
        const ref = backgroundConfig?.imageRef;
        if (!ref || backgroundConfig?.imageUrl) return;
        const file = await largeFileStorage.getFile(ref.id);
        if (file && file.data) {
          setBackgroundConfig(prev => ({ ...prev, imageUrl: file.data }));
        }
      } catch (e) {
        console.warn('Recover background image failed:', e);
      }
    };
    try { recover(); } catch {}
  }, [backgroundConfig?.imageRef, backgroundConfig?.imageUrl]);

  useEffect(() => {
    // 保存头像设置到localStorage
    localStorage.setItem('avatarConfig', JSON.stringify(avatarConfig));
  dispatchDataChanged({ part: 'avatar' });
  }, [avatarConfig]);

  useEffect(() => {
    // 保存云端同步设置到localStorage
    localStorage.setItem('cloudSyncEnabled', JSON.stringify(cloudSyncEnabled));
  }, [cloudSyncEnabled]);

  useEffect(() => {
    // 保存云服务提供商设置到localStorage
    localStorage.setItem('cloudProvider', cloudProvider);
  }, [cloudProvider]);


  useEffect(() => {
    // 保存AI配置到localStorage
    localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
  dispatchDataChanged({ part: 'ai' });
  }, [aiConfig]);

  useEffect(() => {
    // 保存快捷键配置到localStorage
    localStorage.setItem('keyboardShortcuts', JSON.stringify(keyboardShortcuts));
  }, [keyboardShortcuts]);

  // 保存音乐配置
  useEffect(() => {
    localStorage.setItem('musicConfig', JSON.stringify(musicConfig));
    dispatchDataChanged({ part: 'music' });
  }, [musicConfig]);

  // 保存S3配置
  useEffect(() => {
    localStorage.setItem('s3Config', JSON.stringify(s3Config));
    dispatchDataChanged({ part: 's3' });
    // 若开启则保证运行期已初始化
    try {
      const svc = require('@/lib/s3Storage').default;
      if (s3Config && s3Config.enabled) {
        svc.init(s3Config);
      }
    } catch (e) {
      // 仅日志，不打断设置保存
      console.warn('Init S3 on change failed:', e);
    }
  }, [s3Config]);

  // Subscribe to app-level data change events and page lifecycle to auto sync
  useEffect(() => {
    if (!cloudSyncEnabled) return;
    const onChange = () => scheduleSync('event');
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // try flush quickly when tab hidden
        doSync();
      }
    };
    const onBeforeUnload = () => {
      // best-effort flush
      try { doSync(); } catch {}
    };
    window.addEventListener('app:dataChanged', onChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onBeforeUnload);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('app:dataChanged', onChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onBeforeUnload);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [cloudSyncEnabled, scheduleSync, doSync]);

  // Try restore on startup (even if cloud sync disabled) when local is empty
  useEffect(() => {
    const maybeRestore = async () => {
      try {
        const memos = JSON.parse(localStorage.getItem('memos') || '[]');
        const pinned = JSON.parse(localStorage.getItem('pinnedMemos') || '[]');
        const hasLocal = (Array.isArray(memos) && memos.length > 0) || (Array.isArray(pinned) && pinned.length > 0);
        if (hasLocal) {
          // 仍然进行一次快速同步，保证云端跟上当前设备
          if (cloudSyncEnabled) scheduleSync('startup');
          return;
        }
        if (cloudProvider === 'supabase') {
          if (!user) return; // need auth to restore
          await DatabaseService.restoreUserData(user.id);
          try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'restore.supabase' } })); } catch {}
        } else {
          try {
            const res = await D1ApiClient.restoreUserData();
            if (!res?.success) throw new Error('restore via API failed');
            try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'restore.d1.api' } })); } catch {}
          } catch (_) {
            await D1DatabaseService.restoreUserData();
            try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'restore.d1.db' } })); } catch {}
          }
        }
        // after restore, schedule a push to ensure any local-only fields are upserted formats
        if (cloudSyncEnabled) scheduleSync('post-restore');
      } catch (e) {
        // ignore in auto flow
      }
    };
    maybeRestore();
  }, [cloudSyncEnabled, cloudProvider, user, scheduleSync]);

  // 统一“手动同步”按钮逻辑：云 -> 本地 合并 -> 云
  const manualSync = async () => {
    try {
  const lastSyncAt = Number(localStorage.getItem('lastCloudSyncAt') || 0);
      const local = {
        memos: JSON.parse(localStorage.getItem('memos') || '[]'),
        pinnedMemos: JSON.parse(localStorage.getItem('pinnedMemos') || '[]'),
        themeColor: localStorage.getItem('themeColor') || '#818CF8',
        darkMode: localStorage.getItem('darkMode') || 'false',
        hitokotoConfig: JSON.parse(localStorage.getItem('hitokotoConfig') || '{"enabled":true,"types":["a","b","c","d","i","j","k"]}'),
        fontConfig: JSON.parse(localStorage.getItem('fontConfig') || '{"selectedFont":"default"}'),
  backgroundConfig: JSON.parse(localStorage.getItem('backgroundConfig') || '{"imageUrl":"","brightness":50,"blur":10,"useRandom":false}'),
        avatarConfig: JSON.parse(localStorage.getItem('avatarConfig') || '{"imageUrl":""}'),
        canvasConfig: JSON.parse(localStorage.getItem('canvasState') || 'null'),
        musicConfig: JSON.parse(localStorage.getItem('musicConfig') || '{"enabled":true,"customSongs":[]}')
      };

      // 拉取云端
  let cloudMemos = [];
  let cloudSettings = null;
      if (cloudProvider === 'supabase') {
        if (!user) throw new Error('请先登录');
        cloudMemos = await DatabaseService.getUserMemos(user.id);
        cloudSettings = await DatabaseService.getUserSettings(user.id);
      } else {
        try {
          const res = await D1ApiClient.restoreUserData();
          if (res?.success) {
            cloudMemos = (res.data?.memos || []).map(m => ({
              memo_id: m.memo_id,
              content: m.content,
              tags: JSON.parse(m.tags || '[]'),
              backlinks: JSON.parse(m.backlinks || '[]'),
              created_at: m.created_at,
              updated_at: m.updated_at
            }));
            cloudSettings = res.data?.settings || null;
          } else {
            throw new Error(res?.message || 'D1恢复失败');
          }
        } catch (_) {
          const memos = await D1DatabaseService.getAllMemos();
          const settings = await D1DatabaseService.getUserSettings();
          cloudMemos = (memos || []).map(m => ({
            memo_id: m.memo_id,
            content: m.content,
            tags: JSON.parse(m.tags || '[]'),
            backlinks: JSON.parse(m.backlinks || '[]'),
            created_at: m.created_at,
            updated_at: m.updated_at
          }));
          cloudSettings = settings || null;
        }
      }

      // 合并
      const localMap = new Map((local.memos || []).map(m => [String(m.id), m]));
      const cloudMap = new Map((cloudMemos || []).map(m => [String(m.memo_id), m]));
      const tombstones = getDeletedMemoTombstones();
      const deletedSet = new Set((tombstones || []).map(t => String(t.id)));
      const merged = [];
      const ids = new Set([...localMap.keys(), ...cloudMap.keys()]);
      ids.forEach(id => {
        if (deletedSet.has(id)) return;
        const l = localMap.get(id);
        const c = cloudMap.get(id);
        if (l && c) {
          const lTime = new Date(l.updatedAt || l.lastModified || l.createdAt || l.timestamp || 0).getTime();
          const cTime = new Date(c.updated_at || c.created_at || 0).getTime();
          if (lTime >= cTime) {
            merged.push(l);
          } else {
            merged.push({ id, content: c.content, tags: c.tags || [], backlinks: c.backlinks || [], createdAt: c.created_at, updatedAt: c.updated_at, timestamp: c.created_at, lastModified: c.updated_at });
          }
        } else if (l && !c) {
          // 云端无该 memo：若无法判断本地时间（新建未带时间戳）或 lastSyncAt 为 0，则保留；
          // 否则若本地更新时间不晚于 lastSyncAt，视为“云端已删除”，不再复活
          const lRaw = l.updatedAt || l.lastModified || l.timestamp || l.createdAt || null;
          const lTime = lRaw ? new Date(lRaw).getTime() : NaN;
          if (!Number.isFinite(lTime) || lastSyncAt === 0 || lTime > lastSyncAt) {
            merged.push(l);
          }
        } else if (!l && c) {
          merged.push({ id, content: c.content, tags: c.tags || [], backlinks: c.backlinks || [], createdAt: c.created_at, updatedAt: c.updated_at, timestamp: c.created_at, lastModified: c.updated_at });
        }
      });

  localStorage.setItem('memos', JSON.stringify(merged.map(m => ({ ...m, backlinks: Array.isArray(m.backlinks) ? m.backlinks : [] }))));

      // 清理被删除的置顶引用
      try {
        const mergedIds = new Set(merged.map(m => String(m.id)));
        const pinned = Array.isArray(local.pinnedMemos) ? local.pinnedMemos : [];
        const nextPinned = pinned.filter((p) => {
          const pid = (p && typeof p === 'object') ? p.id : p;
          return mergedIds.has(String(pid));
        });
        if (nextPinned.length !== pinned.length) {
          localStorage.setItem('pinnedMemos', JSON.stringify(nextPinned));
        }
      } catch {}

      const mergedSettings = {
        pinnedMemos: local.pinnedMemos,
        themeColor: local.themeColor,
        darkMode: local.darkMode,
        hitokotoConfig: local.hitokotoConfig,
        fontConfig: local.fontConfig,
        backgroundConfig: local.backgroundConfig,
        avatarConfig: local.avatarConfig,
        canvasConfig: local.canvasConfig,
        musicConfig: local.musicConfig,
        s3Config: JSON.parse(localStorage.getItem('s3Config') || '{"enabled":false,"endpoint":"","accessKeyId":"","secretAccessKey":"","bucket":"","region":"auto","publicUrl":"","provider":"r2"}')
      };
      if (cloudSettings) {
        const asObj = (v, fallback) => {
          if (v == null) return fallback;
          if (typeof v === 'string') {
            const t = v.trim();
            if (!t) return fallback;
            try { return JSON.parse(t); } catch { return fallback; }
          }
          return v;
        };
        mergedSettings.pinnedMemos = local.pinnedMemos?.length ? local.pinnedMemos : asObj(cloudSettings.pinned_memos, []);
        mergedSettings.themeColor = local.themeColor || cloudSettings.theme_color || '#818CF8';
        mergedSettings.darkMode = local.darkMode ?? (cloudSettings.dark_mode != null ? String(!!cloudSettings.dark_mode) : 'false');
        mergedSettings.hitokotoConfig = local.hitokotoConfig || asObj(cloudSettings.hitokoto_config, { enabled: true, types: ["a","b","c","d","i","j","k"] });
        mergedSettings.fontConfig = local.fontConfig || asObj(cloudSettings.font_config, { selectedFont: 'default' });
  mergedSettings.backgroundConfig = local.backgroundConfig || asObj(cloudSettings.background_config, { imageUrl: '', brightness: 50, blur: 10, useRandom: false });
        mergedSettings.avatarConfig = local.avatarConfig || asObj(cloudSettings.avatar_config, { imageUrl: '' });
        mergedSettings.canvasConfig = local.canvasConfig ?? asObj(cloudSettings.canvas_config, null);
        mergedSettings.musicConfig = local.musicConfig || asObj(cloudSettings.music_config, { enabled: true, customSongs: [] });
        mergedSettings.s3Config = mergedSettings.s3Config || asObj(cloudSettings.s3_config, { enabled: false, endpoint: '', accessKeyId: '', secretAccessKey: '', bucket: '', region: 'auto', publicUrl: '', provider: 'r2' });
      }
      localStorage.setItem('pinnedMemos', JSON.stringify(mergedSettings.pinnedMemos || []));
      localStorage.setItem('themeColor', mergedSettings.themeColor || '#818CF8');
      localStorage.setItem('darkMode', mergedSettings.darkMode ?? 'false');
      localStorage.setItem('hitokotoConfig', JSON.stringify(mergedSettings.hitokotoConfig || { enabled: true, types: ["a","b","c","d","i","j","k"] }));
      localStorage.setItem('fontConfig', JSON.stringify(mergedSettings.fontConfig || { selectedFont: 'default' }));
  localStorage.setItem('backgroundConfig', JSON.stringify(mergedSettings.backgroundConfig || { imageUrl: '', brightness: 50, blur: 10, useRandom: false }));
      localStorage.setItem('avatarConfig', JSON.stringify(mergedSettings.avatarConfig || { imageUrl: '' }));
      if (mergedSettings.canvasConfig != null) localStorage.setItem('canvasState', JSON.stringify(mergedSettings.canvasConfig));
      localStorage.setItem('musicConfig', JSON.stringify(mergedSettings.musicConfig || { enabled: true, customSongs: [] }));
  localStorage.setItem('s3Config', JSON.stringify(mergedSettings.s3Config || { enabled: false, endpoint: '', accessKeyId: '', secretAccessKey: '', bucket: '', region: 'auto', publicUrl: '', provider: 'r2' }));

      // 删除墓碑
      const toDeleteIds = Array.from(deletedSet);
      if (cloudProvider === 'supabase') {
        if (!user) throw new Error('请先登录');
        for (const id of toDeleteIds) {
          try { await DatabaseService.deleteMemo(user.id, id); } catch {}
        }
        for (const memo of merged) {
          await DatabaseService.upsertMemo(user.id, memo);
        }
  await DatabaseService.upsertUserSettings(user.id, mergedSettings);
      } else {
        for (const id of toDeleteIds) {
          try { await D1ApiClient.deleteMemo(id); } catch { try { await D1DatabaseService.deleteMemo(id); } catch {} }
        }
        for (const memo of merged) {
          try { await D1ApiClient.upsertMemo(memo); } catch { await D1DatabaseService.upsertMemo(memo); }
        }
        try { await D1ApiClient.upsertUserSettings(mergedSettings); } catch { await D1DatabaseService.upsertUserSettings(mergedSettings); }
      }
      removeDeletedMemoTombstones(toDeleteIds);
      localStorage.setItem('lastCloudSyncAt', String(Date.now()));
      try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'manualSync' } })); } catch {}
      return { success: true, message: '同步完成' };
    } catch (e) {
      return { success: false, message: e?.message || '同步失败' };
    }
  };



  const updateHitokotoConfig = (newConfig) => {
    setHitokotoConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateFontConfig = (newConfig) => {
    setFontConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateBackgroundConfig = (newConfig) => {
    setBackgroundConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateAvatarConfig = (newConfig) => {
    setAvatarConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateCloudSyncEnabled = (enabled) => {
    setCloudSyncEnabled(enabled);
  };

  const updateCloudProvider = (provider) => {
    try {
      setCloudProvider(provider);
    } catch (error) {
      console.error('更新云服务提供商失败:', error);
      throw error;
    }
  };


  const updateAiConfig = (newConfig) => {
    setAiConfig(prev => ({ ...prev, ...newConfig }));
  };

  const updateKeyboardShortcuts = (newConfig) => {
    setKeyboardShortcuts(prev => ({ ...prev, ...newConfig }));
  };

  const updateMusicConfig = (newConfig) => {
    setMusicConfig(prev => ({ ...prev, ...newConfig }));
  };


  // Supabase同步功能
  const syncToSupabase = async () => {
    if (!user) {
      throw new Error('请先登录');
    }

    try {
      const result = await DatabaseService.syncUserData(user.id);
      return result;
    } catch (error) {
      console.error('同步到Supabase失败:', error);
      return { success: false, message: error.message };
    }
  };

  const restoreFromSupabase = async () => {
    if (!user) {
      throw new Error('请先登录');
    }

    try {
      const result = await DatabaseService.restoreUserData(user.id);
      return result;
    } catch (error) {
      console.error('从Supabase恢复失败:', error);
      return { success: false, message: error.message };
    }
  };

  // D1同步功能
  const syncToD1 = async () => {
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
  canvasConfig: JSON.parse(localStorage.getItem('canvasState') || 'null')
      };

      // 优先尝试使用API客户端（适用于Cloudflare Pages）
      try {
        const result = await D1ApiClient.syncUserData(localData);
        return result;
      } catch (apiError) {
        console.warn('D1 API客户端失败，尝试直接访问D1数据库:', apiError);
        
        // 如果API客户端失败，尝试直接访问D1数据库（适用于Cloudflare Workers）
        const result = await D1DatabaseService.syncUserData();
        return result;
      }
    } catch (error) {
      console.error('同步到D1失败:', error);
      return { success: false, message: error.message };
    }
  };

  const restoreFromD1 = async () => {
    try {
      // 优先尝试使用API客户端（适用于Cloudflare Pages）
      try {
        const result = await D1ApiClient.restoreUserData();
        
        if (result.success) {
          // 恢复到本地存储
          if (result.data.memos && result.data.memos.length > 0) {
            const localMemos = result.data.memos.map(memo => ({
              id: memo.memo_id,
              content: memo.content,
              tags: JSON.parse(memo.tags || '[]'),
              timestamp: memo.created_at,
              lastModified: memo.updated_at,
              createdAt: memo.created_at,
              updatedAt: memo.updated_at
            }));
            localStorage.setItem('memos', JSON.stringify(localMemos));
          }

          if (result.data.settings) {
            if (result.data.settings.pinned_memos) {
              localStorage.setItem('pinnedMemos', result.data.settings.pinned_memos);
            }
            if (result.data.settings.theme_color) {
              localStorage.setItem('themeColor', result.data.settings.theme_color);
            }
            if (result.data.settings.dark_mode !== null) {
              localStorage.setItem('darkMode', result.data.settings.dark_mode.toString());
            }
            if (result.data.settings.hitokoto_config) {
              localStorage.setItem('hitokotoConfig', result.data.settings.hitokoto_config);
            }
            if (result.data.settings.font_config) {
              localStorage.setItem('fontConfig', result.data.settings.font_config);
            }
            if (result.data.settings.background_config) {
              localStorage.setItem('backgroundConfig', result.data.settings.background_config);
            }
            if (result.data.settings.avatar_config) {
              localStorage.setItem('avatarConfig', result.data.settings.avatar_config);
            }
            if (result.data.settings.canvas_config) {
              localStorage.setItem('canvasState', result.data.settings.canvas_config);
            }
          }
          
          return { success: true, message: '从D1恢复数据成功，请刷新页面查看' };
        }
        
        throw new Error(result.message || '恢复数据失败');
      } catch (apiError) {
        console.warn('D1 API客户端失败，尝试直接访问D1数据库:', apiError);
        
        // 如果API客户端失败，尝试直接访问D1数据库（适用于Cloudflare Workers）
  const result = await D1DatabaseService.restoreUserData();
        return result;
      }
    } catch (error) {
      console.error('从D1恢复失败:', error);
      return { success: false, message: error.message };
    }
  };

  return (
    <SettingsContext.Provider value={{
      hitokotoConfig,
      updateHitokotoConfig,
      fontConfig,
      updateFontConfig,
      backgroundConfig,
      updateBackgroundConfig,
      avatarConfig,
      updateAvatarConfig,
      cloudSyncEnabled,
      updateCloudSyncEnabled,
      cloudProvider,
      updateCloudProvider,
      syncToSupabase,
      restoreFromSupabase,
      syncToD1,
      restoreFromD1,
      aiConfig,
      updateAiConfig,
      keyboardShortcuts,
  updateKeyboardShortcuts,
  manualSync,
  musicConfig,
  updateMusicConfig,
      s3Config,
      updateS3Config: setS3Config,
  // Sync public helpers
  _scheduleCloudSync: scheduleSync
    }}>
      {children}
    </SettingsContext.Provider>
  );
}
