import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Spin, Result, Card, List, Tag, Divider, Typography } from 'antd';
import axios from 'axios';
import getApiUrl from '../apiConfig';
import AppLayout from '../components/layout/AppLayout';

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
        const res = await axios.get(`${getApiUrl()}/student/exam-result/${id}`);
        setResult(res.data);
        setAiSummary(res.data.ai_summary || '');
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
      <Card title={<span style={{ fontWeight: 700, fontSize: 20 }}>考试结果</span>} style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1' }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ color: '#52c41a', marginBottom: 8 }}>总分：{result.score}</Title>
          <Text type="secondary">用时：{minutes}分{seconds}秒</Text>
        </div>
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
                      {formatAnswer(a.student_answer)}
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
            {typeof aiSummary === 'string' && aiSummary.trim()
              ? aiSummary
              : <Text type="secondary">AI正在分析，请稍候...</Text>
            }
          </div>
        </div>
      </Card>
    </AppLayout>
  );
}
