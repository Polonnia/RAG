import React from 'react';
import { Layout, Menu, Button, Avatar, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BookOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  BarChartOutlined,
  RobotOutlined,
  LogoutOutlined,
  SolutionOutlined,
  FileSearchOutlined,
  ReadOutlined,
  UserOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { getUser } from '../../auth/authUtils';
import { logout } from '../../services/authService';

const { Sider } = Layout;

// 教师菜单
const teacherMenuItems = [
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库管理', path: '/knowledge' },
  { key: 'qa', icon: <FileSearchOutlined />, label: '知识库问答', path: '/qa' },
  { key: 'teaching', icon: <ReadOutlined />, label: '教学内容设计', path: '/teaching' },
  { key: 'exam', icon: <FileTextOutlined />, label: '考核内容生成', path: '/exam' },
  { key: 'manage', icon: <SolutionOutlined />, label: '考试管理', path: '/manage' },
  { key: 'grading', icon: <CheckCircleOutlined />, label: '试卷批改', path: '/grading' }
];

// 学生菜单
const studentMenuItems = [
  { key: 'qa', icon: <BookOutlined />, label: '知识库问答', path: '/qa' },
  { key: 'student', icon: <TrophyOutlined />, label: '考试系统', path: '/student' },
  { key: 'analysis', icon: <BarChartOutlined />, label: '学情分析', path: '/analysis' },
  { key: 'wrongbook', icon: <FileTextOutlined />, label: '错题本', path: '/wrongbook' },
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

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      className="sidebar-shell"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        width: 220,
        background: '#f4f6fa',
        boxShadow: '2px 0 8px #e6eaf1',
        borderRight: '1.5px solid #e6eaf1',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        overflow: 'hidden'
      }}
    >
      <div className="sidebar-glow" aria-hidden="true" />
      <div
        className="sidebar-brand"
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
          boxShadow: '0 2px 8px #e6eaf1',
          flexShrink: 0
        }}
      >
        <Avatar
          size={34}
          icon={<UserOutlined />}
          style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', marginRight: 10 }}
        />
        <span style={{ color: '#fff' }}>{user?.role === 'student' ? '学生端' : '教师端'}</span>
      </div>
      <div style={{ padding: '0 12px 8px' }}>
        <div className="sidebar-role-chip" style={{ fontSize: 16 }}>{user?.role === 'student' ? 'Student Mode' : 'Teacher Mode'}</div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[getSelectedKey(location.pathname)]}
        onClick={({ key }) => {
          const item = menuItems.find(i => i.key === key);
          if (item && item.path) navigate(item.path);
        }}
        style={{
          flex: 1,
          borderRight: 0,
          fontSize: 18,
          background: '#f4f6fa',
          fontFamily: 'Noto Sans SC, Microsoft YaHei, PingFang SC, HarmonyOS Sans, Segoe UI, Arial, sans-serif',
          fontWeight: 500,
          overflow: 'hidden'
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
      <div
        style={{
          padding: '16px 12px',
          borderTop: '1px solid #e6eaf1',
          background: '#f4f6fa',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0
        }}
      >
        <Tooltip title="安全退出当前账号" placement="right">
          <Button
            type="primary"
            icon={<LogoutOutlined />}
            onClick={handleLogout}
            style={{
              borderRadius: 20,
              fontWeight: 500,
              fontSize: 14,
              width: '100%',
              height: 40
            }}
            size="middle"
          >
            退出登录
          </Button>
        </Tooltip>
      </div>
    </div>
  );
}


