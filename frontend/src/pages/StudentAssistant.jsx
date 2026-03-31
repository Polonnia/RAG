import React from 'react';
import { Card, Button, Row, Col, Space } from 'antd';
import { RobotOutlined, BookOutlined, ReadOutlined, FormOutlined, LineChartOutlined, MessageOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import PageHeader from '../components/PageHeader';

export default function StudentAssistant() {
  const navigate = useNavigate();

  const actionCards = [
    {
      title: '开始问答',
      desc: '基于知识库快速检索概念、公式与例题。',
      icon: <MessageOutlined style={{ color: '#1677ff' }} />,
      action: () => navigate('/qa'),
      button: '进入问答'
    },
    {
      title: '查看错题本',
      desc: '按知识点复盘错题，快速进入巩固练习。',
      icon: <BookOutlined style={{ color: '#faad14' }} />,
      action: () => navigate('/wrongbook'),
      button: '进入错题本'
    },
    {
      title: '查看学情分析',
      desc: '跟踪正确率趋势，定位薄弱知识点。',
      icon: <LineChartOutlined style={{ color: '#52c41a' }} />,
      action: () => navigate('/analysis'),
      button: '进入分析页'
    },
    {
      title: '继续考试',
      desc: '继续未完成考试或查看历次考试结果。',
      icon: <FormOutlined style={{ color: '#722ed1' }} />,
      action: () => navigate('/student'),
      button: '进入考试页'
    }
  ];

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
        <PageHeader
          title="学习助手"
          subtitle="为你提供学习路径建议和快捷入口"
          icon={<RobotOutlined />}
          variant="dashboard"
          extra={<span className="dashboard-subtitle">建议顺序：问答 -> 错题复盘 - 巩固练习 - 再测</span>}
        />

        <Row gutter={[16, 16]}>
          {actionCards.map((item) => (
            <Col xs={24} md={12} key={item.title}>
              <Card className="hover-lift" style={{ borderRadius: 16, minHeight: 190 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Space size={10}>
                    {item.icon}
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{item.title}</span>
                  </Space>
                  <span style={{ color: '#666' }}>{item.desc}</span>
                  <Button type="primary" onClick={item.action}>{item.button}</Button>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        <Card className="page-section" style={{ marginTop: 16, borderRadius: 16 }}>
          <Space direction="vertical" size={10}>
            <Space>
              <ReadOutlined style={{ color: '#1677ff' }} />
              <span style={{ fontWeight: 700 }}>学习策略建议</span>
            </Space>
            <span>1. 先在问答页快速澄清知识点，再回到错题本针对训练。</span>
            <span>2. 在学情分析页优先关注正确率低于 80% 的知识点。</span>
            <span>3. 完成巩固后再进行考试，提升检验效果。</span>
          </Space>
        </Card>
      </div>
    </AppLayout>
  );
}