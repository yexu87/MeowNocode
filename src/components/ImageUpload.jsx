import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon, Link } from 'lucide-react';
import { toast } from 'sonner';
import s3StorageService from '@/lib/s3Storage';

const ImageUpload = ({ value, onChange, onClear, className = '', uploadType = 'image' }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);

  // 处理文件选择
  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('请选择有效的图片文件');
      return;
    }

    // 若已配置 S3，优先直传到 S3
    const tryUploadToS3 = async () => {
      try {
        if (s3StorageService.isConfigured()) {
          toast.loading('正在上传图片到S3...', { id: 'img-upload' });
          const result = await s3StorageService.uploadFile(file, {
            type: uploadType || 'image',
            onProgress: (stage, progress) => {
              if (stage === 'uploading') {
                toast.loading(`上传中... ${progress}%`, { id: 'img-upload' });
              }
            }
          });
          toast.success('已上传到S3', { id: 'img-upload' });
          onChange(result.url);
          return true;
        }
      } catch (e) {
        console.error('S3 上传图片失败，回退为本地 Base64:', e);
        toast.error(`S3上传失败，已回退本地：${e?.message || ''}`, { id: 'img-upload' });
      }
      return false;
    };

    const fallbackToBase64 = () => {
      // 仅转为 dataURL 返回，不再写入 localStorage，避免配额问题
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target.result;
        onChange(base64);
      };
      reader.readAsDataURL(file);
    };

    // 执行上传或回退
    tryUploadToS3().then((ok) => {
      if (!ok) fallbackToBase64();
    });
  }, [onChange]);

  // 处理文件输入变化
  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 处理拖拽
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // 处理URL输入
  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;

    setIsLoading(true);

    // 简单的URL验证
    try {
      new URL(urlInput);
      // 创建图片元素来验证URL是否有效
      const img = new Image();
      img.onload = () => {
        onChange(urlInput);
        setUrlInput('');
        setIsLoading(false);
      };
      img.onerror = () => {
        alert('无法加载该图片URL，请检查链接是否正确');
        setIsLoading(false);
      };
      img.src = urlInput;
    } catch (error) {
      alert('请输入有效的URL');
      setIsLoading(false);
    }
  };

  // 处理粘贴
  const handlePaste = (e) => {
    const items = e.clipboardData.items;
    
    for (let item of items) {
      if (item.type.startsWith('image/')) {
        // 粘贴的是图片文件
        const file = item.getAsFile();
        handleFileSelect(file);
        return;
      } else if (item.type === 'text/plain') {
        // 粘贴的是文本，可能是URL
        item.getAsString((text) => {
          if (text.match(/^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i)) {
            setUrlInput(text);
          }
        });
      }
    }
  };

  // 清除图片
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 如果有背景图片，显示预览 */}
      {value ? (
        <div className="relative">
          <div className="w-full h-32 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-600">
            <img
              src={value}
              alt="背景预览"
              className="w-full h-full object-cover"
            />
          </div>
          <Button
            onClick={handleClear}
            variant="destructive"
            size="sm"
            className="absolute top-2 right-2 h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <>
          {/* 链接输入框 - 始终显示 */}
          <div className="space-y-2">
            <div className="flex space-x-2">
              <div className="flex items-center space-x-2 flex-1">
                <Link className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="粘贴图片直链..."
                  onPaste={handlePaste}
                  className="flex-1"
                />
              </div>
              <Button onClick={handleUrlSubmit} size="sm" disabled={isLoading || !urlInput.trim()}>
                {isLoading ? '验证中...' : '确定'}
              </Button>
            </div>
          </div>

          {/* 拖拽上传区域 */}
          <div
            className={`
              border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${isDragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
              }
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            onPaste={handlePaste}
            tabIndex={0}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="space-y-2">
              <ImageIcon className="h-8 w-8 mx-auto text-gray-400" />
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>拖拽图片到此处，或点击选择文件</p>
                <p className="text-xs mt-1">支持 JPG、PNG、GIF、WebP 格式</p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ImageUpload;
