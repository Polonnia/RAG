import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

const { Content, Footer } = Layout;

export default function AppLayout({ children, maxWidth = 1000 }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 220 }}>
        <HeaderBar />
        <Content
          style={{
            padding: '0',
            background: '#f4f6fa',
            minHeight: 800,
            fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, HarmonyOS Sans, Segoe UI, Arial, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: maxWidth * 1.5,
              margin: '0 auto',
              padding: 48,
              background: '#fff',
              borderRadius: 27,
              boxShadow: '0 6px 36px #e6eaf1',
              minHeight: 900
            }}
          >
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>
          教学AI助手 ©2025
        </Footer>
      </Layout>
    </Layout>
  );
}
