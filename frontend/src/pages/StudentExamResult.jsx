import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Result, Card, List, Tag, Divider, Typography, Button, Row, Col, Progress } from 'antd';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import AppLayout from '../components/layout/AppLayout';
import { getExamResult } from '../services/studentExamService';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';

const { Text, Title } = Typography;

export default function StudentExamResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiSummary, setAiSummary] = useState('');

  useEffect(() => {
    const fetchResult = async () => {
      setLoading(true);
      try {
        const data = await getExamResult(id);
        setResult(data);
        setAiSummary(data.ai_summary || '');
      } catch (e) {
        console.error('获取考试结果失败:', e);
        setResult(null);
      }
      setLoading(false);
    };
    fetchResult();
  }, [id]);

  if (loading) return <AppLayout><Spin style={{ marginTop: 80 }} /></AppLayout>;
  if (!result) return <AppLayout><Result status="error" title="未找到考试结果" /></AppLayout>;

  // 计算用时
  const start = new Date(result.start_time);
  const end = new Date(result.end_time);
  const duration = Math.round((end - start) / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;

  const formatAnswer = (ans) => {
    if (ans === null || ans === undefined) return '--';
    if (Array.isArray(ans)) return ans.join(', ');
    return String(ans);
  };

  return (
    <AppLayout>
      <div className="page-content-wrap page-enter">
      <PageHeader
        title="考试结果"
        subtitle={`用时：${minutes}分${seconds}秒`}
        variant="dashboard"
        action={<Button onClick={() => navigate('/student')}>返回考试列表</Button>}
      />

      <Card style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={8}>
            <StatCard title="本次得分" value={result.score || 0} color="#52c41a" />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <StatCard title="题目数量" value={(result.answers || []).length} color="#1677ff" />
          </Col>
          <Col xs={24} sm={24} md={8}>
            <Card size="small" style={{ borderRadius: 12 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>完成进度</div>
              <Progress percent={100} status="success" />
            </Card>
          </Col>
        </Row>
        <Divider />

        <List
          dataSource={result.answers || []}
          renderItem={(a, idx) => (
            <List.Item style={{ marginBottom: 24 }}>
              <Card style={{ width: '100%', borderRadius: 12 }}>
                {/* 题干部分 */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>第 {idx + 1} 题 ({a.points} 分)</Text>
                    <Tag style={{ marginLeft: 8 }}>
                      {a.type === 'choice' ? '单选题' : 
                       a.type === 'multi' ? '多选题' : 
                       a.type === 'fill_blank' ? '填空题' : 
                       a.type === 'short_answer' ? '简答题' : 
                       a.type === 'programming' ? '编程题' : 
                       a.type}
                    </Tag>
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Text>{a.question}</Text>
                  </div>
                </div>

                {/* 显示选项 */}
                {(a.type === 'choice' || a.type === 'multi') && a.options && Object.keys(a.options).length > 0 && (
                  <div style={{ marginBottom: 16, paddingLeft: 16, borderLeft: '2px solid #eee' }}>
                    {Object.entries(a.options).map(([key, value]) => (
                      <div key={key} style={{ marginBottom: 4 }}>
                        <Text>{key}. {value}</Text>
                      </div>
                    ))}
                  </div>
                )}

                {/* 结果与评分 */}
                <div style={{ marginBottom: 12 }}>
                  {['short_answer', 'programming'].includes(a.type) ? (
                    a.is_correct === null ? (
                      <Tag color="orange">待批改</Tag>
                    ) : (
                      <Tag color={a.is_correct ? 'green' : 'red'}>{a.is_correct ? '正确' : '错误'}</Tag>
                    )
                  ) : (
                    <Tag color={a.is_correct ? 'green' : 'red'}>{a.is_correct ? '正确' : '错误'}</Tag>
                  )}
                  <span style={{ marginLeft: 12, color: '#666' }}>
                    得分：{a.is_correct === null ? '--' : a.points_earned}/{a.points}
                  </span>
                </div>

                {/* 答案和解析 */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>你的答案：</Text>
                    <div style={{ marginLeft: 16, color: '#666' }}>
                      {formatAnswer(a.answer)}
                    </div>
                  </div>
                  {a.type !== 'short_answer' && a.type !== 'programming' && (
                    <div style={{ marginBottom: 8 }}>
                      <Text strong>正确答案：</Text>
                      <div style={{ marginLeft: 16, color: '#52c41a' }}>
                        {formatAnswer(a.correct_answer)}
                      </div>
                    </div>
                  )}
                  <div style={{ marginBottom: 8 }}>
                    <Text strong>解析：</Text>
                    <div style={{ marginLeft: 16, color: '#666' }}>
                      {a.explanation || '暂无解析'}
                    </div>
                  </div>
                </div>

                {/* 显示知识点 */}
                {a.knowledge_points && a.knowledge_points.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>知识点：</Text>
                    <div style={{ marginLeft: 16 }}>
                      {Array.isArray(a.knowledge_points) ? 
                        a.knowledge_points.map((kp, i) => (
                          <Tag key={i} color="blue" style={{ marginRight: 8, marginBottom: 8 }}>
                            {kp}
                          </Tag>
                        )) : 
                        <Tag color="blue">{a.knowledge_points}</Tag>
                      }
                    </div>
                  </div>
                )}

                {/* 显示老师评语 */}
                {['short_answer', 'programming'].includes(a.type) && a.is_correct !== null && (
                  <div>
                    <Text strong>老师评语：</Text>
                    <div style={{ marginLeft: 16, color: '#666' }}>
                      {a.comment || '暂无评语'}
                    </div>
                  </div>
                )}
              </Card>
            </List.Item>
          )}
        />

        <Divider />

        <div>
          <Title level={4}>AI总结你的薄弱点</Title>
          <div style={{ 
            minHeight: 60, 
            padding: 16, 
            background: '#f5f5f5', 
            borderRadius: 8,
            lineHeight: 1.6,
            color: '#333'
          }}>
            {typeof aiSummary === 'string' && aiSummary.trim() ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p style={{ margin: '8px 0' }}>{children}</p>,
                  h1: ({ children }) => <h1 style={{ fontSize: 20, fontWeight: 700, margin: '12px 0 8px 0' }}>{children}</h1>,
                  h2: ({ children }) => <h2 style={{ fontSize: 16, fontWeight: 600, margin: '10px 0 6px 0' }}>{children}</h2>,
                  h3: ({ children }) => <h3 style={{ fontSize: 14, fontWeight: 600, margin: '8px 0 4px 0' }}>{children}</h3>,
                  ul: ({ children }) => <ul style={{ marginLeft: 20, margin: '8px 0' }}>{children}</ul>,
                  ol: ({ children }) => <ol style={{ marginLeft: 20, margin: '8px 0' }}>{children}</ol>,
                  li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                  code: ({ children }) => <code style={{ background: '#f0f0f0', padding: '2px 6px', borderRadius: 3, fontFamily: 'monospace' }}>{children}</code>,
                  blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid #1677ff', paddingLeft: 12, margin: '8px 0', color: '#666' }}>{children}</blockquote>,
                  table: ({ children }) => <table style={{ width: '100%', borderCollapse: 'collapse', margin: '8px 0' }}>{children}</table>,
                  th: ({ children }) => <th style={{ border: '1px solid #d9d9d9', background: '#f5f5f5', padding: '8px', textAlign: 'left' }}>{children}</th>,
                  td: ({ children }) => <td style={{ border: '1px solid #f0f0f0', padding: '8px' }}>{children}</td>,
                }}
              >
                {aiSummary}
              </ReactMarkdown>
            ) : (
              <Text type="secondary">AI正在分析，请稍候...</Text>
            )}
          </div>
        </div>
      </Card>
      </div>
    </AppLayout>
  );
}
