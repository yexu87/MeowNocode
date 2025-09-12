import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';
import ContentRenderer from '@/components/ContentRenderer';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/context/SettingsContext';

const DraggableMemo = ({ 
  memo, 
  onDragStart, 
  onDrag, 
  onDragEnd, 
  onUpdate, 
  onDelete, 
  onTogglePin,
  style,
  scale = 1,
}) => {
  const { currentFont } = useTheme();
  const { fontConfig } = useSettings();
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // 使用 ref 实时同步拖拽状态
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(memo.isNew || false);
  const [editContent, setEditContent] = useState(memo.content || '');
  const [isNewAndUnsaved, setIsNewAndUnsaved] = useState(memo.isNew || false);
  const memoRef = useRef(null);
  const hoverTimerRef = useRef(null);

  // 拖拽相关 refs（避免频繁 setState）
  const startPointerRef = useRef({ x: 0, y: 0 });
  const deltaRef = useRef({ x: 0, y: 0 });
  const basePosRef = useRef({ x: style.left || memo.canvasX || 0, y: style.top || memo.canvasY || 0 });
  const rafRef = useRef(null);

  // 点击外部关闭菜单 & ESC 关闭
  useEffect(() => {
    if (!showMenu) return;
    const onOutside = (e) => {
      if (memoRef.current && !memoRef.current.contains(e.target)) {
        setShowMenu(false);
        // 清除任何悬停定时器
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
      }
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setShowMenu(false);
        // 清除任何悬停定时器
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
      }
    };
    document.addEventListener('pointerdown', onOutside, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onOutside, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [showMenu]);

  // 点击外部自动保存并退出编辑模式
  useEffect(() => {
    if (!isEditing) return;
    const onOutsideEdit = (e) => {
      // 如果点击在memo外部，则自动保存并退出编辑模式
      if (memoRef.current && !memoRef.current.contains(e.target)) {
        // 如果是新建且内容为空的memo，则删除它
        if (isNewAndUnsaved && !editContent.trim()) {
          onDelete(memo.id);
        } else {
          // 否则自动保存内容
          onUpdate(memo.id, { content: editContent, updatedAt: new Date().toISOString() });
          setIsEditing(false);
          setIsNewAndUnsaved(false);
        }
      }
    };
    const onEscapeEdit = (e) => {
      if (e.key === 'Escape') {
        // 如果是新建且内容为空的memo，则删除它
        if (isNewAndUnsaved && !editContent.trim()) {
          onDelete(memo.id);
        } else {
          // ESC键也自动保存并退出
          onUpdate(memo.id, { content: editContent, updatedAt: new Date().toISOString() });
          setIsEditing(false);
          setIsNewAndUnsaved(false);
        }
      }
    };
    
    // 延迟添加事件监听器，避免立即触发
    const timeoutId = setTimeout(() => {
      document.addEventListener('pointerdown', onOutsideEdit, true);
      document.addEventListener('keydown', onEscapeEdit);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('pointerdown', onOutsideEdit, true);
      document.removeEventListener('keydown', onEscapeEdit);
    };
  }, [isEditing, editContent, memo.id, onUpdate, onDelete, isNewAndUnsaved]);

  // 新建 memo 自动进入编辑
  useEffect(() => {
    if (memo.isNew) {
      setIsEditing(true);
      setIsNewAndUnsaved(true);
      onUpdate(memo.id, { isNew: false });
    }
  }, [memo.isNew, memo.id, onUpdate]);

  // 清理 RAF 和悬停定时器
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
    };
  }, []);

  const applyFrame = () => {
    if (!memoRef.current) return;
    const { x, y } = deltaRef.current;
    const tx = x / (scale || 1);
    const ty = y / (scale || 1);
    memoRef.current.style.transform = `translate(-50%, -50%) translate3d(${tx}px, ${ty}px, 0) scale(${isDragging ? 1.03 : 1})`;

    const { x: bx, y: by } = basePosRef.current;
    onDrag(memo.id, { x: bx + tx, y: by + ty });
  };

  const scheduleFrame = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyFrame();
    });
  };

  const handlePointerDown = (e) => {
    // 编辑态不拖拽；菜单或编辑区域不拖拽
    if (isEditing || e.target.closest('.memo-menu') || e.target.closest('.memo-edit')) return;
    
    // 立即阻止默认行为，避免首击选中文本影响拖拽
    e.preventDefault();
    e.stopPropagation();

    const el = memoRef.current;
    if (!el) return;

    // 更新状态和 ref
    setIsDragging(true);
    isDraggingRef.current = true;
    onDragStart(memo.id);

    // 基准位置以数据为准，避免样式与状态不一致
    basePosRef.current = { x: memo.canvasX || 0, y: memo.canvasY || 0 };
    startPointerRef.current = { x: e.clientX, y: e.clientY };
    deltaRef.current = { x: 0, y: 0 };

    // 性能优化
    el.style.transition = 'none';
    el.style.willChange = 'transform';
    document.body.style.userSelect = 'none';

    try { el.setPointerCapture && el.setPointerCapture(e.pointerId); } catch {}

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return; // 使用 ref 判断，避免延迟
    const dx = e.clientX - startPointerRef.current.x;
    const dy = e.clientY - startPointerRef.current.y;
    deltaRef.current = { x: dx, y: dy };
    scheduleFrame();
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return; // 使用 ref 判断
    isDraggingRef.current = false; // 立即停止

    // 取消未完成的帧，避免释放瞬间再渲染一帧造成抖动
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    const { x: bx, y: by } = basePosRef.current;
    const { x: dx, y: dy } = deltaRef.current;
    const tx = dx / (scale || 1);
    const ty = dy / (scale || 1);
    const newX = bx + tx;
    const newY = by + ty;

    const el = memoRef.current;
    if (el) {
      // 直接设置最终位置，避免过渡动画导致的抖动
      el.style.left = `${newX}px`;
      el.style.top = `${newY}px`;
      el.style.transform = 'translate(-50%, -50%) translate3d(0,0,0) scale(1)';
      el.style.transition = 'none';
      el.style.willChange = 'auto';
      
      // 强制重绘以确保样式立即生效
      el.offsetHeight;
    }

    // 通知父组件更新位置
    onDragEnd(memo.id, { x: newX, y: newY });

    document.body.style.userSelect = '';
    setIsDragging(false);

    window.removeEventListener('pointermove', handlePointerMove);
  };

  const handleEdit = () => { setIsEditing(true); setShowMenu(false); };
  const handleSave = () => { 
    onUpdate(memo.id, { content: editContent, updatedAt: new Date().toISOString() }); 
    setIsEditing(false);
    setIsNewAndUnsaved(false); // 标记为已保存
  };
  const handleCancel = () => { 
    // 如果是新建且未保存的memo，则删除该memo
    if (isNewAndUnsaved) {
      onDelete(memo.id);
    } else {
      setEditContent(memo.content || ''); 
      setIsEditing(false); 
    }
  };
  const handleDelete = () => { onDelete(memo.id); setShowMenu(false); };
  const handleTogglePin = () => { onTogglePin(memo.id); setShowMenu(false); };
  
  // 菜单悬停和点击事件处理
  const handleMenuContainerEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 延迟300ms后显示菜单
    hoverTimerRef.current = setTimeout(() => {
      setShowMenu(true);
    }, 300);
  };
  
  const handleMenuContainerLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 延迟150ms后隐藏菜单
    hoverTimerRef.current = setTimeout(() => {
      setShowMenu(false);
    }, 150);
  };
  
  const handleMenuButtonClick = (e) => {
    e.stopPropagation();
    // 清除任何悬停定时器
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 立即切换菜单状态
    setShowMenu(!showMenu);
  };

  const isPinned = memo.isPinned || memo.pinnedAt;

  return (
    <div
      ref={memoRef}
      className={`draggable-memo absolute -translate-x-1/2 -translate-y-1/2 group ${isEditing ? 'cursor-text' : 'cursor-grab active:cursor-grabbing'} transition-shadow duration-200 ease-out ${
        isDragging ? 'ring-2 ring-blue-300/60 shadow-xl' : 'hover:shadow-md'
      }`}
      style={{
        ...style,
        left: memo.canvasX ?? style.left,
        top: memo.canvasY ?? style.top,
        width: '320px',
        minWidth: '280px',
        maxWidth: '400px',
        zIndex: isDragging ? 50 : 10,
        willChange: isDragging ? 'transform' : 'auto',
        touchAction: 'none',
        userSelect: isEditing ? 'text' : 'none',
      }}
      onPointerDown={handlePointerDown}
      onDoubleClick={(e) => {
        // 如果双击的是菜单按钮或菜单区域，不触发编辑模式
        if (e.target.closest('.memo-menu')) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        
        // 防止双击事件冒泡到画布，避免误创建新memo
        e.preventDefault();
        e.stopPropagation();
        // 如果不在编辑状态且不是正在拖拽，则进入编辑模式
        if (!isEditing && !isDragging) {
          setIsEditing(true);
        }
      }}
      aria-grabbed={isDragging}
    >
  <div className={`relative rounded-xl border bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 shadow-sm transition-colors ${
        isPinned ? 'pl-3' : ''
      }`}>
        {/* 置顶标记 */}
        {isPinned && (
          <div className="absolute -left-1 top-3 h-3 w-3 rounded-full bg-yellow-400 shadow ring-2 ring-yellow-200" aria-hidden />
        )}

  <div className="p-3 sm:p-3 pb-9 relative">
          {/* 菜单按钮 */}
          <div
            className="absolute top-3 right-3 sm:top-4 sm:right-4 memo-menu"
            onMouseEnter={handleMenuContainerEnter}
            onMouseLeave={handleMenuContainerLeave}
          >
            <button
              onClick={handleMenuButtonClick}
              className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
              aria-label="操作菜单"
            >
              <MoreVertical className="h-4 w-4 text-gray-500" />
            </button>

            {/* 菜单面板 */}
            {showMenu && (
              <div
                className="absolute w-44 sm:w-52 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={handleMenuContainerEnter}
                onMouseLeave={handleMenuContainerLeave}
                style={{ top: '100%', right: 0, marginTop: '6px' }}
              >
                {/* 置顶/取消置顶按钮 */}
                {isPinned ? (
                  <button
                    onClick={handleTogglePin}
                    className="block w-full text-left px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    取消置顶
                  </button>
                ) : (
                  <button
                    onClick={handleTogglePin}
                    className="block w-full text-left px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    置顶
                  </button>
                )}

                {/* 编辑按钮 */}
                <button
                  onClick={handleEdit}
                  className="block w-full text-left px-3 py-2 sm:px-4 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  编辑
                </button>

                {/* 删除按钮 */}
                <button
                  onClick={handleDelete}
                  className="block w-full text-left px-3 py-2 sm:px-4 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30"
                >
                  删除
                </button>

                {/* 信息 */}
                <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1 px-3 py-2 sm:px-4 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                  <div className="truncate">字数: {memo.content.length}字</div>
                  <div className="truncate">创建: {new Date(memo.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="truncate">修改: {new Date(memo.updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            )}
          </div>

          {/* 内容区域 */}
          {isEditing ? (
            <div className={`memo-edit px-4 custom-font-content`} style={{ fontSize: fontConfig?.fontSize ? `${fontConfig.fontSize}px` : undefined }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent scrollbar-transparent scrollbar-thin custom-font-content"
                style={{ fontSize: fontConfig?.fontSize ? `${fontConfig.fontSize}px` : undefined }}
                rows={4}
                autoFocus
                placeholder="编辑想法..."
                maxLength={5000}
              />
            </div>
           ) : (
            <div 
              className={`px-4 custom-font-content`}
              style={{ fontSize: fontConfig?.fontSize ? `${fontConfig.fontSize}px` : undefined }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {memo.content ? (
                <ContentRenderer content={memo.content} activeTag={null} onTagClick={() => {}} />
              ) : (
                <div className="text-gray-400 italic">双击编辑...</div>
              )}
            </div>
          )}

          {/* 标签在内容中渲染，避免底部重复显示 */}

          {/* 时间戳：右下角固定显示 */}
          <div className="absolute bottom-2 right-3 text-[11px] text-gray-400 dark:text-gray-500 select-none pointer-events-none">
            {new Date(memo.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DraggableMemo;
