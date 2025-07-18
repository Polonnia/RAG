import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Card, List, Tag, Button, Table, Typography, Space, Layout, Menu, Tooltip } from 'antd';
import { BookOutlined, DatabaseOutlined, FileTextOutlined, FormOutlined, CheckCircleOutlined, LogoutOutlined, InfoCircleOutlined } from '@ant-design/icons';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;
const { Sider, Content, Header, Footer } = Layout;

const typeMap = {
  choice: '单选题',
  multi: '多选题',
  fill_blank: '填空题',
  short_answer: '简答题',
  programming: '编程题'
};

const menuItems = [
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库管理', path: '/' },
  { key: 'qa', icon: <BookOutlined />, label: '知识库问答', path: '/' },
  { key: 'teaching', icon: <FileTextOutlined />, label: '教学内容设计', path: '/' },
  { key: 'exam', icon: <FormOutlined />, label: '考核内容生成', path: '/' },
  { key: 'manage', icon: <FormOutlined />, label: '考试管理', path: '/' },
  { key: 'grading', icon: <CheckCircleOutlined />, label: '待批改试卷', path: '/' }
];

// 工具函数：将数组答案转为规范字符串
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

export default function ExamDetail() {
  const { examId } = useParams();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const examRes = await axios.get(`http://localhost:8000/teacher/exam/${examId}`);
        setExam(examRes.data);
        const ansRes = await axios.get(`http://localhost:8000/teacher/exam/${examId}/answers`);
        setStudents(ansRes.data.students);
      } catch (err) {
        // 可加错误提示
      }
      setLoading(false);
    };
    fetchData();
  }, [examId]);

  // 侧边栏高亮逻辑
  const getSelectedKey = () => {
    if (location.pathname.startsWith('/exam/')) return 'manage';
    return 'knowledge';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#f4f6fa', boxShadow: '2px 0 8px #e6eaf1', borderRight: '1.5px solid #e6eaf1', paddingTop: 0 }}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: 22,
          color: '#1677ff',
          letterSpacing: 2,
          marginBottom: 16,
          background: 'linear-gradient(90deg, #1677ff 0%, #49c7f7 100%)',
          borderRadius: '0 0 18px 18px',
          boxShadow: '0 2px 8px #e6eaf1',
        }}>
          <BookOutlined style={{ fontSize: 28, marginRight: 8, color: '#fff' }} />
          <span style={{ color: '#fff' }}>教学AI助手</span>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          onClick={({ key }) => {
            const item = menuItems.find(i => i.key === key);
            if (item && item.path) navigate(item.path);
          }}
          style={{ height: '100%', borderRight: 0, fontSize: 18, background: '#f4f6fa', fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif', fontWeight: 500 }}
          items={menuItems.map(item => ({
            ...item,
            style: {
              borderRadius: 10,
              margin: '6px 8px',
              transition: 'background 0.2s',
            }
          }))}
          theme="light"
        />
      </Sider>
      <Layout>
        <div style={{ height: 64, background: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 32px' }}>
          <Space>
            <Button type="primary" icon={<LogoutOutlined />} onClick={() => navigate('/')} style={{ borderRadius: 20, fontWeight: 500 }}>退出登录</Button>
          </Space>
        </div>
        <Content style={{ padding: '48px 0', background: '#f4f6fa', minHeight: 800, fontFamily: 'Segoe UI, HarmonyOS, Arial, sans-serif' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: 32, background: '#fff', borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', minHeight: 600 }}>
            <Button onClick={() => navigate(-1)} style={{ marginBottom: 16, background: '#1677ff', color: '#fff', borderRadius: 18, fontWeight: 500, boxShadow: '0 2px 8px #e6eaf1', border: 'none' }}>返回</Button>
            <Card loading={loading} title={<span style={{ fontWeight: 700, fontSize: 20 }}>考试详情</span>} style={{ borderRadius: 16, boxShadow: '0 2px 12px #e6eaf1', marginBottom: 24 }} bodyStyle={{ borderRadius: 16 }}>
              {exam && (
                <>
                  <Title level={4} style={{ fontWeight: 700 }}>{exam.exam.title}</Title>
                  <Text type="secondary" style={{ fontSize: 16 }}>{exam.exam.description}</Text>
                  <div style={{ margin: '12px 0' }}>
                    <Tag style={{ borderRadius: 8, fontSize: 15, padding: '2px 12px', color: '#222', border: '1.5px solid #d9d9d9', background: '#fff', marginRight: 8 }}>时长: {exam.exam.duration} 分钟</Tag>
                    <Tag style={{ borderRadius: 8, fontSize: 15, padding: '2px 12px', color: '#222', border: '1.5px solid #d9d9d9', background: '#fff' }}>
                      创建时间: {exam.exam.created_at ? exam.exam.created_at.replace('T', ' ').slice(0, 16) : ''}
                    </Tag>
                  </div>
                  <Title level={5} style={{ fontWeight: 600 }}>题目列表</Title>
                  <List
                    dataSource={exam.questions}
                    renderItem={(q, idx) => (
                      <List.Item style={{ padding: 0, border: 'none' }}>
                        <Card
                          style={{ width: '100%', marginBottom: 16, background: '#fafcff', borderRadius: 14, boxShadow: '0 1px 6px #e6eaf1' }}
                          bodyStyle={{ padding: 16 }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                            <Tag style={{ fontSize: 16, marginRight: 8, borderRadius: 8, padding: '2px 10px', color: '#222', border: '1.5px solid #d9d9d9', background: '#fff' }}>[{q.points}分]</Tag>
                            <span style={{ fontWeight: 'bold', fontSize: 16, marginRight: 8 }}>第{idx + 1}题</span>
                            <Tag color="#1677ff" style={{ fontSize: 16, borderRadius: 8, padding: '2px 10px' }}>{typeMap[q.type] || q.type}</Tag>
                          </div>
                          <div style={{ fontSize: 16, marginBottom: 8 }}>{q.question}</div>
                          {q.options && Object.keys(q.options).length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              {Object.entries(q.options).map(([k, v]) => (
                                <div key={k} style={{ marginLeft: 16 }}>{k}. {v}</div>
                              ))}
                            </div>
                          )}
                          {q.type === 'multi' ? (
                            <>
                              <div>正确答案：{formatMultiAnswer(q.correct_answer)}</div>
                            </>
                          ) : (
                            <>
                              <div>正确答案：{q.correct_answer}</div>
                            </>
                          )}
                          {q.type === 'fill_blank' && (
                            <div style={{ color: '#52c41a', marginBottom: 4 }}>
                              正确答案：{(() => {
                                const answers = (q.correct_answer || '').split().map(ans => ans.trim()).filter(ans => ans);
                                return answers.length > 1 
                                  ? answers.map((ans, i) => `空${i + 1}: ${ans}`).join(' ')
                                  : answers[0] || '';
                              })()}
                            </div>
                          )}
                          <div style={{ color: '#8c8c8c', marginBottom: 4, background: '#f6f6f6', padding: 6, borderRadius: 6 }}>
                            解析：{q.explanation ? q.explanation : '无解析'}
                          </div>
                          <div>
                            <Tag color="#49c7f7" style={{ borderRadius: 8, fontSize: 14, padding: '2px 10px' }}>知识点：{q.knowledge_points}</Tag>
                          </div>
                          {/* 新增：题目统计信息直接展示 */}
                          {q.stats && (
                            <div style={{
                              background: '#f6faff',
                              border: '1px solid #e6f4ff',
                              borderRadius: 8,
                              padding: 12,
                              marginTop: 12,
                              marginBottom: 0
                            }}>
                              <div style={{ marginBottom: 6 }}>
                                <b>整体正确率：</b>
                                <span style={{ marginLeft: 16 }}>总作答人数：{q.stats.total_answers ?? '--'}</span>
                                <span style={{ marginLeft: 16 }}>答对人数：{q.stats.correct_answers ?? '--'}</span>
                                <span style={{ marginLeft: 16 }}>正确率：{q.stats.accuracy != null ? (q.stats.accuracy * 100).toFixed(1) + '%' : '--'}</span>
                              </div>
                              {/* 选择题/多选题用饼图展示选项分布 */}
                              {(q.type === 'choice' || q.type === 'multi') && q.stats.option_stats && (
                                <div style={{ marginTop: 12 }}>
                                  {(() => {
                                    const optionStats = q.stats.option_stats || {};
                                    return (
                                      <ReactECharts
                                        option={{
                                          tooltip: {
                                            trigger: 'item',
                                            formatter: params => {
                                              const { name, value, percent, data } = params;
                                              return `
                                                <b>选项 ${name}</b><br/>
                                                被选人数: ${value}<br/>
                                                占比: ${percent}%<br/>
                                                学生:<br/>${(data.students || []).join('<br/>') || '无'}
                                              `;
                                            }
                                          },
                                          legend: {
                                            orient: 'vertical',
                                            left: 'right',
                                            top: 'middle',
                                            width: 400,
                                            align: 'left', // 确保没有 align: 'right'
                                            itemWidth: 18,
                                            itemGap: 16,
                                            formatter: function(name) {
                                              const opt = optionStats[name];
                                              console.log('Legend:', name, opt);
                                              if (!opt) return name;
                                              const students = (opt.students || []).join('、');
                                              return students ? `${name}  |  ${students}` : name;
                                            }
                                          },
                                          series: [
                                            {
                                              name: '选项分布',
                                              type: 'pie',
                                              radius: '60%',
                                              data: Object.entries(optionStats).map(([opt, stat]) => ({
                                                value: stat.count,
                                                name: opt,
                                                students: stat.students || []
                                              })),
                                              label: { formatter: '{b}: {d}%'}
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
                  <Title level={5} style={{ marginTop: 32, fontWeight: 600 }}>学生作答情况</Title>
                  <Table
                    dataSource={students}
                    rowKey={r => r.student_id}
                    pagination={false}
                    columns={[
                      { title: '学生', dataIndex: 'student_name', key: 'student_name', render: t => <span style={{ fontWeight: 500 }}>{t}</span> },
                      { title: '总分', dataIndex: 'score', key: 'score', render: s => <Tag color="#52c41a" style={{ fontSize: 16, borderRadius: 8, padding: '2px 10px' }}>{s}</Tag> }
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
                              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                  <span style={{ color: '#1677ff' }}>第{questionIdToIndex[a.question_id] || a.question_id}题</span>
                                  <span>作答: {(() => {
                                    // 处理填空题多个空的答案显示
                                    if (a.type === 'fill_blank') {
                                      const answers = (a.student_answer || '').split().map(ans => ans.trim()).filter(ans => ans);
                                      return answers.length > 1 
                                        ? answers.map((ans, i) => `空${i + 1}: ${ans}`).join(' ')
                                        : answers[0] || '';
                                    }
                                    return a.student_answer;
                                  })()}</span>
                                <span style={{ color: a.is_correct ? '#52c41a' : '#d4380d', fontWeight: 500 }}>
                                  {a.is_correct ? '正确' : '错误'}
                                </span>
                                <span>得分: {a.points_earned}</span>
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
          </div>
        </Content>
        <Footer style={{ textAlign: 'center', background: '#f4f6fa', color: '#888', fontWeight: 500, letterSpacing: 1 }}>教学AI助手 ©2024</Footer>
      </Layout>
    </Layout>
  );
} 