import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, List, Tag, Button, Table, Typography, message, Tabs, Spin } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { fetchExamDetail, fetchExamAnalysis, allowStudentRetake } from './services/examService';
import ReactECharts from 'echarts-for-react';

const { TabPane } = Tabs;
const { Title, Text } = Typography;

const typeMap = {
  choice: '单选题',
  multi: '多选题',
  fill_blank: '填空题',
  short_answer: '简答题',
  programming: '编程题'
};


// 工具函数：将多选答案转为规范字符串
function formatMultiAnswer(ans) {
  if (!ans) return '';
  let arr = ans;
  if (typeof ans === 'string') {
    try {
      arr = JSON.parse(ans);
    } catch {
      arr = [ans];
    }
  }
  if (Array.isArray(arr)) {
    // 统一顺序
    return arr.slice().sort().join('、');
  }
  return String(ans);
}

// 工具函数：通用显示学生作答
function formatAnswer(ans) {
  if (Array.isArray(ans)) return ans.join('、');
  if (typeof ans === 'object' && ans !== null) return JSON.stringify(ans);
  return ans ?? '--';
}

// 尝试把可能是数组/JSON字符串/普通字符串的知识点渲染成“、”分隔
function renderKnowledge(v) {
  if (Array.isArray(v)) return v.join('、');
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return s;
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) return arr.join('、');
      } catch {}
    }
    return s;
  }
  return v;
}

import AppLayout from './components/layout/AppLayout';

