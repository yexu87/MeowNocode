import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useTheme } from '@/context/ThemeContext';
import Spoiler from '@/components/Spoiler';
import { buildEmojiUrl, getEmojiCategory } from '@/config/emoji';

const ContentRenderer = ({ content, activeTag, onTagClick }) => {
  const { themeColor, currentFont } = useTheme();
  // 解析内容，分离文本和标签
  const parseContent = (text) => {
    const parts = [];
    let lastIndex = 0;
    
    // 匹配标签的正则表达式
    const tagRegex = /(?:^|\s)(#[\u4e00-\u9fa5a-zA-Z0-9_\/]+)/g;
    let match;
    
    while ((match = tagRegex.exec(text)) !== null) {
      // 添加标签前的文本
      if (match.index > lastIndex) {
        const beforeText = text.substring(lastIndex, match.index);
        if (beforeText) {
          parts.push({
            type: 'text',
            content: beforeText
          });
        }
      }
      
      // 添加空格（如果标签前有空格）
      const spaceMatch = text.substring(match.index, match.index + match[0].length - match[1].length);
      if (spaceMatch) {
        parts.push({
          type: 'text',
          content: spaceMatch
        });
      }
      
      // 添加标签
      const tagContent = match[1]; // #标签内容
      const tagName = tagContent.substring(1); // 去掉#�?
      parts.push({
        type: 'tag',
        content: tagContent,
        tagName: tagName
      });
      
      lastIndex = match.index + match[0].length;
    }
    
    // 添加剩余文本
    if (lastIndex < text.length) {
      parts.push({
        type: 'text',
        content: text.substring(lastIndex)
      });
    }
    
    return parts;
  };

  // 渲染markdown文本（不包含标签�?
  const renderMarkdownText = (text) => {
    // 处理换行�?
    let processedText = text.replace(/\n/g, '  \n');
    
    // 转换标题语法
    processedText = processedText.replace(/(?:^|\s)#([^\s#][^\n]*)/g, (match, p1) => {
      // 检查是否是标签
      const isTag = /^[\u4e00-\u9fa5a-zA-Z0-9_\/]+$/.test(p1);
      
      if (isTag) {
        return match; // 保留标签不变
      }
      
      // 否则替换为markdown标题格式
      return `${match[0] === ' ' ? ' ' : ''}# ${p1}`;
    });
    
    return processedText;
  };

  // 解析并按自定�?spoiler 语法分割文本
  // 语法�?
  // {% spoiler 文本 %}
  // {% spoiler style:box 文本 %}
  // {% spoiler style:box color:red 文本 %}
  const splitBySpoilers = (text) => {
    const result = [];
    const re = /{%\s*spoiler\b([\s\S]*?)%}/g; // 非贪婪匹配到 %}
    let lastIndex = 0;
    let m;

    while ((m = re.exec(text)) !== null) {
      const before = text.slice(lastIndex, m.index);
      if (before) result.push({ kind: 'text', value: before });

      const inner = (m[1] || '').trim();
      // 解析参数与内�?
      let styleType = 'blur';
      let color;
      let content = inner;

      // 尝试提取前部�?key:value 选项（顺序不限），直到遇到第一个非 key:value 开头的 token
      // 用简单扫描避免把内容里的冒号误判：仅接受 style: �?color: 两种 key
      const tokens = inner.split(/\s+/);
      let consumed = 0;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (/^style:/i.test(t)) {
          const v = t.split(':')[1]?.toLowerCase();
          if (v === 'box' || v === 'blur') styleType = v;
          consumed = i + 1;
          continue;
        }
        if (/^color:/i.test(t)) {
          color = t.slice(t.indexOf(':') + 1);
          consumed = i + 1;
          continue;
        }
        // 第一个非选项，剩余全部作为内�?
        break;
      }
      if (consumed > 0 && consumed < tokens.length) {
        content = tokens.slice(consumed).join(' ');
      } else if (consumed === tokens.length) {
        // 只有参数没有内容，降级为空字符串
        content = '';
      }

      result.push({ kind: 'spoiler', styleType, color, value: content });
      lastIndex = re.lastIndex;
    }
    const rest = text.slice(lastIndex);
    if (rest) result.push({ kind: 'text', value: rest });
    return result;
  };

  // 解析并按自定义原�?HTML 片段分割文本
  // 语法：```__html\n ... 任意 HTML ... \n```
  const splitByRawHtml = (text) => {
    const result = [];
    const re = /```__html\s*\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > lastIndex) {
        result.push({ kind: 'text', value: text.slice(lastIndex, m.index) });
      }
      const html = (m[1] || '').trim();
      result.push({ kind: 'rawhtml', value: html });
      lastIndex = re.lastIndex;
    }
    if (lastIndex < text.length) {
      result.push({ kind: 'text', value: text.slice(lastIndex) });
    }
    return result;
  };

  const parts = parseContent(content);
  const { darkMode } = useTheme();

  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${currentFont !== 'default' ? 'custom-font-content' : ''}`}>
      {parts.map((part, index) => {
        if (part.type === 'tag') {
          const isSecondLevel = part.tagName.includes('/');
          const [parentTag, childTag] = isSecondLevel ? part.tagName.split('/') : [part.tagName, null];
          const isActive = part.tagName === activeTag;
          
          return (
            <span
              key={index}
              onClick={() => onTagClick(part.tagName === activeTag ? null : part.tagName)}
              className={`inline-block text-xs px-2 py-1 rounded-full cursor-pointer transition-colors mx-1 border ${
                isActive
                  ? ''
                  : isSecondLevel
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700 dark:hover:bg-blue-800/30'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 dark:border-gray-600'
              }`}
              style={isActive ? {
                backgroundColor: `${themeColor}20`,
                color: themeColor,
                borderColor: themeColor
              } : {}}
              title={part.content}
            >
              {isSecondLevel ? (
                <>
                  <span className="text-gray-500">#{parentTag}/</span>
                  <span className="font-medium">{childTag}</span>
                </>
              ) : (
                part.content
              )}
            </span>
          );
        } else {
          // 渲染文本部分：支�?__html 原样 HTML + spoiler + markdown
          const rawSegments = splitByRawHtml(part.content);
          return (
            <>
              {rawSegments.map((rawSeg, rawIdx) => {
                if (rawSeg.kind === 'rawhtml') {
                  // 直接渲染原样 HTML（来�?```__html ... ``` 块）
                  return (
                    <div key={`${index}-raw-${rawIdx}`} dangerouslySetInnerHTML={{ __html: rawSeg.value }} />
                  );
                }

                // 普通文本：先按 spoiler 切分，再交给 ReactMarkdown
                const segments = splitBySpoilers(rawSeg.value);
                const remarkEmojiShortcode = () => (tree) => {
                  const EMOJI_RE = /:([a-z0-9]+)_([a-z0-9_\-]+):/gi;
                  const isSkippableParent = (parent) => parent && (parent.type === 'code' || parent.type === 'inlineCode' || parent.type === 'link' || parent.type === 'image');
                  const walk = (node, parent) => {
                    if (!node || isSkippableParent(parent)) return;
                    if (Array.isArray(node.children)) {
                      // iterate copy because we'll modify
                      for (let i = 0; i < node.children.length; i++) {
                        const child = node.children[i];
                        if (child.type === 'text' && typeof child.value === 'string') {
                          const value = child.value;
                          let match;
                          let lastIndex = 0;
                          const newChildren = [];
                          while ((match = EMOJI_RE.exec(value)) !== null) {
                            const before = value.slice(lastIndex, match.index);
                            if (before) newChildren.push({ type: 'text', value: before });
                            const cat = (match[1] || '').toLowerCase();
                            const name = (match[2] || '').toLowerCase();
                            if (getEmojiCategory(cat)) {
                              const url = buildEmojiUrl(cat, name, 'png');
                              newChildren.push({ type: 'image', url, title: null, alt: `emoji:${cat}_${name}` });
                            } else {
                              // not supported category: keep original text
                              newChildren.push({ type: 'text', value: match[0] });
                            }
                            lastIndex = match.index + match[0].length;
                          }
                          if (newChildren.length > 0) {
                            const rest = value.slice(lastIndex);
                            if (rest) newChildren.push({ type: 'text', value: rest });
                            // replace current child with newChildren list
                            node.children.splice(i, 1, ...newChildren);
                            i += newChildren.length - 1;
                          }
                        } else {
                          walk(child, node);
                        }
                      }
                    }
                  };
                  walk(tree, null);
                };

                if (segments.length === 1 && segments[0].kind === 'text') {
                  return (
                    <ReactMarkdown
                      key={`${index}-md-${rawIdx}`}
                      components={{
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold my-2" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold my-2" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-md font-bold my-2" {...props} />,
                        p: ({node, ...props}) => <span className="whitespace-pre-wrap" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2" {...props} />,
                        li: ({node, ...props}) => <li className="my-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                        em: ({node, ...props}) => <em className="italic" {...props} />,
                        br: () => <br />,
                        img: ({node, ...props}) => {
                          const isEmoji = (props?.alt || '').startsWith('emoji:') || (props?.src || '').includes('/emoji/');
                          if (isEmoji) {
                            const alt = props?.alt || '';
                            const m = alt.match(/^emoji:([a-z0-9]+)_([a-z0-9_\-]+)/i);
                            const cat = m ? m[1] : null;
                            const name = m ? m[2] : null;
                            return (
                              <img
                                {...props}
                                style={{ height: '1em', width: 'auto', verticalAlign: '-0.2em', display: 'inline-block', margin: '0 0.1em', ...(props.style || {}) }}
                                onError={(e) => {
                                  if (!cat || !name) return;
                                  const currentExt = (e.currentTarget.src.match(/\.(\w+)(?:\?|#|$)/) || [,''])[1];
                                  const order = ['png', 'webp', 'gif'];
                                  const rest = order.filter(x => x !== currentExt);
                                  for (const ext of rest) {
                                    const candidate = buildEmojiUrl(cat, name, ext);
                                    if (e.currentTarget.src !== candidate) {
                                      e.currentTarget.src = candidate;
                                      return;
                                    }
                                  }
                                }}
                              />
                            );
                          }
                          return <img {...props} />;
                        },
                      }}
                      remarkPlugins={[remarkEmojiShortcode]}
                      rehypePlugins={[]}
                    >
                      {renderMarkdownText(segments[0].value)}
                    </ReactMarkdown>
                  );
                }

                // 多段（含 spoiler）的情况：处理前后换行与拼接
                let pendingBreaks = 0;
                let lastWasSpoiler = false;
                return (
                  <React.Fragment key={`${index}-mdsp-${rawIdx}`}>
                    {segments.map((seg, i) => {
                      const renderBreaks = (count, keyPrefix) => Array.from({ length: count }, (_, k) => <br key={`${index}-${keyPrefix}-${rawIdx}-${i}-${k}`} />);

                      if (seg.kind === 'spoiler') {
                        const beforeEls = [];
                        if (pendingBreaks > 0) {
                          beforeEls.push(...renderBreaks(pendingBreaks, 'pb'));
                          pendingBreaks = 0;
                        }
                        const el = (
                          <span key={`${index}-sp-wrap-${rawIdx}-${i}`}>
                            {beforeEls}
                            <Spoiler text={seg.value} styleType={seg.styleType} color={seg.color} />
                          </span>
                        );
                        lastWasSpoiler = true;
                        return el;
                      }

                      const prefixEls = [];
                      if (pendingBreaks > 0) {
                        prefixEls.push(...renderBreaks(pendingBreaks, 'pb'));
                        pendingBreaks = 0;
                      }

                      const leading = seg.value.match(/^[ \t]*\n+/);
                      const leadingBreaks = leading ? (leading[0].match(/\n/g) || []).length : 0;
                      if (leadingBreaks > 0) {
                        prefixEls.push(...renderBreaks(leadingBreaks, 'lb'));
                      } else if (lastWasSpoiler) {
                        prefixEls.push(' ');
                      }

                      let inner = seg.value.replace(/^[ \t]*\n+/, '');
                      const trailing = inner.match(/\n+[ \t]*$/);
                      const trailingBreaks = trailing ? (trailing[0].match(/\n/g) || []).length : 0;
                      inner = inner.replace(/\n+[ \t]*$/, '');

                      const node = (
                        <span key={`${index}-tx-wrap-${rawIdx}-${i}`}>
                          {prefixEls}
                          <ReactMarkdown
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-xl font-bold my-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-lg font-bold my-2" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-md font-bold my-2" {...props} />,
                              p: ({node, ...props}) => <span className="whitespace-pre-wrap" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-2" {...props} />,
                              ol: ({node, ...props}) => <ol className="list-decimal pl-5 my-2" {...props} />,
                              li: ({node, ...props}) => <li className="my-1" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                              em: ({node, ...props}) => <em className="italic" {...props} />,
                              br: () => <br />,
                              img: ({node, ...props}) => {
                                const isEmoji = (props?.alt || '').startsWith('emoji:') || (props?.src || '').includes('/emoji/');
                                if (isEmoji) {
                                  const alt = props?.alt || '';
                                  const m = alt.match(/^emoji:([a-z0-9]+)_([a-z0-9_\-]+)/i);
                                  const cat = m ? m[1] : null;
                                  const name = m ? m[2] : null;
                                  return (
                                    <img
                                      {...props}
                                      style={{ height: '1em', width: 'auto', verticalAlign: '-0.2em', display: 'inline-block', margin: '0 0.1em', ...(props.style || {}) }}
                                      onError={(e) => {
                                        if (!cat || !name) return;
                                        const currentExt = (e.currentTarget.src.match(/\.(\w+)(?:\?|#|$)/) || [,''])[1];
                                        const order = ['png', 'webp', 'gif'];
                                        const rest = order.filter(x => x !== currentExt);
                                        for (const ext of rest) {
                                          const candidate = buildEmojiUrl(cat, name, ext);
                                          if (e.currentTarget.src !== candidate) {
                                            e.currentTarget.src = candidate;
                                            return;
                                          }
                                        }
                                      }}
                                    />
                                  );
                                }
                                return <img {...props} />;
                              },
                            }}
                            remarkPlugins={[remarkEmojiShortcode]}
                            rehypePlugins={[]}
                          >
                            {renderMarkdownText(inner)}
                          </ReactMarkdown>
                        </span>
                      );

                      pendingBreaks = trailingBreaks;
                      lastWasSpoiler = false;
                      return node;
                    })}
                  </React.Fragment>
                );
              })}
            </>
          );
        }
      })}
    </div>
  );
};

export default ContentRenderer;
