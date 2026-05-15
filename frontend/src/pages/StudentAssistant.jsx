import React, { useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';

function buildAvatarUrl() {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost ? 'http://localhost:8282/ui/index.html' : '/ui/index.html';
}

export default function StudentAssistant() {
  const avatarUrl = useMemo(() => buildAvatarUrl(), []);

  return (
    <AppLayout>
      {/* 关键：用绝对定位+负边距完全突破父容器的 padding */}
      <div 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <iframe
          title="OpenAvatarChat"
          src={avatarUrl}
          style={{ 
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            margin: 0,
            padding: 0,
            overflow: 'hidden',
            boxSizing: 'border-box',
            // 适度放大，确保完全覆盖边缘，可按需调整 scale 值
            transform: 'scale(1.05)',
            transformOrigin: 'center center'
          }}
          allow="camera; microphone; autoplay; clipboard-read; clipboard-write"
          referrerPolicy="no-referrer"
          scrolling="no"
          frameBorder="0"
        />
      </div>
    </AppLayout>
  );
}