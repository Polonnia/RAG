import React from 'react';
import { Breadcrumb, Button, Space, Tag, Tooltip } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { ClockCircleOutlined, MessageOutlined, BookOutlined, RocketOutlined } from '@ant-design/icons';

const routeNameMap = {
  '/knowledge': '知识库管理',
  '/qa': '知识库问答',
  '/teaching': '教学内容设计',
  '/exam': '考核内容生成',
  '/manage': '考试管理',
  '/grading': '试卷批改',
  '/student': '考试系统',
  '/analysis': '学情分析',
  '/wrongbook': '错题本',
  '/assistant': '学习助手',
  '/knowledge-graph': '知识图谱',
};

export default function HeaderBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [now, setNow] = React.useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const path = location.pathname;
  const section = routeNameMap[path] || '教学AI助手';
  const currentTime = now.toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <div
      className="topbar-shell"
      style={{
        minHeight: 64,
        background: 'rgba(244, 246, 250, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        borderBottom: '1px solid #e6eaf1',
        backdropFilter: 'blur(8px)'
      }}
    >
      <Space direction="vertical" size={2}>
        <Breadcrumb
          items={[
            { title: 'TraceLearn' },
            { title: section },
          ]}
        />
      </Space>

      <Space size={10}>
        <Tag icon={<ClockCircleOutlined />} color="blue" style={{ borderRadius: 999, padding: '4px 10px' }}>
          {currentTime}
        </Tag>
        <Tooltip title="进入知识库问答">
          <Button shape="circle" icon={<MessageOutlined />} onClick={() => navigate('/qa')} />
        </Tooltip>
        <Tooltip title="进入知识库管理">
          <Button shape="circle" icon={<BookOutlined />} onClick={() => navigate('/knowledge')} />
        </Tooltip>
        <Tooltip title="进入考核内容生成">
          <Button type="primary" shape="circle" icon={<RocketOutlined />} onClick={() => navigate('/exam')} />
        </Tooltip>
      </Space>
    </div>
  );
}


