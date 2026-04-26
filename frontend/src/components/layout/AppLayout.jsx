import React from 'react';
import { Layout, FloatButton, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { HomeOutlined, MessageOutlined, RocketOutlined, BarChartOutlined } from '@ant-design/icons';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';
import { getUser } from '../../auth/authUtils';

const { Content, Footer } = Layout;

export default function AppLayout({ children, maxWidth = 1000, immersive = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();
  const isStudent = user?.role === 'student';
  const contentHeight = 'calc(100vh - 64px)';

  const quickActions = isStudent
    ? [
        { key: 'home', icon: <HomeOutlined />, tip: '考试系统', path: '/student' },
        { key: 'qa', icon: <MessageOutlined />, tip: '知识库问答', path: '/qa' },
        { key: 'analysis', icon: <BarChartOutlined />, tip: '学情分析', path: '/analysis' },
      ]
    : [
        { key: 'home', icon: <HomeOutlined />, tip: '知识库管理', path: '/knowledge' },
        { key: 'qa', icon: <MessageOutlined />, tip: '知识库问答', path: '/qa' },
        { key: 'exam', icon: <RocketOutlined />, tip: '考核内容生成', path: '/exam' },
      ];

  return (
    <Layout className="app-shell" style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 220 }}>
        <HeaderBar />
        <Content
          style={{
            padding: '0',
            background: immersive ? '#0b121d' : '#f4f6fa',
            minHeight: immersive ? contentHeight : 800,
            height: immersive ? contentHeight : undefined,
            overflow: immersive ? 'hidden' : 'visible',
            fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, HarmonyOS Sans, Segoe UI, Arial, sans-serif'
          }}
        >
          {!immersive ? (
            <div className="app-bg-layer" aria-hidden="true">
              <span className="bg-orb bg-orb-1" />
              <span className="bg-orb bg-orb-2" />
              <span className="bg-orb bg-orb-3" />
            </div>
          ) : null}
          <div
            className="app-content-shell"
            style={{
              maxWidth: immersive ? '100%' : maxWidth * 1.5,
              margin: immersive ? '0' : '0 auto',
              padding: immersive ? 0 : 48,
              background: immersive ? 'transparent' : '#fff',
              borderRadius: immersive ? 0 : 27,
              boxShadow: immersive ? 'none' : '0 6px 36px #e6eaf1',
              minHeight: immersive ? contentHeight : 900,
              height: immersive ? contentHeight : undefined,
              overflow: immersive ? 'hidden' : 'visible'
            }}
          >
            {children}
          </div>
        </Content>
        {!immersive ? (
          <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>
            教学AI助手 ©2025
          </Footer>
        ) : null}
      </Layout>
      {!immersive ? (
        <FloatButton.Group shape="circle" style={{ right: 28, bottom: 28 }} trigger="hover" icon={<RocketOutlined />}>
          {quickActions.map((item) => (
            <Tooltip title={item.tip} key={item.key} placement="left">
              <FloatButton
                icon={item.icon}
                onClick={() => {
                  if (location.pathname !== item.path) {
                    navigate(item.path);
                  }
                }}
              />
            </Tooltip>
          ))}
        </FloatButton.Group>
      ) : null}
    </Layout>
  );
}
