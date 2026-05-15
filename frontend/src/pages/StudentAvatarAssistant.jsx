import React, { useMemo } from 'react';
import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { RobotOutlined, MessageOutlined, AudioOutlined, ExportOutlined } from '@ant-design/icons';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;

function buildAvatarUrl() {
  // 检查是否在本地开发环境
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // 开发环境使用 localhost:8282，生产环境使用相对路径
  return isLocalhost ? 'http://localhost:8282/gradio' : '/avatar/gradio';
}

export default function StudentAvatarAssistant() {
  const avatarUrl = useMemo(() => buildAvatarUrl(), []);

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden', height: 'calc(100vh - 100px)' }}>
          <iframe
            title="OpenAvatarChat"
            src={avatarUrl}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block', background: '#fff' }}
            allow="camera; microphone; autoplay; clipboard-read; clipboard-write"
            referrerPolicy="no-referrer"
          />
        </Card>
      </div>
    </AppLayout>
  );
}