import React from 'react';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import HeaderBar from './HeaderBar';

const { Content, Footer } = Layout;

export default function AppLayout({ children, maxWidth = 1000 }) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout>
        <HeaderBar />
        <Content
          style={{
            padding: '48px 0',
            background: '#f4f6fa',
            minHeight: 800,
            fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, HarmonyOS Sans, Segoe UI, Arial, sans-serif'
          }}
        >
          <div
            style={{
              maxWidth: maxWidth,
              margin: '0 auto',
              padding: 32,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 4px 24px #e6eaf1',
              minHeight: 600
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
