import React, { useCallback } from 'react';
import { message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

/**
 * 美化的拖拽上传区域组件
 * 教育科技风格 - 现代化交互
 */
export default function UploadArea({
  onUpload = () => {},
  accept = '.pdf,.docx,.txt',
  maxSize = 100 * 1024 * 1024, // 100MB
  description = '点击或拖拽文件到此区域上传',
  icon = null,
  loading = false
}) {
  const [dragActive, setDragActive] = React.useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const processFile = (file) => {
    // 验证文件大小
    if (file.size > maxSize) {
      message.error(`文件大小超过限制 (最大 ${maxSize / 1024 / 1024}MB)`);
      return;
    }

    // 验证文件类型
    const validTypes = accept.split(',').map(t => t.trim());
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    const fileType = file.type;

    const isValidType = validTypes.some(type => 
      fileExtension === type || fileType.includes(type.replace('.', ''))
    );

    if (!isValidType && accept !== '*') {
      message.error(`不支持的文件类型。请上传：${accept}`);
      return;
    }

    onUpload(file);
  };

  const handleClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) processFile(file);
    };
    input.click();
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={handleClick}
      style={{
        position: 'relative',
        padding: '48px 32px',
        border: dragActive 
          ? '2px solid #1677ff' 
          : '2px dashed #d9d9d9',
        borderRadius: '12px',
        background: dragActive 
          ? 'linear-gradient(135deg, #e6f0ff 0%, #f0f5ff 100%)' 
          : 'linear-gradient(135deg, #fafbfc 0%, #f5f7fb 100%)',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        textAlign: 'center',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        if (!dragActive) {
          e.currentTarget.style.borderColor = '#1677ff';
          e.currentTarget.style.background = 'linear-gradient(135deg, #f0f5ff 0%, #e6eaf1 100%)';
        }
      }}
      onMouseLeave={(e) => {
        if (!dragActive) {
          e.currentTarget.style.borderColor = '#d9d9d9';
          e.currentTarget.style.background = 'linear-gradient(135deg, #fafbfc 0%, #f5f7fb 100%)';
        }
      }}
    >
      {/* 背景动画 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: dragActive
            ? 'radial-gradient(circle, rgba(22,119,255,0.08) 1px, transparent 1px)'
            : 'none',
          backgroundSize: '20px 20px',
          pointerEvents: 'none',
          opacity: dragActive ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />

      {/* 内容 */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* 图标 */}
        <div style={{ marginBottom: '16px' }}>
          {icon || (
            <InboxOutlined 
              style={{
                fontSize: '48px',
                color: dragActive ? '#1677ff' : '#5b8def',
                transition: 'all 0.3s ease'
              }}
            />
          )}
        </div>

        {/* 文本 */}
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '16px',
            fontWeight: 700,
            color: '#1a1a1a'
          }}
        >
          {dragActive ? '释放鼠标上传文件' : '点击上传或拖拽文件到此'}
        </p>
        <p
          style={{
            margin: '0',
            fontSize: '13px',
            color: '#595959',
            fontWeight: 500
          }}
        >
          {description}
        </p>
        <p
          style={{
            margin: '12px 0 0 0',
            fontSize: '12px',
            color: '#8c8c8c',
            fontWeight: 400
          }}
        >
          支持单个文件，最大 {maxSize / 1024 / 1024}MB
        </p>
      </div>
    </div>
  );
}
