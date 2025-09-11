
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useSettings } from '@/context/SettingsContext';

const MemoEditor = ({
  value = '',
  onChange,
  placeholder = '现在的想法是……',
  onSubmit,
  disabled = false,
  maxLength,
  showCharCount = false,
  autoFocus = false,
  className = '',
  // backlinks related
  memosList = [],
  currentMemoId = null,
  backlinks = [],
  onAddBacklink,
  onRemoveBacklink,
  onPreviewMemo,
  // optional focus callbacks
  onFocus,
  onBlur,
}) => {
  // theme & settings
  const { themeColor } = useTheme();
  const { fontConfig, hitokotoConfig } = useSettings();
  const currentFont = fontConfig?.selectedFont || 'default';

  // local states / refs
  const textareaRef = useRef(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [compositionValue, setCompositionValue] = useState('');
  const [hitokoto, setHitokoto] = useState({ text: '' });
  const [showBacklinkPicker, setShowBacklinkPicker] = useState(false);
  const [pickerPos, setPickerPos] = useState(null);
  const backlinkBtnRef = useRef(null);

  // 获取一言或内置句子
  const fetchHitokoto = async () => {
    if (!hitokotoConfig.enabled) {
      // 从内置句子中随机选择
      const builtInSentences = [
        "生活就像一盒巧克力，你永远不知道下一颗是什么味道。",
        "岁月不居，时节如流。",
        "The only way to do great work is to love what you do. - Steve Jobs",
        "路漫漫其修远兮，吾将上下而求索。",
        "Stay hungry, stay foolish. - Steve Jobs",
        "不积跬步，无以至千里；不积小流，无以成江海。",
        "To be or not to be, that is the question. - Shakespeare",
        "人生得意须尽欢，莫使金樽空对月。",
        "The journey of a thousand miles begins with one step. - Lao Tzu",
        "天行健，君子以自强不息。",
        "Carpe diem. Seize the day, boys. Make your lives extraordinary. - Dead Poets Society",
        "海内存知己，天涯若比邻。",
        "In three words I can sum up everything I've learned about life: it goes on. - Robert Frost",
        "春风得意马蹄疾，一日看尽长安花。",
        "The best preparation for tomorrow is doing your best today. - H. Jackson Brown Jr.",
        "会当凌绝顶，一览众山小。",
        "Life is what happens when you're busy making other plans. - John Lennon",
        "落霞与孤鹜齐飞，秋水共长天一色。",
        "You miss 100% of the shots you don't take. - Wayne Gretzky",
        "问渠那得清如许？为有源头活水来。"
      ];
      const randomIndex = Math.floor(Math.random() * builtInSentences.length);
      setHitokoto({
        text: builtInSentences[randomIndex],
      });
      return;
    }

    try {
      // 构建请求URL，包含类型参数
      const typeParams = hitokotoConfig.types.map(type => `c=${type}`).join('&');
      const url = `https://v1.hitokoto.cn/?${typeParams}`;

      const response = await fetch(url);
      const data = await response.json();
      setHitokoto({
        text: data.hitokoto,
      });
    } catch (error) {
      console.error('获取一言失败:', error);
      // API失败时使用内置句子
      const builtInSentences = [
        "生活就像一盒巧克力，你永远不知道下一颗是什么味道。",
        "岁月不居，时节如流。",
        "The only way to do great work is to love what you do. - Steve Jobs",
        "路漫漫其修远兮，吾将上下而求索。",
        "Stay hungry, stay foolish. - Steve Jobs",
        "不积跬步，无以至千里；不积小流，无以成江海。",
        "To be or not to be, that is the question. - Shakespeare",
        "人生得意须尽欢，莫使金樽空对月。",
        "The journey of a thousand miles begins with one step. - Lao Tzu",
        "天行健，君子以自强不息。",
        "Carpe diem. Seize the day, boys. Make your lives extraordinary. - Dead Poets Society",
        "海内存知己，天涯若比邻。",
        "In three words I can sum up everything I've learned about life: it goes on. - Robert Frost",
        "春风得意马蹄疾，一日看尽长安花。",
        "The best preparation for tomorrow is doing your best today. - H. Jackson Brown Jr.",
        "会当凌绝顶，一览众山小。",
        "Life is what happens when you're busy making other plans. - John Lennon",
        "落霞与孤鹜齐飞，秋水共长天一色。",
        "You miss 100% of the shots you don't take. - Wayne Gretzky",
        "问渠那得清如许？为有源头活水来。"
      ];
      const randomIndex = Math.floor(Math.random() * builtInSentences.length);
      setHitokoto({
        text: builtInSentences[randomIndex],
      });
    }
  };

  // 自动调整高度
  const adjustHeight = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      textarea.style.height = 'auto';
      const newHeight = Math.max(120, Math.min(400, textarea.scrollHeight));
      textarea.style.height = newHeight + 'px';
    }
  };

  // 处理输入变化
  const handleChange = (e) => {
    const newValue = e.target.value;
    onChange?.(newValue);
    // 延迟调整高度
    setTimeout(adjustHeight, 0);
  };

  // 处理输入法合成开始
  const handleCompositionStart = (e) => {
    setIsComposing(true);
    setCompositionValue(e.target.value);
  };

  // 处理输入法合成更新
  const handleCompositionUpdate = (e) => {
    if (isComposing) {
      setCompositionValue(e.target.value);
    }
  };

  // 处理输入法合成结束
  const handleCompositionEnd = (e) => {
    setIsComposing(false);
    setCompositionValue('');
    const newValue = e.target.value;
    onChange?.(newValue);
  };

  // 处理键盘事件
  const handleKeyDown = (e) => {
    // Ctrl+Enter 或 Cmd+Enter 提交
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSubmit?.();
      return;
    }
  };

  // 在光标处插入 spoiler 语法，并将光标定位到 spoiler 内容处
  const insertSpoilerAtCursor = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    // 形如: {% spoiler  %}，光标定位到 spoiler 后的空白处（两空格中间的第一个后）
    const snippet = '{% spoiler  %}';
    // 计算插入后光标位置：位于 "{% spoiler " 之后（索引从0开始）
    const caretOffsetInSnippet = '{% spoiler '.length; // 包含末尾空格，落在内容位置
    const newValue = before + snippet + after;
    onChange?.(newValue);
    // 聚焦并设置选择区域到内容位置
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = start + caretOffsetInSnippet;
        try { textareaRef.current.setSelectionRange(pos, pos); } catch {}
      }
      // 调整高度
      adjustHeight();
    }, 0);
  };

  // 选择一个目标 memo 建立双链
  const handlePickBacklink = (targetId) => {
    if (!onAddBacklink) return;
    if (currentMemoId && targetId === currentMemoId) return;
    onAddBacklink(currentMemoId || null, targetId);
    setShowBacklinkPicker(false);
  };

  // 计算选择卡片的屏幕定位，避免被滚动容器裁剪
  const updatePickerPosition = useCallback(() => {
    const btn = backlinkBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = 320;
    const margin = 8;
    let left = Math.min(rect.left, window.innerWidth - width - margin);
    if (left < margin) left = margin;
    const top = Math.min(rect.bottom + 6, window.innerHeight - margin);
    setPickerPos({ left, top, width });
  }, []);

  useEffect(() => {
    if (!showBacklinkPicker) return;
    updatePickerPosition();
    const onResize = () => updatePickerPosition();
    const onScroll = () => updatePickerPosition();
    window.addEventListener('resize', onResize);
    // 捕获阶段监听滚动，包含内部滚动容器
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [showBacklinkPicker, updatePickerPosition]);

  const findMemoById = (id) => memosList.find(m => m.id === id);
  const backlinkMemos = (backlinks || []).map(findMemoById).filter(Boolean);

  // 焦点事件
  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    // 失焦时关闭双链选择器
    setShowBacklinkPicker(false);
    onBlur?.();
  };

  // 在编辑器聚焦时，点击编辑器区域任意位置（不含双链按钮/选择器）关闭选择器
  const handleContainerMouseDown = () => {
    if (showBacklinkPicker) {
      setShowBacklinkPicker(false);
    }
  };

  // 当value变化时调整高度
  useEffect(() => {
    adjustHeight();
  }, [value]);

  // 自动聚焦
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // 组件挂载时获取一言，以及当一言配置变化时重新获取
  useEffect(() => {
    fetchHitokoto();
  }, [hitokotoConfig]);

  // 计算字符数 - 在输入法合成期间使用合成前的值
  const getDisplayCharCount = () => {
    if (isComposing && compositionValue) {
      // 输入法合成期间，使用合成开始前的字符数
      return compositionValue.length;
    }
    return value.length;
  };

  const charCount = getDisplayCharCount();
  const isNearLimit = maxLength && charCount > maxLength * 0.8;
  const isOverLimit = maxLength && charCount > maxLength;

  return (
    <div
      className={cn(
        "relative border rounded-lg overflow-hidden bg-white dark:bg-gray-800 transition-all duration-200",
        isFocused
          ? "ring-2 shadow-sm"
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      style={isFocused ? {
        borderColor: themeColor,
        '--tw-ring-color': themeColor
      } : {}}
      onMouseDown={handleContainerMouseDown}
    >
      {/* 主要文本区域 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full p-3 bg-transparent resize-none outline-none border-none theme-selection",
          "text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500",
          currentFont !== 'default' && "custom-font-content",
          disabled && "cursor-not-allowed"
        )}
        style={{
          minHeight: '120px',
          maxHeight: '400px',
          lineHeight: '1.5rem',
          fontSize: '0.875rem',
          ...(currentFont === 'default' && {
            fontFamily: 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif'
          })
        }}
        rows={5}
      />

      {/* 反链 Chips（编辑时显示） */}
      {isFocused && backlinkMemos.length > 0 && (
        <div className="px-3 pb-1 -mt-2 flex flex-wrap gap-2">
          {backlinkMemos.map((m) => (
            <span key={m.id} className="inline-flex items-center group">
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onPreviewMemo?.(m.id); }}
                className="max-w-full inline-flex items-center gap-1 pl-2 pr-2 py-0.5 rounded-md bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 text-xs hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <span className="truncate inline-block max-w-[180px]">{m.content?.replace(/\n/g, ' ').slice(0, 50) || '（无内容）'}</span>
                <ArrowUpRight className="h-3.5 w-3.5 opacity-70" />
              </button>
              <button
                type="button"
                aria-label="移除反链"
                className="ml-1 w-4 h-4 rounded hover:bg-black/10 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onRemoveBacklink?.(currentMemoId || null, m.id); }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 底部信息栏 */}
      {(showCharCount || onSubmit) && (
        <div className="flex items-center justify-between px-3 py-1 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 min-h-[32px] rounded-b-lg">
          {/* 未聚焦时显示一言 */}
          {!isFocused && hitokotoConfig.enabled ? (
            <a
              className={cn(
                "flex-1 text-center text-xs text-gray-500 truncate px-2 transition-colors duration-300",
                currentFont !== 'default' && "custom-font-content"
              )}
              style={{
                '--hover-color': 'var(--theme-color)',
              }}
              onMouseEnter={(e) => e.target.style.color = 'var(--theme-color)'}
              onMouseLeave={(e) => e.target.style.color = ''}
            >
              {hitokoto.text}
            </a>
          ) : !isFocused && !hitokotoConfig.enabled ? (
            <div className="flex-1"></div>
          ) : isFocused ? (
            <>
              {/* 左侧：字数 + 插入spoiler按钮 */}
              <div className="flex items-center gap-2 relative">
                {showCharCount && (
                  <div className={cn(
                    "text-xs transition-colors",
                    isOverLimit
                      ? "text-red-500 font-medium"
                      : isNearLimit
                        ? "text-orange-500"
                        : "text-gray-500 dark:text-gray-400"
                  )}>
                    {charCount} 字
                  </div>
                )}
                {/* Spoiler 快捷按钮 */}
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); /* 允许冒泡以便父容器关闭选择器 */ insertSpoilerAtCursor(); }}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-gray-600 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                >
                  {/* 模糊的小圆角矩形图标（默认模糊效果） */}
                  <svg width="16" height="12" viewBox="0 0 18 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <filter id="f" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.1" />
                      </filter>
                    </defs>
                    <rect x="2" y="2" width="14" height="8" rx="3" fill="currentColor" opacity="0.9" filter="url(#f)" />
                  </svg>
                </button>

                {/* 双链按钮 */}
                <button
                  type="button"
                  ref={backlinkBtnRef}
                  onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setShowBacklinkPicker(v => !v); }}
                  className={cn(
                    "inline-flex items-center justify-center h-7 px-2 rounded-md text-gray-600 bg-white hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors"
                  )}
                >
                  {/* 简洁链路图标 */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 14a5 5 0 0 1 0-7.07l1.94-1.94a5 5 0 0 1 7.07 7.07l-1.25 1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <path d="M14 10a5 5 0 0 1 0 7.07l-1.94 1.94a5 5 0 0 1-7.07-7.07l1.25-1.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>

                {/* 双链选择卡片 */}
                {isFocused && showBacklinkPicker && (
                  <div
                    className="fixed z-50 w-[320px] max-h-56 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden"
                    style={{ left: pickerPos?.left ?? 16, top: pickerPos?.top ?? 100, width: pickerPos?.width ?? 320 }}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  >
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">选择一个 Memo 建立双链</div>
                    <div className="overflow-y-auto pr-2 scrollbar-transparent" style={{ maxHeight: '11rem' }}>
                      {(memosList || [])
                        .filter(m => m.id !== currentMemoId)
                        .filter(m => !(Array.isArray(backlinks) && backlinks.includes(m.id)))
                        .slice(0, 50)
                        .map(m => (
                        <button
                          key={m.id}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handlePickBacklink(m.id); }}
                             
                        >
                          <div className="truncate">{m.content?.replace(/\n/g, ' ') || '（无内容）'}</div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{new Date(m.updatedAt || m.createdAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric' })}</div>
                        </button>
                      ))}
                      {(memosList || [])
                        .filter(m => m.id !== currentMemoId)
                        .filter(m => !(Array.isArray(backlinks) && backlinks.includes(m.id)))
                        .length === 0 && (
                        <div className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400">暂无可选 Memo</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：快捷键提示 */}
              {onSubmit && (
                <div className="text-xs text-gray-400 dark:text-gray-500">
                  <kbd className="px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Ctrl</kbd>
                  {' + '}
                  <kbd className="px-1 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 rounded">Enter</kbd>
                  {' 保存'}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MemoEditor;

