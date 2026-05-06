import React, { useMemo } from 'react';
import { Alert, Button, Card, Col, Row, Space, Tag, Typography } from 'antd';
import { RobotOutlined, MessageOutlined, AudioOutlined, ExportOutlined } from '@ant-design/icons';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/PageHeader';

const { Text } = Typography;

function buildAvatarUrl() {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocalhost ? 'http://localhost:8282/ui/index.html' : '/ui/index.html';
}

export default function StudentAssistant() {
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
                <Text type="secondary">若数字人未响应，请确保 OpenAvatarChat 服务已启动。</Text>
              </Space>
            </Col>
            <Col xs={24} md="auto">
              <Button type="primary" icon={<ExportOutlined />} onClick={() => window.open(avatarUrl, '_blank', 'noopener,noreferrer')}>
                新窗口打开
              </Button>
            </Col>
          </Row>
        </Card>

        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16, borderRadius: 12 }}
          message="若嵌入区域为空，请点击'新窗口打开'"
          description="部分浏览器会限制 iframe 摄像头/麦克风权限。建议在同域名下部署 OpenAvatarChat，或通过新窗口单独访问。"
        />

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