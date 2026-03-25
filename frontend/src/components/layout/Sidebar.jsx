import React from 'react';
import { Layout, Menu } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { BookOutlined, DatabaseOutlined, FileTextOutlined, FormOutlined, CheckCircleOutlined, BarChartOutlined, RobotOutlined } from '@ant-design/icons';
import { getUser } from '../../auth/authUtils';

const { Sider } = Layout;

// 教师菜单
const teacherMenuItems = [
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库管理', path: '/knowledge' },
  { key: 'qa', icon: <BookOutlined />, label: '知识库问答', path: '/qa' },
  { key: 'teaching', icon: <FileTextOutlined />, label: '教学内容设计', path: '/teaching' },
  { key: 'exam', icon: <FormOutlined />, label: '考核内容生成', path: '/exam' },
  { key: 'manage', icon: <FormOutlined />, label: '考试管理', path: '/manage' },
  { key: 'grading', icon: <CheckCircleOutlined />, label: '试卷批改', path: '/grading' }
];

// 学生菜单
const studentMenuItems = [
  { key: 'qa', icon: <BookOutlined />, label: '知识库问答', path: '/qa' },
  { key: 'student', icon: <FormOutlined />, label: '考试系统', path: '/student' },
  { key: 'analysis', icon: <BarChartOutlined />, label: '学情分析', path: '/analysis' },
  { key: 'wrongbook', icon: <BookOutlined />, label: '错题本', path: '/wrongbook' },
  { key: 'assistant', icon: <RobotOutlined />, label: '学习助手', path: '/assistant' }
];

function getSelectedKey(pathname) {
  if (pathname.startsWith('/exam/')) return 'manage';
  if (pathname.startsWith('/qa')) return 'qa';
  if (pathname.startsWith('/teaching')) return 'teaching';
  if (pathname.startsWith('/exam')) return 'exam';
  if (pathname.startsWith('/manage')) return 'manage';
  if (pathname.startsWith('/grading')) return 'grading';
  if (pathname.startsWith('/student')) return 'student';
  if (pathname.startsWith('/analysis')) return 'analysis';
  if (pathname.startsWith('/wrongbook')) return 'wrongbook';
  if (pathname.startsWith('/assistant')) return 'assistant';
  if (pathname.startsWith('/knowledge')) return 'knowledge';
  return 'qa';
}

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getUser();

  // 调试输出
  console.log('[Sidebar] 当前用户信息:', user);
  console.log('[Sidebar] 用户角色:', user?.role);
  console.log('[Sidebar] localStorage user:', localStorage.getItem('user'));

  // 根据用户角色选择菜单
  const menuItems = user?.role === 'student' ? studentMenuItems : teacherMenuItems;

  console.log('[Sidebar] 选择的菜单:', user?.role === 'student' ? 'studentMenuItems' : 'teacherMenuItems');
  console.log('[Sidebar] 菜单项数量:', menuItems.length);

  return (
    <Sider
      width={220}
      style={{
        background: '#f4f6fa',
        boxShadow: '2px 0 8px #e6eaf1',
        borderRight: '1.5px solid #e6eaf1',
        paddingTop: 0
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 22,
          color: '#1677ff',
          letterSpacing: 2,
          marginBottom: 16,
          background: '#1677ff',
          borderRadius: '0 0 18px 18px',
          boxShadow: '0 2px 8px #e6eaf1'
        }}
      >
        <BookOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
        <span style={{ color: '#fff' }}>{user?.role === 'student' ? '学生端' : '教师端'}</span>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey(location.pathname)]}
        onClick={({ key }) => {
          const item = menuItems.find(i => i.key === key);
          if (item && item.path) navigate(item.path);
        }}
        style={{
          height: '100%',
          borderRight: 0,
          fontSize: 18,
          background: '#f4f6fa',
          fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, HarmonyOS Sans, Segoe UI, Arial, sans-serif',
          fontWeight: 500
        }}
        items={menuItems.map(item => ({
          ...item,
          style: {
            borderRadius: 10,
            margin: '6px 8px',
            transition: 'background 0.2s'
          }
        }))}
        theme="light"
      />
    </Sider>
  );
}


