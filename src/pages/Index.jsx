import React, { useState, useEffect, useRef, useCallback } from 'react';
import LeftSidebar from '@/components/LeftSidebar';
import RightSidebar from '@/components/RightSidebar';
import MainContent from '@/components/MainContent';
import CanvasMode from '@/components/CanvasMode';
import MobileSidebar from '@/components/MobileSidebar';
import SettingsCard from '@/components/SettingsCard';
import ShareDialog from '@/components/ShareDialog';
import AIButton from '@/components/AIButton';
import AIDialog from '@/components/AIDialog';
import DailyReview from '@/components/DailyReview';
import TutorialDialog from '@/components/TutorialDialog';
import MemoPreviewDialog from '@/components/MemoPreviewDialog';
import MusicModal from '@/components/MusicModal';
import MiniMusicPlayer from '@/components/MiniMusicPlayer';
import MusicSearchCard from '@/components/MusicSearchCard';
import { useSettings } from '@/context/SettingsContext';
import { addDeletedMemoTombstone } from '@/lib/utils';
import { toast } from 'sonner';

 const Index = () => {
  // State management
  const [memos, setMemos] = useState([]);
  const [newMemo, setNewMemo] = useState('');
  const [filteredMemos, setFilteredMemos] = useState([]);
  const [activeTag, setActiveTag] = useState(null);
  const [activeDate, setActiveDate] = useState(null); // 新增日期筛选状态
  const [heatmapData, setHeatmapData] = useState([]);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [pinnedMemos, setPinnedMemos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLeftSidebarHidden, setIsLeftSidebarHidden] = useState(false);
  const [isRightSidebarHidden, setIsRightSidebarHidden] = useState(false);
  const [isLeftSidebarPinned, setIsLeftSidebarPinned] = useState(true);
  const [isRightSidebarPinned, setIsRightSidebarPinned] = useState(true);
  const [isLeftSidebarHovered, setIsLeftSidebarHovered] = useState(false);
  const [isRightSidebarHovered, setIsRightSidebarHovered] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState(null);
  const [isEditorFocused, setIsEditorFocused] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [isCanvasMode, setIsCanvasMode] = useState(false);
  const [canvasToolPanelVisible, setCanvasToolPanelVisible] = useState(false);
  const [isDailyReviewOpen, setIsDailyReviewOpen] = useState(false);
  const [previewMemoId, setPreviewMemoId] = useState(null);
  const [pendingNewBacklinks, setPendingNewBacklinks] = useState([]);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [pendingNewAudioClips, setPendingNewAudioClips] = useState([]);
  // 音乐搜索卡片
  const [musicSearchOpen, setMusicSearchOpen] = useState(false);
  const [musicSearchKeyword, setMusicSearchKeyword] = useState('');
  const [musicModal, setMusicModal] = useState({
    isOpen: false,
    title: '鲜花',
    musicUrl: 'https://pic.oneloved.top/2025-08/回春丹 - 鲜花_1755699293512.flac',
    cover: '/images/xh.jpg',
    author: '回春丹',
    danmakuText: '好听',
    enableDanmaku: true,
  });

  // Refs
  const hoverTimerRef = useRef(null);
  const menuRefs = useRef({});
  const searchInputRef = useRef(null);
  const memosContainerRef = useRef(null);

  // Context
  const { backgroundConfig, updateBackgroundConfig, aiConfig, keyboardShortcuts, musicConfig } = useSettings();
  const [currentRandomBgUrl, setCurrentRandomBgUrl] = useState('');

  // 临时：如果没有音乐 URL，可使用浏览器可播放的示例音频占位（需用户在设置里替换真实地址）
  useEffect(() => {
    if (!musicModal.musicUrl) {
      setMusicModal((m) => ({
        ...m,
        musicUrl: 'https://file-examples.com/storage/fe9b7a6c9f3a8b2e9b0b8d3/2017/11/file_example_MP3_700KB.mp3',
      }));
    }
  }, []);

  // 控制移动端侧栏打开时的页面滚动
  useEffect(() => {
    if (isMobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileSidebarOpen]);

  // 处理左侧栏鼠标悬停事件（AI 对话或每日回顾打开时禁用）
  useEffect(() => {
    let hoverTimer;
    
    const handleMouseMove = (e) => {
      // 若鼠标位于禁止触发区域（如迷你播放器），不处理侧栏唤起
      if (e.target && (e.target.closest && e.target.closest('.sidebar-hover-block'))) {
        return;
      }
  if (canvasToolPanelVisible || isAIDialogOpen || isDailyReviewOpen || document.body.getAttribute('data-music-modal-open') === 'true') {
        // 工具面板可见时禁用左侧 hover 触发逻辑
        return;
      }
      if (!isLeftSidebarPinned) {
        if (e.clientX < 50) {
          // 清除之前的定时器
          if (hoverTimer) {
            clearTimeout(hoverTimer);
          }
          // 设置新的定时器，延迟显示侧栏
          hoverTimer = setTimeout(() => {
            setIsLeftSidebarHovered(true);
          }, 150);
        } else if (e.clientX > 350 && isLeftSidebarHovered) {
          // 清除之前的定时器
          if (hoverTimer) {
            clearTimeout(hoverTimer);
          }
          // 设置新的定时器，延迟隐藏侧栏
          hoverTimer = setTimeout(() => {
            setIsLeftSidebarHovered(false);
          }, 200);
        }
      }
    };

    if (!isLeftSidebarPinned && !isAIDialogOpen && !isDailyReviewOpen) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    };
  }, [isLeftSidebarPinned, isLeftSidebarHovered, canvasToolPanelVisible, isAIDialogOpen, isDailyReviewOpen]);

  // 处理右侧栏鼠标悬停事件（AI 对话或每日回顾打开时禁用）
  useEffect(() => {
    let hoverTimer;
    
    const handleMouseMove = (e) => {
      // 若鼠标位于禁止触发区域（如迷你播放器），不处理侧栏唤起
      if (e.target && (e.target.closest && e.target.closest('.sidebar-hover-block'))) {
        return;
      }
  if (isAIDialogOpen || isDailyReviewOpen || document.body.getAttribute('data-music-modal-open') === 'true') {
        return;
      }
      if (!isRightSidebarPinned) {
        if (e.clientX > window.innerWidth - 50) {
          // 清除之前的定时器
          if (hoverTimer) {
            clearTimeout(hoverTimer);
          }
          // 设置新的定时器，延迟显示侧栏
          hoverTimer = setTimeout(() => {
            setIsRightSidebarHovered(true);
          }, 150);
        } else if (e.clientX < window.innerWidth - 350 && isRightSidebarHovered) {
          // 清除之前的定时器
          if (hoverTimer) {
            clearTimeout(hoverTimer);
          }
          // 设置新的定时器，延迟隐藏侧栏
          hoverTimer = setTimeout(() => {
            setIsRightSidebarHovered(false);
          }, 200);
        }
      }
    };

    if (!isRightSidebarPinned && !isAIDialogOpen && !isDailyReviewOpen) {
      document.addEventListener('mousemove', handleMouseMove);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimer) {
        clearTimeout(hoverTimer);
      }
    };
  }, [isRightSidebarPinned, isRightSidebarHovered, isAIDialogOpen, isDailyReviewOpen]);

  // 当 AI 对话或每日回顾弹窗打开时，自动收起已唤出的悬浮侧栏（不影响固定侧栏）
  useEffect(() => {
    if (isAIDialogOpen || isDailyReviewOpen) {
      if (!isLeftSidebarPinned && isLeftSidebarHovered) {
        setIsLeftSidebarHovered(false);
      }
      if (!isRightSidebarPinned && isRightSidebarHovered) {
        setIsRightSidebarHovered(false);
      }
    }
  }, [isAIDialogOpen, isDailyReviewOpen, isLeftSidebarPinned, isRightSidebarPinned, isLeftSidebarHovered, isRightSidebarHovered]);

  // 监听memos列表滚动，控制回到顶部按钮显示
  useEffect(() => {
    const container = memosContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      setShowScrollToTop(container.scrollTop > 200);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // 回到顶部功能
  const scrollToTop = () => {
    if (memosContainerRef.current) {
      memosContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // 从localStorage加载数据
  useEffect(() => {
    const savedMemos = localStorage.getItem('memos');
    const savedPinned = localStorage.getItem('pinnedMemos');
    const savedLeftSidebarPinned = localStorage.getItem('isLeftSidebarPinned');
    const savedRightSidebarPinned = localStorage.getItem('isRightSidebarPinned');
    const savedCanvasMode = localStorage.getItem('isCanvasMode');
    const savedCanvasState = localStorage.getItem('canvasState');
    let memoPositions = {};
    try {
      if (savedCanvasState) {
        const st = JSON.parse(savedCanvasState);
        if (st && st.memoPositions && typeof st.memoPositions === 'object') memoPositions = st.memoPositions;
      }
    } catch {}
    
    if (savedMemos) {
      try {
        const parsedMemos = JSON.parse(savedMemos);
        const normalizedMemos = parsedMemos.map(memo => ({
          id: memo.id || Date.now() + Math.random(),
          content: memo.content || '',
          tags: memo.tags || [],
          timestamp: memo.timestamp || memo.createdAt || new Date().toISOString(),
          lastModified: memo.lastModified || memo.updatedAt || new Date().toISOString(),
          createdAt: memo.createdAt || memo.timestamp || new Date().toISOString(),
      updatedAt: memo.updatedAt || memo.lastModified || new Date().toISOString(),
      backlinks: Array.isArray(memo.backlinks) ? memo.backlinks : [],
      audioClips: Array.isArray(memo.audioClips) ? memo.audioClips : [],
      // 画布位置：优先使用 memo 自身保存的，退回到 canvasState.memoPositions
      canvasX: (typeof memo.canvasX === 'number' ? memo.canvasX : (memoPositions[memo.id]?.x)),
      canvasY: (typeof memo.canvasY === 'number' ? memo.canvasY : (memoPositions[memo.id]?.y))
        }));
        setMemos(normalizedMemos);
      } catch (e) {
        console.error('Failed to parse memos from localStorage', e);
      }
    }
    
    if (savedPinned) {
      try {
        setPinnedMemos(JSON.parse(savedPinned));
      } catch (e) {
        console.error('Failed to parse pinned memos from localStorage', e);
      }
    }

    if (savedCanvasMode !== null) {
      try {
        const canvasMode = JSON.parse(savedCanvasMode);
        setIsCanvasMode(canvasMode);
        
        // 如果处于画布模式，强制设置侧栏为非固定状态
        if (canvasMode) {
          setIsLeftSidebarPinned(false);
          setIsRightSidebarPinned(false);
        }
      } catch (e) {
        console.error('Failed to parse canvas mode state from localStorage', e);
      }
    }

    if (savedLeftSidebarPinned !== null) {
      try {
        // 只有在非画布模式下才加载侧栏固定状态
        if (!JSON.parse(localStorage.getItem('isCanvasMode') || 'false')) {
          setIsLeftSidebarPinned(JSON.parse(savedLeftSidebarPinned));
        }
      } catch (e) {
        console.error('Failed to parse left sidebar pinned state from localStorage', e);
      }
    }

    if (savedRightSidebarPinned !== null) {
      try {
        // 只有在非画布模式下才加载侧栏固定状态
        if (!JSON.parse(localStorage.getItem('isCanvasMode') || 'false')) {
          setIsRightSidebarPinned(JSON.parse(savedRightSidebarPinned));
        }
      } catch (e) {
        console.error('Failed to parse right sidebar pinned state from localStorage', e);
      }
    }
    
    // 设置应用已加载，避免初始动画
    setTimeout(() => {
      setIsAppLoaded(true);
      setIsInitialLoad(false);
    }, 100);
  }, []);

  // 监听全局数据变更与 storage 事件，感知 SettingsContext 的恢复/合并结果并刷新本地状态
  useEffect(() => {
    const loadFromLocal = () => {
      try {
        const savedMemos = localStorage.getItem('memos');
        const savedPinned = localStorage.getItem('pinnedMemos');
        const savedCanvasState = localStorage.getItem('canvasState');
        let memoPositions = {};
        try {
          if (savedCanvasState) {
            const st = JSON.parse(savedCanvasState);
            if (st && st.memoPositions && typeof st.memoPositions === 'object') memoPositions = st.memoPositions;
          }
        } catch {}
        if (savedMemos) {
          const parsedMemos = JSON.parse(savedMemos);
          const normalizedMemos = parsedMemos.map(memo => ({
            id: memo.id || Date.now() + Math.random(),
            content: memo.content || '',
            tags: memo.tags || [],
            timestamp: memo.timestamp || memo.createdAt || new Date().toISOString(),
            lastModified: memo.lastModified || memo.updatedAt || new Date().toISOString(),
            createdAt: memo.createdAt || memo.timestamp || new Date().toISOString(),
            updatedAt: memo.updatedAt || memo.lastModified || new Date().toISOString(),
            backlinks: Array.isArray(memo.backlinks) ? memo.backlinks : [],
            audioClips: Array.isArray(memo.audioClips) ? memo.audioClips : [],
            canvasX: (typeof memo.canvasX === 'number' ? memo.canvasX : (memoPositions[memo.id]?.x)),
            canvasY: (typeof memo.canvasY === 'number' ? memo.canvasY : (memoPositions[memo.id]?.y))
          }));
          // 仅在内容有变化时才更新，避免循环写入
          if (JSON.stringify(normalizedMemos) !== JSON.stringify(memos)) {
            setMemos(normalizedMemos);
          }
        }
        if (savedPinned) {
          const parsedPinned = JSON.parse(savedPinned);
          if (JSON.stringify(parsedPinned) !== JSON.stringify(pinnedMemos)) {
            setPinnedMemos(parsedPinned);
          }
        }
      } catch {}
    };

    const onDataChanged = (e) => {
      // 只在同步/恢复类事件时重新加载，避免本地操作(如删除)触发的事件导致状态闪烁
      const part = e?.detail?.part || '';
      if (part.includes('sync.') || part.includes('restore.') || part === 'startup') {
        loadFromLocal();
      }
    };
    const onStorage = (e) => {
      if (!e || (e.key !== 'memos' && e.key !== 'pinnedMemos' && e.key !== 'canvasState')) return;
      loadFromLocal();
    };
    window.addEventListener('app:dataChanged', onDataChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('app:dataChanged', onDataChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [memos, pinnedMemos]);

  // 将 memo 的位置信息写回到 canvasState.memoPositions（与 CanvasMode 的 shapes/viewport 持久化并存）
  useEffect(() => {
    try {
      const positions = {};
      [...memos, ...pinnedMemos].forEach(m => {
        if (m && typeof m.id !== 'undefined') {
          const x = typeof m.canvasX === 'number' ? m.canvasX : undefined;
          const y = typeof m.canvasY === 'number' ? m.canvasY : undefined;
          if (typeof x === 'number' && typeof y === 'number') {
            positions[m.id] = { x, y };
          }
        }
      });
      const raw = localStorage.getItem('canvasState');
      const prev = raw ? JSON.parse(raw) : {};
      const next = { ...prev, memoPositions: positions };
      localStorage.setItem('canvasState', JSON.stringify(next));
  // 通知全局数据变更（仅位置变化也会触发同步）
  try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'canvas.memoPositions' } })); } catch {}
    } catch {}
  }, [memos, pinnedMemos]);

  // 保存数据到localStorage
  useEffect(() => {
    localStorage.setItem('memos', JSON.stringify(memos));
    localStorage.setItem('pinnedMemos', JSON.stringify(pinnedMemos));
  // 通知全局数据变更
  try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'memos' } })); } catch {}
  }, [memos, pinnedMemos]);

  // 保存侧栏固定状态到localStorage - 画布模式下不保存
  useEffect(() => {
    if (!isCanvasMode) {
      localStorage.setItem('isLeftSidebarPinned', JSON.stringify(isLeftSidebarPinned));
    }
  }, [isLeftSidebarPinned, isCanvasMode]);

  useEffect(() => {
    if (!isCanvasMode) {
      localStorage.setItem('isRightSidebarPinned', JSON.stringify(isRightSidebarPinned));
    }
  }, [isRightSidebarPinned, isCanvasMode]);

  // 保存画布模式状态到localStorage
  useEffect(() => {
    localStorage.setItem('isCanvasMode', JSON.stringify(isCanvasMode));
    try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'canvas.mode' } })); } catch {}
  }, [isCanvasMode]);

  // 首次加载完成后强制发一个变更事件，便于自动同步在启动时感知
  useEffect(() => {
    if (!isInitialLoad) {
      try { window.dispatchEvent(new CustomEvent('app:dataChanged', { detail: { part: 'startup' } })); } catch {}
    }
  }, [isInitialLoad]);

  // 首次未查看则自动弹出教程（本地记录，不云同步）
  useEffect(() => {
    try {
      const seen = localStorage.getItem('hasSeenTutorialV1');
      if (!seen) {
        // 延迟打开，等主界面渲染稳定
        const t = setTimeout(() => setIsTutorialOpen(true), 300);
        return () => clearTimeout(t);
      }
    } catch {}
  }, []);

  // 添加新memo
  const addMemo = () => {
    if (newMemo.trim() === '') return;

    const extractedTags = [...newMemo.matchAll(/(?:^|\s)#([^\s#][\u4e00-\u9fa5a-zA-Z0-9_\/]*)/g)]
      .map(match => match[1])
      .filter((tag, index, self) => self.indexOf(tag) === index)
      .filter(tag => tag.length > 0);

    const newId = Date.now();
    const nowIso = new Date().toISOString();
    const newMemoObj = {
      id: newId,
      content: newMemo,
      tags: extractedTags,
      createdAt: nowIso,
      updatedAt: nowIso,
      timestamp: nowIso,
      lastModified: nowIso,
      backlinks: Array.isArray(pendingNewBacklinks) ? pendingNewBacklinks : [],
      audioClips: Array.isArray(pendingNewAudioClips) ? pendingNewAudioClips : []
    };

    // 更新现有 memos 与 pinnedMemos，将新 memoId 写入被选目标的 backlinks（双向）
    const addLink = (list) => list.map(m => (
      (pendingNewBacklinks || []).includes(m.id)
        ? { ...m, backlinks: Array.from(new Set([...(Array.isArray(m.backlinks) ? m.backlinks : []), newId])), updatedAt: nowIso }
        : m
    ));
    const updatedMemos = addLink(memos);
    const updatedPinned = addLink(pinnedMemos);

    setMemos([newMemoObj, ...updatedMemos]);
    setPinnedMemos(updatedPinned);
    setNewMemo('');
    setPendingNewBacklinks([]);
    setPendingNewAudioClips([]);
  };

  // 更新热力图数据
  useEffect(() => {
    const generateHeatmapData = () => {
      const data = [];
      const today = new Date();
      const memoCountByDate = {};
      
      [...memos, ...pinnedMemos].forEach(memo => {
        const createdAt = memo.createdAt || memo.timestamp || new Date().toISOString();
        const date = createdAt.split('T')[0];
        memoCountByDate[date] = (memoCountByDate[date] || 0) + 1;
      });
      
      for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        data.push({
          date: dateStr,
          count: memoCountByDate[dateStr] || 0
        });
      }
      
      return data;
    };
    
    setHeatmapData(generateHeatmapData());
  }, [memos, pinnedMemos]);

  // 统一筛选：标签 / 日期 / 搜索
  useEffect(() => {
    // 1) 基础：采用置顶 + 普通的并集，优先显示置顶（作为回退列表）
    let base = [...pinnedMemos, ...memos];

    if (activeTag) {
      base = base.filter(memo => {
        if (memo.tags?.includes(activeTag)) return true;
        if (!activeTag.includes('/')) {
          return memo.tags?.some(tag => tag.startsWith(activeTag + '/'));
        }
        return false;
      });
    }

    if (activeDate) {
      base = base.filter(memo => {
        const src = memo.createdAt || memo.timestamp || '';
        const memoDate = (typeof src === 'string' ? src : new Date(src).toISOString()).split('T')[0];
        return memoDate === activeDate;
      });
    }

    // 2) 关键词过滤：仅当有命中时采用；否则回退到 base
    const q = searchQuery.toLowerCase().trim();
    if (q) {
      const searched = base.filter(memo => {
        const contentHit = (memo.content || '').toLowerCase().includes(q);
        const tagsHit = Array.isArray(memo.tags) && memo.tags.some(tag => (tag || '').toLowerCase().includes(q));
        return contentHit || tagsHit;
      });

      // 如果没有任何命中，则保持 base（认为是“搜索歌曲”场景，memos 列表不变）
      setFilteredMemos(searched.length > 0 ? searched : base);
      return;
    }

    // 无关键词，直接使用 base
    setFilteredMemos(base);
  }, [memos, pinnedMemos, activeTag, activeDate, searchQuery]);

  // 处理菜单操作
  const handleMenuAction = (e, memoId, action) => {
    e.stopPropagation();

    switch (action) {
  case 'pin':
        const memoToPin = memos.find(memo => memo.id === memoId);
        if (memoToPin && !pinnedMemos.some(p => p.id === memoId)) {
          const pinnedMemo = {
            ...memoToPin,
            isPinned: true,
    pinnedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
          };
          setPinnedMemos([pinnedMemo, ...pinnedMemos]);
          setMemos(memos.filter(memo => memo.id !== memoId));
        }
        break;
      case 'unpin':
        const memoToUnpin = pinnedMemos.find(memo => memo.id === memoId);
        if (memoToUnpin) {
          const unpinnedMemo = { ...memoToUnpin, isPinned: false, updatedAt: new Date().toISOString(), lastModified: new Date().toISOString() };
          delete unpinnedMemo.pinnedAt;
          setMemos([unpinnedMemo, ...memos]);
          setPinnedMemos(pinnedMemos.filter(memo => memo.id !== memoId));
        }
        break;
      case 'edit':
        const memoToEdit = [...memos, ...pinnedMemos].find(memo => memo.id === memoId);
        if (memoToEdit) {
          setEditingId(memoId);
          setEditContent(memoToEdit.content);
        }
        break;
      case 'share':
        const memoToShare = [...memos, ...pinnedMemos].find(memo => memo.id === memoId);
        if (memoToShare) {
          setSelectedMemo(memoToShare);
          setIsShareDialogOpen(true);
        }
        break;
      case 'delete':
  // 先移除被删 memo
  const nextMemos = memos.filter(memo => memo.id !== memoId).map(m => ({
    ...m,
    backlinks: Array.isArray(m.backlinks) ? m.backlinks.filter(id => id !== memoId) : []
  }));
  const nextPinned = pinnedMemos.filter(memo => memo.id !== memoId).map(m => ({
    ...m,
    backlinks: Array.isArray(m.backlinks) ? m.backlinks.filter(id => id !== memoId) : []
  }));
  setMemos(nextMemos);
  setPinnedMemos(nextPinned);
  // 记录删除墓碑用于云端删除
  addDeletedMemoTombstone(memoId);
        break;
      default:
        break;
    }
    setActiveMenuId(null);
  };

  // 保存编辑
  const saveEdit = (memoId) => {
    const extractedTags = [...editContent.matchAll(/(?:^|\s)#([^\s#][\u4e00-\u9fa5a-zA-Z0-9_\/]*)/g)]
      .map(match => match[1])
      .filter((tag, index, self) => self.indexOf(tag) === index)
      .filter(tag => tag.length > 0);

    const updatedMemos = memos.map(memo =>
      memo.id === memoId ? {
        ...memo,
        content: editContent,
        tags: extractedTags,
        updatedAt: new Date().toISOString()
      } : memo
    );

    const updatedPinned = pinnedMemos.map(memo =>
      memo.id === memoId ? {
        ...memo,
        content: editContent,
        tags: extractedTags,
        updatedAt: new Date().toISOString()
      } : memo
    );

    setMemos(updatedMemos);
    setPinnedMemos(updatedPinned);
    setEditingId(null);
    setEditContent('');
  };

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  // 建立双链：在 from 和 to 的 backlinks 中互相加入，避免重复
  const handleAddBacklink = (fromId, toId) => {
    if (!toId) return;
    // 新建 memo（顶部编辑器）场景：fromId 为空，先把选中的 toId 放到待建列表
    if (!fromId) {
      setPendingNewBacklinks(prev => prev.includes(toId) ? prev : [...prev, toId]);
      return;
    }
    if (fromId === toId) return;
    const updateOne = (memo, targetId) => {
      const curr = Array.isArray(memo.backlinks) ? memo.backlinks : [];
      if (curr.includes(targetId)) return curr;
      return [...curr, targetId];
    };
    setMemos(prev => prev.map(m => {
      if (m.id === fromId) return { ...m, backlinks: updateOne(m, toId), updatedAt: new Date().toISOString() };
      if (m.id === toId) return { ...m, backlinks: updateOne(m, fromId), updatedAt: new Date().toISOString() };
      return m;
    }));
    setPinnedMemos(prev => prev.map(m => {
      if (m.id === fromId) return { ...m, backlinks: updateOne(m, toId), updatedAt: new Date().toISOString() };
      if (m.id === toId) return { ...m, backlinks: updateOne(m, fromId), updatedAt: new Date().toISOString() };
      return m;
    }));
  };

  // 移除双链：从双方的 backlinks 中互相删除；顶部新建时（fromId 为空）从待建列表删除
  const handleRemoveBacklink = (fromId, toId) => {
    if (!toId) return;
    if (!fromId) {
      setPendingNewBacklinks(prev => prev.filter(id => id !== toId));
      return;
    }
    if (fromId === toId) return;
    const prune = (list) => list.map(m => {
      if (m.id === fromId) return { ...m, backlinks: (Array.isArray(m.backlinks) ? m.backlinks.filter(id => id !== toId) : []), updatedAt: new Date().toISOString() };
      if (m.id === toId) return { ...m, backlinks: (Array.isArray(m.backlinks) ? m.backlinks.filter(id => id !== fromId) : []), updatedAt: new Date().toISOString() };
      return m;
    });
    setMemos(prev => prune(prev));
    setPinnedMemos(prev => prune(prev));
  };

  // 移除录音：fromId 为空表示新建 memo（移除待提交列表），否则从对应 memo 中移除下标 idx
  const handleRemoveAudioClip = (fromId, idx) => {
    if (typeof idx !== 'number') return;
    if (!fromId) {
      setPendingNewAudioClips((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    const removeFrom = (list) => list.map((m) => {
      if (m.id !== fromId) return m;
      const clips = Array.isArray(m.audioClips) ? m.audioClips : [];
      const nextClips = clips.filter((_, i) => i !== idx);
      return { ...m, audioClips: nextClips, updatedAt: new Date().toISOString(), lastModified: new Date().toISOString() };
    });
    setMemos((prev) => removeFrom(prev));
    setPinnedMemos((prev) => removeFrom(prev));
  };

  // 添加录音到某条 memo；fromId 为空表示当前是“新建 memo”编辑器，加入待提交列表
  const handleAddAudioClip = (fromId, clip) => {
    if (!clip) return;
    if (!fromId) {
      setPendingNewAudioClips(prev => [...prev, clip]);
      return;
    }
    const addTo = (list) => list.map(m => {
      if (m.id !== fromId) return m;
      const prev = Array.isArray(m.audioClips) ? m.audioClips : [];
      return { ...m, audioClips: [...prev, clip], updatedAt: new Date().toISOString(), lastModified: new Date().toISOString() };
    });
    setMemos(prev => addTo(prev));
    setPinnedMemos(prev => addTo(prev));
  };

  // 预览某条 memo
  const handlePreviewMemo = (memoId) => {
    setPreviewMemoId(memoId);
  };

  // 处理菜单容器的鼠标事件
  const handleMenuContainerEnter = (memoId) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    if (activeMenuId === memoId) {
      return;
    }

    hoverTimerRef.current = setTimeout(() => {
      setActiveMenuId(memoId);
    }, 300);
  };

  const handleMenuContainerLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }

    hoverTimerRef.current = setTimeout(() => {
      setActiveMenuId(null);
    }, 150);
  };

  // 处理点击菜单按钮
  const handleMenuButtonClick = (memoId) => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    setActiveMenuId(activeMenuId === memoId ? null : memoId);
  };

  // 点击页面其他区域关闭菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMenuId && menuRefs.current[activeMenuId]) {
        const menuElement = menuRefs.current[activeMenuId];
        if (!menuElement.contains(event.target)) {
          setActiveMenuId(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenuId]);

  // 添加Ctrl+K快捷键聚焦搜索框
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 画布模式切换函数
  const handleCanvasModeToggle = useCallback(() => {
    const newCanvasMode = !isCanvasMode;
    setIsCanvasMode(newCanvasMode);
    
    // 进入画布模式时自动取消固定侧栏
    if (newCanvasMode) {
      setIsLeftSidebarPinned(false);
      setIsRightSidebarPinned(false);
      toast.success('已进入画布模式，侧栏已自动取消固定');
    } else {
      toast.success('已退出画布模式');
    }
  }, [isCanvasMode]);

  // 自定义快捷键处理
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 避免在输入框中触发快捷键
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }
      
      // 如果正在录制快捷键，不触发快捷键功能
      if (e.target.closest('.shortcut-recording')) {
        return;
      }

      // 解析快捷键
      const parseShortcut = (shortcut) => {
        const parts = shortcut.split('+');
        const key = parts[parts.length - 1];
        const ctrlKey = parts.includes('Ctrl');
        const altKey = parts.includes('Alt');
        const shiftKey = parts.includes('Shift');
        
        // 处理特殊键名的映射
        const keyMap = {
          'Space': ' ',
          'Tab': 'Tab',
          'Enter': 'Enter',
          'Escape': 'Escape',
          'Backspace': 'Backspace',
          'Delete': 'Delete',
          'ArrowUp': 'ArrowUp',
          'ArrowDown': 'ArrowDown',
          'ArrowLeft': 'ArrowLeft',
          'ArrowRight': 'ArrowRight',
          'PageUp': 'PageUp',
          'PageDown': 'PageDown',
          'Home': 'Home',
          'End': 'End'
        };
        
        const mappedKey = keyMap[key] || key;
        
        return { key: mappedKey, ctrlKey, altKey, shiftKey };
      };

      // 检查快捷键是否匹配
      const checkShortcut = (shortcut) => {
        const { key, ctrlKey, altKey, shiftKey } = parseShortcut(shortcut);
        const eCtrlKey = e.ctrlKey || e.metaKey;
        
        return (
          e.key === key &&
          eCtrlKey === ctrlKey &&
          e.altKey === altKey &&
          e.shiftKey === shiftKey
        );
      };

      // 切换侧栏固定状态 - 画布模式下禁用
      if (checkShortcut(keyboardShortcuts.toggleSidebar)) {
        if (isCanvasMode) {
          e.preventDefault();
          toast.info('画布模式下不可固定侧栏');
          return;
        }
        e.preventDefault();
        setIsLeftSidebarPinned(!isLeftSidebarPinned);
        setIsRightSidebarPinned(!isRightSidebarPinned);
        toast.success(isLeftSidebarPinned ? '侧栏已取消固定' : '侧栏已固定');
      }

      // 打开/关闭AI对话
      if (checkShortcut(keyboardShortcuts.openAIDialog)) {
        e.preventDefault();
        setIsAIDialogOpen(prev => !prev);
        toast.success(isAIDialogOpen ? 'AI对话已关闭' : 'AI对话已打开');
      }

      // 打开设置
      if (checkShortcut(keyboardShortcuts.openSettings)) {
        e.preventDefault();
        setIsSettingsOpen(true);
        toast.success('设置已打开');
      }

      // 切换画布模式
      if (checkShortcut(keyboardShortcuts.toggleCanvasMode)) {
        e.preventDefault();
        handleCanvasModeToggle();
      }

      // 打开每日回顾
      if (checkShortcut(keyboardShortcuts.openDailyReview)) {
        e.preventDefault();
        setIsDailyReviewOpen(true);
        toast.success('每日回顾已打开');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLeftSidebarPinned, isRightSidebarPinned, isSettingsOpen, isAIDialogOpen, keyboardShortcuts, isCanvasMode, handleCanvasModeToggle]);

  // 处理热力图日期点击
  const handleDateClick = (dateStr) => {
    setActiveDate(dateStr === activeDate ? null : dateStr);
    // 清除标签筛选
    setActiveTag(null);
  };

  // 清除所有筛选条件
  const clearFilters = () => {
    setActiveTag(null);
    setActiveDate(null);
  };

  // 处理编辑器聚焦状态
  const handleEditorFocus = () => {
    setIsEditorFocused(true);
  };

  const handleEditorBlur = () => {
    setIsEditorFocused(false);
  };

  // AI续写功能
  const handleAIContinue = async () => {
    if (!newMemo.trim()) {
      toast.error('请先输入一些内容');
      return;
    }

    if (!aiConfig.enabled || !aiConfig.baseUrl || !aiConfig.apiKey) {
      toast.error('请先在设置中启用AI功能并配置API');
      return;
    }

    try {
      toast.loading('AI正在续写中...', { id: 'ai-continue' });
      
      // 确保 baseUrl 以 / 结尾，如果没有则添加
      const baseUrl = aiConfig.baseUrl.endsWith('/') ? aiConfig.baseUrl : aiConfig.baseUrl + '/';
      const url = `${baseUrl}chat/completions`;
      
            
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的写作助手，擅长续写用户的想法和笔记。请根据用户输入的内容，自然地续写下去，保持风格一致。不要重复用户已经说过的话，而是要在此基础上进行自然的延伸和扩展。'
            },
            {
              role: 'user',
              content: `请续写以下内容，保持原有风格和语调，不要重复原文：${newMemo}`
            }
          ],
          max_tokens: 800,
          temperature: 0.8,
          top_p: 0.9,
          frequency_penalty: 0.5,
          presence_penalty: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI请求失败:', errorData);
        console.error('响应状态:', response.status, response.statusText);
        throw new Error(errorData.error?.message || `AI请求失败 (${response.status})`);
      }

      const data = await response.json();
      
      // 检查响应数据结构
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('AI响应结构异常:', data);
        toast.error('AI响应结构异常', { id: 'ai-continue' });
        return;
      }
      
      const continuedText = data.choices[0].message.content;
      
      // 确保续写内容不为空且是字符串
      if (continuedText && typeof continuedText === 'string' && continuedText.trim()) {
        // 去除可能的换行符前缀和多余空格
        const trimmedContinuedText = continuedText.trim();
        
        // 将续写内容追加到原文后面，添加适当的连接
        const connector = newMemo.endsWith('。') || newMemo.endsWith('！') || newMemo.endsWith('？') ? ' ' : '';
        setNewMemo(prev => prev + connector + trimmedContinuedText);
        toast.success('AI续写完成', { id: 'ai-continue' });
      } else {
        console.error('AI返回内容为空或格式不正确:', continuedText);
        toast.error('AI返回内容为空', { id: 'ai-continue' });
      }
    } catch (error) {
      console.error('AI续写失败:', error);
      toast.error('AI续写失败，请检查API配置', { id: 'ai-continue' });
    }
  };

  // AI优化功能
  const handleAIOptimize = async () => {
    if (!newMemo.trim()) {
      toast.error('请先输入一些内容');
      return;
    }

    if (!aiConfig.enabled || !aiConfig.baseUrl || !aiConfig.apiKey) {
      toast.error('请先在设置中启用AI功能并配置API');
      return;
    }

    try {
      toast.loading('AI正在优化中...', { id: 'ai-optimize' });
      
      // 确保 baseUrl 以 / 结尾，如果没有则添加
      const baseUrl = aiConfig.baseUrl.endsWith('/') ? aiConfig.baseUrl : aiConfig.baseUrl + '/';
      const url = `${baseUrl}chat/completions`;
      
            
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`
        },
        body: JSON.stringify({
          model: aiConfig.model || 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: '你是一个专业的文本优化助手，擅长改进用户的想法和笔记。请优化用户输入的内容，使其更加清晰、有条理和有表达力，但保持原意不变。改善语言表达，优化逻辑结构，让内容更加易读和有说服力。'
            },
            {
              role: 'user',
              content: `请优化以下内容，保持原意不变，但提升表达清晰度和逻辑性：${newMemo}`
            }
          ],
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.9,
          frequency_penalty: 0.3,
          presence_penalty: 0.1
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('AI请求失败:', errorData);
        console.error('响应状态:', response.status, response.statusText);
        throw new Error(errorData.error?.message || `AI请求失败 (${response.status})`);
      }

      const data = await response.json();
      
      // 检查响应数据结构
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('AI响应结构异常:', data);
        toast.error('AI响应结构异常', { id: 'ai-optimize' });
        return;
      }
      
      const optimizedText = data.choices[0].message.content;
      
      // 确保优化内容不为空且是字符串
      if (optimizedText && typeof optimizedText === 'string' && optimizedText.trim()) {
        // 去除可能的换行符前缀和后缀
        const trimmedOptimizedText = optimizedText.trim();
        
        // 将优化内容替换原文
        setNewMemo(trimmedOptimizedText);
        toast.success('AI优化完成', { id: 'ai-optimize' });
      } else {
        console.error('AI返回内容为空或格式不正确:', optimizedText);
        toast.error('AI返回内容为空', { id: 'ai-optimize' });
      }
    } catch (error) {
      console.error('AI优化失败:', error);
      toast.error('AI优化失败，请检查API配置', { id: 'ai-optimize' });
    }
  };

  // AI对话功能
  const handleAIChat = () => {
    setIsAIDialogOpen(true);
  };

  // 监听画布模式变化，确保在画布模式下侧栏始终为非固定状态
  useEffect(() => {
    if (isCanvasMode) {
      setIsLeftSidebarPinned(false);
      setIsRightSidebarPinned(false);
    }
  }, [isCanvasMode]);

  // 额外的监听器，防止在画布模式下侧栏被意外固定
  useEffect(() => {
    if (isCanvasMode && (isLeftSidebarPinned || isRightSidebarPinned)) {
      setIsLeftSidebarPinned(false);
      setIsRightSidebarPinned(false);
    }
  }, [isCanvasMode, isLeftSidebarPinned, isRightSidebarPinned]);

  // 画布模式相关函数
  const handleCanvasAddMemo = (memo) => {
    // 检查是否为空内容，如果是则添加到pinnedMemos以便编辑
    if (!memo.content.trim()) {
      const pinnedMemo = {
        ...memo,
        isPinned: true,
        pinnedAt: new Date().toISOString()
      };
      setPinnedMemos([pinnedMemo, ...pinnedMemos]);
    } else {
      setMemos([memo, ...memos]);
    }
  };

  const handleCanvasUpdateMemo = (id, updates) => {
    // 更新memos
    const updatedMemos = memos.map(memo => 
      memo.id === id ? { ...memo, ...updates } : memo
    );
    
    // 更新pinnedMemos
    const updatedPinned = pinnedMemos.map(memo => 
      memo.id === id ? { ...memo, ...updates } : memo
    );

    setMemos(updatedMemos);
    setPinnedMemos(updatedPinned);
  };

  const handleCanvasDeleteMemo = (id) => {
    setMemos(memos.filter(memo => memo.id !== id));
    setPinnedMemos(pinnedMemos.filter(memo => memo.id !== id));
  addDeletedMemoTombstone(id);
  };

  const handleCanvasTogglePin = (id) => {
    const memoInMemos = memos.find(memo => memo.id === id);
    const memoInPinned = pinnedMemos.find(memo => memo.id === id);

    if (memoInMemos) {
      // 从普通memos移动到pinnedMemos
      const pinnedMemo = {
        ...memoInMemos,
        isPinned: true,
        pinnedAt: new Date().toISOString()
      };
      setPinnedMemos([pinnedMemo, ...pinnedMemos]);
      setMemos(memos.filter(memo => memo.id !== id));
    } else if (memoInPinned) {
      // 从pinnedMemos移动到普通memos
      const unpinnedMemo = { ...memoInPinned, isPinned: false };
      delete unpinnedMemo.pinnedAt;
      setMemos([unpinnedMemo, ...memos]);
      setPinnedMemos(pinnedMemos.filter(memo => memo.id !== id));
    }
  };

  // 当启用随机背景且没有自定义图片时，拉取一次随机图片
  useEffect(() => {
    const shouldUseRandom = backgroundConfig?.useRandom && !backgroundConfig?.imageUrl;
    if (!shouldUseRandom) {
      setCurrentRandomBgUrl('');
      return;
    }
    let aborted = false;
    // 避免重复请求：已有则不再请求
    if (currentRandomBgUrl) return;
    (async () => {
      try {
        // 优先通过本地代理获取 data URL，避免跨域与防盗链问题
        const api = '/api/proxy-fetch?url=' + encodeURIComponent('https://imgapi.xl0408.top/index.php');
        const res = await fetch(api);
        if (res.ok) {
          const data = await res.json().catch(() => null);
          const dataUrl = data?.dataUrl;
          if (!aborted && dataUrl) {
            setCurrentRandomBgUrl(dataUrl);
            return;
          }
        }
        // 退化：直接使用远端地址
        if (!aborted) setCurrentRandomBgUrl('https://imgapi.xl0408.top/index.php');
      } catch (_) {
        // 忽略失败
      }
    })();
    return () => { aborted = true; };
  }, [backgroundConfig?.useRandom, backgroundConfig?.imageUrl, currentRandomBgUrl]);

  // 生成背景样式 - 亮度滤镜只应用于背景图片
  const effectiveBgUrl = backgroundConfig.imageUrl || (backgroundConfig.useRandom ? currentRandomBgUrl : '');
  const backgroundStyle = effectiveBgUrl ? {
    backgroundImage: `url(${effectiveBgUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    filter: `brightness(${backgroundConfig.brightness}%)`,
  } : {};

  const overlayStyle = effectiveBgUrl ? {
    backdropFilter: `blur(${backgroundConfig.blur}px)`,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  } : {};

  // 收藏当前随机背景
  const handleFavoriteRandomBackground = () => {
    const url = currentRandomBgUrl;
    if (!backgroundConfig.useRandom || backgroundConfig.imageUrl) return;
    if (!url) return;
    updateBackgroundConfig({ imageUrl: url, useRandom: false });
    try { toast.success('已收藏并设置为背景'); } catch {}
  };

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col lg:flex-row lg:overflow-hidden lg:h-screen relative"
    >
      {/* 背景图片层 - 亮度滤镜只应用于此层 */}
  {effectiveBgUrl && (
        <div
          className="absolute inset-0 z-0"
          style={backgroundStyle}
        />
      )}

      {/* 背景遮罩层 */}
  {effectiveBgUrl && (
        <div
          className="absolute inset-0 z-0"
          style={overlayStyle}
        />
      )}

      {/* 主内容区域 */}
      <div className="relative z-10 min-h-screen lg:h-full w-full flex flex-col lg:flex-row">
        
        {/* 左侧热力图区域 */}
        <LeftSidebar
          heatmapData={heatmapData}
          memos={memos}
          pinnedMemos={pinnedMemos}
          isLeftSidebarHidden={isLeftSidebarHidden}
          setIsLeftSidebarHidden={setIsLeftSidebarHidden}
          isLeftSidebarPinned={isLeftSidebarPinned}
          setIsLeftSidebarPinned={setIsLeftSidebarPinned}
          isLeftSidebarHovered={isLeftSidebarHovered}
          isAppLoaded={isAppLoaded}
          isInitialLoad={isInitialLoad}
          isCanvasMode={isCanvasMode}
          setIsCanvasMode={setIsCanvasMode}
          onSettingsOpen={() => setIsSettingsOpen(true)}
          onDateClick={handleDateClick}
          onOpenDailyReview={() => setIsDailyReviewOpen(true)}
          showFavoriteRandomButton={backgroundConfig.useRandom && !backgroundConfig.imageUrl}
          onFavoriteRandomBackground={handleFavoriteRandomBackground}
        />

        {/* 中央主内容区 */}
        {isCanvasMode ? (
          <CanvasMode
            memos={memos}
            pinnedMemos={pinnedMemos}
            onAddMemo={handleCanvasAddMemo}
            onUpdateMemo={handleCanvasUpdateMemo}
            onDeleteMemo={handleCanvasDeleteMemo}
            onTogglePin={handleCanvasTogglePin}
            onToolPanelVisibleChange={setCanvasToolPanelVisible}
          />
        ) : (
          <MainContent
            // Layout state
            isLeftSidebarHidden={isLeftSidebarHidden}
            isRightSidebarHidden={isRightSidebarHidden}
            setIsLeftSidebarHidden={setIsLeftSidebarHidden}
            setIsRightSidebarHidden={setIsRightSidebarHidden}
            isLeftSidebarPinned={isLeftSidebarPinned}
            isRightSidebarPinned={isRightSidebarPinned}
            
            // Data
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            newMemo={newMemo}
            setNewMemo={setNewMemo}
            filteredMemos={filteredMemos}
            pinnedMemos={pinnedMemos}
            activeMenuId={activeMenuId}
            editingId={editingId}
            editContent={editContent}
            activeTag={activeTag}
            activeDate={activeDate} // 传递日期筛选状态
            showScrollToTop={showScrollToTop}
            
            // Refs
            searchInputRef={searchInputRef}
            memosContainerRef={memosContainerRef}
            menuRefs={menuRefs}
            
            // Callbacks
            onMobileMenuOpen={() => setIsMobileSidebarOpen(true)}
            onAddMemo={addMemo}
            onMenuAction={handleMenuAction}
            onMenuContainerEnter={handleMenuContainerEnter}
            onMenuContainerLeave={handleMenuContainerLeave}
            onMenuButtonClick={handleMenuButtonClick}
            onEditContentChange={setEditContent}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onTagClick={setActiveTag}
            onScrollToTop={scrollToTop}
            clearFilters={clearFilters} // 传递清除筛选函数
            onEditorFocus={handleEditorFocus}
            onEditorBlur={handleEditorBlur}
            // backlinks props
            allMemos={[...memos, ...pinnedMemos]}
            onAddBacklink={handleAddBacklink}
            onPreviewMemo={handlePreviewMemo}
            pendingNewBacklinks={pendingNewBacklinks}
            onRemoveBacklink={handleRemoveBacklink}
            // audio props
            pendingNewAudioClips={pendingNewAudioClips}
            onRemoveAudioClip={handleRemoveAudioClip}
            onAddAudioClip={handleAddAudioClip}
              onOpenMusic={() => {
                if (musicConfig?.enabled) setMusicModal((m) => ({ ...m, isOpen: true }));
              }}
              musicEnabled={!!musicConfig?.enabled}
              onOpenMusicSearch={(q) => {
                setMusicSearchKeyword(q);
                setMusicSearchOpen(true);
              }}
          />
        )}

        {/* 右侧标签管理区 */}
        <RightSidebar
          memos={[...memos, ...pinnedMemos]}
          activeTag={activeTag}
        setActiveTag={(tag) => { setActiveTag(tag); setActiveDate(null); }}
          isRightSidebarHidden={isRightSidebarHidden}
          setIsRightSidebarHidden={setIsRightSidebarHidden}
          isRightSidebarPinned={isRightSidebarPinned}
          setIsRightSidebarPinned={setIsRightSidebarPinned}
          isRightSidebarHovered={isRightSidebarHovered}
          isAppLoaded={isAppLoaded}
          isInitialLoad={isInitialLoad}
          isCanvasMode={isCanvasMode}
        />
      </div>

      {/* 移动端侧栏 */}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
        heatmapData={heatmapData}
        memos={[...memos, ...pinnedMemos]}
        activeTag={activeTag}
        setActiveTag={(tag) => { setActiveTag(tag); setActiveDate(null); }}
        onSettingsOpen={() => setIsSettingsOpen(true)}
        onDateClick={handleDateClick}
  onOpenMusic={() => { if (musicConfig?.enabled) setMusicModal((m) => ({ ...m, isOpen: true })); }}
      />

      {/* 设置卡片 */}
      <SettingsCard
        isOpen={isSettingsOpen}
  onClose={() => setIsSettingsOpen(false)}
  onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* 分享图对话框 */}
      <ShareDialog
        isOpen={isShareDialogOpen}
        onClose={() => setIsShareDialogOpen(false)}
        memo={selectedMemo}
      />

      {/* AI对话框 */}
      <AIDialog
        isOpen={isAIDialogOpen}
        onClose={() => setIsAIDialogOpen(false)}
        memos={[...memos, ...pinnedMemos]}
      />

      {/* 每日回顾弹窗 */}
      <DailyReview
        isOpen={isDailyReviewOpen}
        onClose={() => setIsDailyReviewOpen(false)}
        memos={[...memos, ...pinnedMemos]}
      />

      {/* 教程弹窗 */}
      <TutorialDialog
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
      />

      {/* 预览弹窗 */}
      <MemoPreviewDialog
        memo={([...memos, ...pinnedMemos].find(m => m.id === previewMemoId)) || null}
        open={!!previewMemoId}
        onClose={() => setPreviewMemoId(null)}
      />

      {/* 音乐功能（受全局开关控制） */}
      {musicConfig?.enabled && (
        <>
          <MusicModal
            isOpen={musicModal.isOpen}
            onClose={() => setMusicModal((m) => ({ ...m, isOpen: false }))}
            danmakuText={musicModal.danmakuText}
            enableDanmaku={musicModal.enableDanmaku}
          />
          <MiniMusicPlayer
            onOpenFull={() => setMusicModal((m) => ({ ...m, isOpen: true }))}
          />
          {/* 音乐搜索卡片 */}
          <MusicSearchCard
            open={musicSearchOpen}
            keyword={musicSearchKeyword}
            onClose={() => setMusicSearchOpen(false)}
          />
        </>
      )}

      {/* AI按钮 - 在画布模式下不显示 */}
      {!isCanvasMode && (
        <AIButton
          isSettingsOpen={isSettingsOpen}
          isShareDialogOpen={isShareDialogOpen}
          isEditorFocused={isEditorFocused}
          onContinue={handleAIContinue}
          onOptimize={handleAIOptimize}
          onChat={handleAIChat}
        />
      )}
    </div>
  );
};

export default Index;