export default function ExamDetail() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const navigate = useNavigate();
  

  // 拉取考试与作答数据
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const { exam: examData, students: studentList } = await fetchExamDetail(examId);
        setExam(examData);
        setStudents(studentList);
      } catch (err) {
        // message.error('加载考试数据失败');
      }
      setLoading(false);
    };
    fetchData();
  }, [examId]);

  // 新增：加载学情分析
  useEffect(() => {
    setAnalysisLoading(true);
    fetchExamAnalysis(examId)
      .then(setAnalysis)
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, [examId]);

  

  // 学情分析Tab内容
  const renderAnalysisTab = () => (
    <Card style={{ marginTop: 24 }}>
      <Title level={4}>学情分析</Title>
      {analysisLoading ? (
        <Spin />
      ) : analysis ? (
        <>
          <Title level={5}>AI教学建议</Title>
          <div style={{ marginBottom: 16 }}>{analysis.ai_suggestion}</div>

          <Title level={5}>知识点掌握情况</Title>
          <Table
            dataSource={Object.entries(analysis.knowledge_stats).map(([k, v]) => ({
              key: k,
              knowledge: k,
              total: v.total,
              wrong: v.wrong,
              accuracy: v.total > 0 ? (((v.total - v.wrong) / v.total) * 100).toFixed(1) + '%' : '--'
            }))}
            columns={[
              { title: '知识点', dataIndex: 'knowledge', key: 'knowledge', render: renderKnowledge },
              { title: '答题数', dataIndex: 'total', key: 'total' },
              { title: '错误数', dataIndex: 'wrong', key: 'wrong' },
              { title: '正确率', dataIndex: 'accuracy', key: 'accuracy' }
            ]}
            pagination={false}
            size="small"
            style={{ marginBottom: 24 }}
          />

          <Title level={5}>题目错误统计</Title>
          <Table
            dataSource={Object.entries(analysis.question_stats).map(([k, v]) => ({
              key: k,
              question: v.text,
              total: v.total,
              wrong: v.wrong,
              knowledge: v.knowledge_points
            }))}
            columns={[
              { title: '题目', dataIndex: 'question', key: 'question', width: 300 },
              { title: '答题数', dataIndex: 'total', key: 'total' },
              { title: '错误数', dataIndex: 'wrong', key: 'wrong' },
              { title: '知识点', dataIndex: 'knowledge', key: 'knowledge', render: renderKnowledge }
            ]}
            pagination={false}
            size="small"
          />
        </>
      ) : (
        <div>暂无数据</div>
      )}
    </Card>
  );

  return (
    <AppLayout maxWidth={900}>
            <Button
              onClick={() => navigate(-1)}
              style={{
                marginBottom: 16,
                background: '#1677ff',
                color: '#fff',
                borderRadius: 18,
                fontWeight: 500,
                boxShadow: '0 2px 8px #e6eaf1',
                border: 'none'
              }}
            >
              返回
            </Button>

            <Tabs defaultActiveKey="detail" style={{ marginTop: 24 }}>
              <TabPane tab="考试详情" key="detail">
                <Card
                  loading={loading}
                  title={<span style={{ fontWeight: 700, fontSize: 20 }}>考试详情</span>}
                  style={{ borderRadius: 16, boxShadow: '0 2px 12px #e6eaf1', marginBottom: 24 }}
                  bodyStyle={{ borderRadius: 16 }}
                >
                  {exam && (
                    <>
                      <Title level={4} style={{ fontWeight: 700 }}>
                        {exam.exam.title}
                      </Title>
                      <Text type="secondary" style={{ fontSize: 16 }}>
                        {exam.exam.description}
                      </Text>
                      <div style={{ margin: '12px 0' }}>
                        <Tag
                          style={{
                            borderRadius: 8,
                            fontSize: 15,
                            padding: '2px 12px',
                            color: '#222',
                            border: '1.5px solid #d9d9d9',
                            background: '#fff',
                            marginRight: 8
                          }}
                        >
                          时长: {exam.exam.duration} 分钟
                        </Tag>
                        <Tag
                          style={{
                            borderRadius: 8,
                            fontSize: 15,
                            padding: '2px 12px',
                            color: '#222',
                            border: '1.5px solid #d9d9d9',
                            background: '#fff'
                          }}
                        >
                          创建时间: {exam.exam.created_at ? exam.exam.created_at.replace('T', ' ').slice(0, 16) : ''}
                        </Tag>
                      </div>

                      <Title level={5} style={{ fontWeight: 600 }}>
                        题目列表
                      </Title>
                      <List
                        dataSource={exam.questions}
                        renderItem={(q, idx) => (
                          <List.Item style={{ padding: 0, border: 'none' }}>
                            <Card
                              style={{ width: '100%', marginBottom: 16, background: '#fafcff', borderRadius: 14, boxShadow: '0 1px 6px #e6eaf1' }}
                              bodyStyle={{ padding: 16 }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                                <Tag
                                  style={{
                                    fontSize: 16,
                                    marginRight: 8,
                                    borderRadius: 8,
                                    padding: '2px 10px',
                                    color: '#222',
                                    border: '1.5px solid #d9d9d9',
                                    background: '#fff'
                                  }}
                                >
                                  [{q.points}分]
                                </Tag>
                                <span style={{ fontWeight: 'bold', fontSize: 16, marginRight: 8 }}>第{idx + 1}题</span>
                                <Tag color="#1677ff" style={{ fontSize: 16, borderRadius: 8, padding: '2px 10px' }}>
                                  {typeMap[q.type] || q.type}
                                </Tag>
                              </div>

                              <div style={{ fontSize: 16, marginBottom: 8 }}>{q.question}</div>

                              {q.options && Object.keys(q.options).length > 0 && (
                                <div style={{ marginBottom: 8 }}>
                                  {Object.entries(q.options).map(([k, v]) => (
                                    <div key={k} style={{ marginLeft: 16 }}>
                                      {k}. {v}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {q.type === 'multi' ? (
                                <div>正确答案：{formatMultiAnswer(q.correct_answer)}</div>
                              ) : (
                                <div>正确答案：{q.correct_answer}</div>
                              )}

                              {q.type === 'fill_blank' && (
                                <div style={{ color: '#52c41a', marginBottom: 4 }}>
                                  正确答案：
                                  {(() => {
                                    const raw = q.correct_answer || '';
                                    // 支持常见分隔符：中文/英文逗号、分号、竖线、顿号、空白
                                    const parts = raw
                                      .split(/[，,;；|、\s]+/g)
                                      .map(s => s.trim())
                                      .filter(Boolean);
                                    return parts.length > 1
                                      ? parts.map((ans, i) => `空${i + 1}: ${ans}`).join('  ')
                                      : parts[0] || '';
                                  })()}
                                </div>
                              )}

                              <div style={{ color: '#8c8c8c', marginBottom: 4, background: '#f6f6f6', padding: 6, borderRadius: 6 }}>
                                解析：{q.explanation ? q.explanation : '无解析'}
                              </div>

                              <div>
                                <Tag color="#49c7f7" style={{ borderRadius: 8, fontSize: 14, padding: '2px 10px' }}>
                                  知识点：{renderKnowledge(q.knowledge_points)}
                                </Tag>
                              </div>

                              {/* 新增：题目统计信息直接可视化 */}
                              {q.stats && (
                                <div
                                  style={{
                                    background: '#f6faff',
                                    border: '1px solid #e6f4ff',
                                    borderRadius: 8,
                                    padding: 12,
                                    marginTop: 12,
                                    marginBottom: 0
                                  }}
                                >
                                  <div style={{ marginBottom: 6 }}>
                                    <b>整体正确率：</b>
                                    <span style={{ marginLeft: 16 }}>参与答题人数：{q.stats.total_answers ?? '--'}</span>
                                    <span style={{ marginLeft: 16 }}>答对人数：{q.stats.correct_answers ?? '--'}</span>
                                    <span style={{ marginLeft: 16 }}>
                                      正确率：{q.stats.accuracy != null ? (q.stats.accuracy * 100).toFixed(1) + '%' : '--'}
                                    </span>
                                  </div>

                                  {/* 选择题/多选题展示选项分布 */}
                                  {(q.type === 'choice' || q.type === 'multi') && q.stats.option_stats && (
                                    <div style={{ marginTop: 12 }}>
                                      {(() => {
                                        const optionStats = q.stats.option_stats || {};
                                        const seriesData = Object.entries(optionStats).map(([opt, stat]) => ({
                                          value: stat?.count ?? 0,
                                          name: opt,
                                          students: Array.isArray(stat?.students) ? stat.students : []
                                        }));
                                        return (
                                          <ReactECharts
                                            option={{
                                              tooltip: {
                                                trigger: 'item',
                                                formatter: params => {
                                                  const { name, value, percent, data } = params || {};
                                                  const stu = (data?.students || []).join('<br/>');
                                                  return `
                                                    <b>选项 ${name ?? ''}</b><br/>
                                                    选择人数：${value ?? 0}<br/>
                                                    占比：${percent ?? 0}%<br/>
                                                    学生：<br/>${stu || '无'}
                                                  `;
                                                }
                                              },
                                              legend: {
                                                orient: 'vertical',
                                                left: 'right',
                                                top: 'center'
                                              },
                                              series: [
                                                {
                                                  name: '选项分布',
                                                  type: 'pie',
                                                  radius: '60%',
                                                  data: seriesData,
                                                  label: { formatter: '{b}: {d}%' }
                                                }
                                              ]
                                            }}
                                            style={{ height: 260, width: 400 }}
                                          />
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </Card>
                          </List.Item>
                        )}
                      />

                      <Title level={5} style={{ marginTop: 32, fontWeight: 600 }}>
                        学生作答情况
                      </Title>
                      <Table
                        dataSource={students}
                        rowKey={r => r.student_id}
                        pagination={false}
                        columns={[
                          {
                            title: '学生',
                            dataIndex: 'student_name',
                            key: 'student_name',
                            render: t => <span style={{ fontWeight: 500 }}>{t}</span>
                          },
                          {
                            title: '总分',
                            dataIndex: 'score',
                            key: 'score',
                            render: s => (
                              <Tag color="#52c41a" style={{ fontSize: 16, borderRadius: 8, padding: '2px 10px' }}>
                                {s}
                              </Tag>
                            )
                          },
                          {
                            title: '操作',
                            key: 'action',
                            render: (_, record) => (
                              <Button
                                size="small"
                                danger
                                onClick={async () => {
                                  if (!window.confirm('确认允许该学生重做本次考试？')) return;
                                  try {
                                    const updated = await allowStudentRetake(examId, record.student_id);
                                    message.success('操作成功，学生可重新参加考试');
                                    setStudents(updated);
                                  } catch (e) {
                                    message.error('操作失败');
                                  }
                                }}
                              >
                                重做考试
                              </Button>
                            )
                          }
                        ]}
                        expandable={{
                          expandedRowRender: record => {
                            // 创建题目ID到序号的映射
                            const questionIdToIndex = {};
                            if (exam && exam.questions) {
                              exam.questions.forEach((q, index) => {
                                questionIdToIndex[q.id] = index + 1;
                              });
                            }

                            return (
                              <List
                                size="small"
                                dataSource={record.answers}
                                renderItem={a => (
                                  <List.Item style={{ border: 'none', padding: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                                      <span style={{ color: '#1677ff' }}>第{questionIdToIndex[a.question_id] || a.question_id}题</span>
                                      <span>作答：{formatAnswer(a.student_answer)}</span>
                                      <span style={{ color: a.is_correct ? '#52c41a' : '#d4380d', fontWeight: 500 }}>
                                        {a.is_correct ? '正确' : '错误'}
                                      </span>
                                      <span>得分：{a.points_earned}</span>
                                    </div>
                                  </List.Item>
                                )}
                              />
                            );
                          }
                        }}
                        style={{ borderRadius: 12, overflow: 'hidden', marginTop: 12 }}
                      />
                    </>
                  )}
                </Card>
              </TabPane>

              <TabPane tab="学情分析" key="analysis">
                {renderAnalysisTab()}
              </TabPane>
            </Tabs>
    </AppLayout>
  );
}
