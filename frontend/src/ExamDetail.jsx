import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, List, Tag, Button, Table, Typography, Space } from 'antd';
import axios from 'axios';

const { Title, Text } = Typography;

const typeMap = {
  choice: '单选题',
  multi: '多选题',
  fill_blank: '填空题',
  short_answer: '简答题',
  programming: '编程题'
};

export default function ExamDetail() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Button onClick={() => navigate(-1)} style={{ marginBottom: 16 }}>返回</Button>
      <Card loading={loading} title="考试详情">
        {exam && (
          <>
            <Title level={4}>{exam.exam.title}</Title>
            <Text type="secondary">{exam.exam.description}</Text>
            <div style={{ margin: '12px 0' }}>
              <Tag color="blue">时长: {exam.exam.duration} 分钟</Tag>
              <Tag color="green">创建时间: {exam.exam.created_at}</Tag>
            </div>
            <Title level={5}>题目列表</Title>
            <List
              dataSource={exam.questions}
              renderItem={(q, idx) => (
                <List.Item style={{ padding: 0, border: 'none' }}>
                  <Card
                    style={{ width: '100%', marginBottom: 16, background: '#fafcff' }}
                    bodyStyle={{ padding: 16 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                      <Tag color="green" style={{ fontSize: 16, marginRight: 8 }}>[{q.points}分]</Tag>
                      <span style={{ fontWeight: 'bold', fontSize: 16, marginRight: 8 }}>第{idx + 1}题</span>
                      <Tag color="blue" style={{ fontSize: 16 }}>{typeMap[q.type] || q.type}</Tag>
                    </div>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>{q.question}</div>
                    {q.options && Object.keys(q.options).length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        {Object.entries(q.options).map(([k, v]) => (
                          <div key={k} style={{ marginLeft: 16 }}>{k}. {v}</div>
                        ))}
                      </div>
                    )}
                    {(q.type === 'choice' || q.type === 'multi') && (
                      <div style={{ color: '#52c41a', marginBottom: 4 }}>
                        正确答案：{q.correct_answer}
                      </div>
                    )}
                    <div style={{ color: '#8c8c8c', marginBottom: 4, background: '#f6f6f6', padding: 6, borderRadius: 4 }}>
                      解析：{q.explanation ? q.explanation : '无解析'}
                    </div>
                    <div>
                      <Tag color="geekblue">知识点：{q.knowledge_point}</Tag>
                    </div>
                  </Card>
                </List.Item>
              )}
            />
            <Title level={5} style={{ marginTop: 32 }}>学生作答情况</Title>
            <Table
              dataSource={students}
              rowKey={r => r.student_id}
              pagination={false}
              columns={[
                { title: '学生', dataIndex: 'student_name', key: 'student_name' },
                { title: '总分', dataIndex: 'score', key: 'score', render: s => <Tag color="green" style={{ fontSize: 16 }}>{s}</Tag> }
              ]}
              expandable={{
                expandedRowRender: record => (
                  <List
                    size="small"
                    dataSource={record.answers}
                    renderItem={a => (
                      <List.Item style={{ border: 'none', padding: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                          <span style={{ color: '#1677ff' }}>题号: {a.question_id}</span>
                          <span>作答: {a.student_answer}</span>
                          <span style={{ color: a.is_correct ? '#52c41a' : '#d4380d' }}>
                            {a.is_correct ? '正确' : '错误'}
                          </span>
                          <span>得分: {a.points_earned}</span>
                        </div>
                      </List.Item>
                    )}
                  />
                )
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
} 