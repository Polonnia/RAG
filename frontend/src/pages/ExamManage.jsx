import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Card, Col, Empty, Input, Row, Select, Space, Tag } from 'antd';
import { FormOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { listTeacherExams } from '../services/examTeacherService';
import PageHeader from '../components/PageHeader';

export default function ExamManage() {
  const [exams, setExams] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [sortMode, setSortMode] = useState('newest');
  const navigate = useNavigate();
  useEffect(() => { listTeacherExams().then(r => setExams(r.exams || [])); }, []);

  const filteredExams = [...exams]
    .filter((item) => {
      const key = keyword.trim().toLowerCase();
      if (!key) return true;
      return `${item.title || ''} ${item.description || ''}`.toLowerCase().includes(key);
    })
    .sort((a, b) => {
      if (sortMode === 'name') return String(a.title || '').localeCompare(String(b.title || ''), 'zh-CN');
      return (b.id || 0) - (a.id || 0);
    });

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
        <PageHeader
          title="考试管理"
          subtitle="检索、筛选并快速进入考试详情"
          icon={<FormOutlined />}
          variant="dashboard"
        />

        <Card className="page-section" style={{ borderRadius: 14 }}>
          <Space wrap size={12} style={{ width: '100%', justifyContent: 'space-between' }}>
            <Input
              placeholder="按考试标题或描述检索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              allowClear
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
            />
            <Space>
              <span className="dashboard-subtitle">排序</span>
              <Select
                value={sortMode}
                onChange={setSortMode}
                style={{ width: 160 }}
                options={[
                  { value: 'newest', label: '最新创建' },
                  { value: 'name', label: '按名称' }
                ]}
              />
            </Space>
          </Space>
        </Card>

        {filteredExams.length === 0 ? (
          <Card className="page-section">
            <Empty description="暂无考试或未匹配到结果" />
          </Card>
        ) : (
          <Row gutter={[16, 16]} className="fade-in-up">
            {filteredExams.map((exam) => (
              <Col xs={24} sm={12} xl={8} key={exam.id}>
                <Card
                  className="hover-lift"
                  title={
                    <Space size={8}>
                      <span style={{ fontWeight: 700 }}>{exam.title}</span>
                      <Tag color="processing">考试</Tag>
                    </Space>
                  }
                  extra={<Tag color="blue">ID {exam.id}</Tag>}
                  style={{ borderRadius: 14, minHeight: 210 }}
                >
                  <p style={{ color: '#666', minHeight: 56, marginBottom: 12 }}>{exam.description || '暂无描述'}</p>
                  <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                    <span className="dashboard-subtitle">进入详情查看题目与学情分析</span>
                    <Button type="primary" onClick={() => navigate(`/exam/${exam.id}`)}>查看详情</Button>
                  </Space>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </div>
    </AppLayout>
  );
}


