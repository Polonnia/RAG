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
        <PageHeader
          title="虚拟人学习助手"
          subtitle="支持文字/语音问答，结合数字人进行互动学习"
          icon={<RobotOutlined />}
          variant="dashboard"
          extra={(
            <Space>
              <Tag color="blue" icon={<MessageOutlined />}>文字问答</Tag>
              <Tag color="cyan" icon={<AudioOutlined />}>语音问答</Tag>
            </Space>
          )}
        />

        <Card className="page-section" style={{ borderRadius: 16, marginBottom: 16 }}>
          <Row gutter={[12, 12]} align="middle" justify="space-between">
            <Col xs={24} md={16}>
              <Space direction="vertical" size={4}>
                <Text strong>当前数字人服务地址</Text>
                <Text code>{avatarUrl}</Text>
                <Text type="secondary">如需修改地址，可设置环境变量 REACT_APP_OPENAVATAR_URL。</Text>
              </Space>
            </Col>
            <Col xs={24} md="auto">
              <Space>
                <Button href="#/assistant" type="default">返回学习助手</Button>
                <Button type="primary" icon={<ExportOutlined />} onClick={() => window.open(avatarUrl, '_blank', 'noopener,noreferrer')}>
                  新窗口打开
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
          <iframe
            title="OpenAvatarChat"
            src={avatarUrl}
            style={{ width: '100%', height: '78vh', minHeight: 640, border: 'none', display: 'block', background: '#fff' }}
            allow="camera; microphone; autoplay; clipboard-read; clipboard-write"
            referrerPolicy="no-referrer"
          />
        </Card>
      </div>
    </AppLayout>
  );
}
