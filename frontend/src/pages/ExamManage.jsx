import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, List } from 'antd';
import { useNavigate } from 'react-router-dom';
import { listTeacherExams } from '../services/examTeacherService';

export default function ExamManage() {
  const [exams, setExams] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { listTeacherExams().then(r => setExams(r.exams || [])); }, []);

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>考试管理</h2>
      <List
        dataSource={exams}
        renderItem={(e) => (
          <List.Item actions={[<Button onClick={() => navigate(`/exam/${e.id}`)} key="view">查看详情</Button>]}> 
            <div>
              <div style={{ fontWeight: 600 }}>{e.title}</div>
              <div style={{ color: '#888' }}>{e.description}</div>
            </div>
          </List.Item>
        )}
      />
    </AppLayout>
  );
}


