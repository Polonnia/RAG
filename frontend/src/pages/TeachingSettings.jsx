import React, { useEffect, useState } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { Button, Input, Space, message, Spin, List, Tag } from 'antd';
import { designTeachingPlan, saveTeachingPlanHistory, getTeachingPlanHistory, deleteTeachingPlanHistory, generateTeachingDetail, generatePPTFromOutline } from '../services/teachingService';
const { TextArea } = Input;

export default function TeachingSettings() {
  const [courseOutline, setCourseOutline] = useState('');
  const [teachingPlan, setTeachingPlan] = useState('');
  const [lessonSchedule, setLessonSchedule] = useState('');
  const [planLoading, setPlanLoading] = useState(false);
  const [pptLoading, setPptLoading] = useState(false);
  const [history, setHistory] = useState([]);

  async function fetchHistory() {
    try { setHistory(await getTeachingPlanHistory()); } catch {}
  }
  useEffect(() => { fetchHistory(); }, []);

  const handleDesign = async () => {
    if (!courseOutline.trim()) { message.warning('请输入课程大纲'); return; }
    setPlanLoading(true);
    try {
      const data = await designTeachingPlan(courseOutline);
      setTeachingPlan(data.plan || '');
      let schedule = (data.lesson_schedule || '').trim();
      if (schedule.startsWith('```')) {
        schedule = schedule.replace(/```[a-zA-Z]*\n?/g, '').replace(/```$/g, '').trim();
      }
      setLessonSchedule(schedule);
      await saveTeachingPlanHistory({ outline: courseOutline, plan: data.plan, lesson_schedule: schedule });
      fetchHistory();
      message.success('教学内容设计完成');
    } catch {
      message.error('设计失败');
    }
    setPlanLoading(false);
  };

  const handleGeneratePPT = async () => {
    if (!teachingPlan) { message.warning('请先生成教学内容'); return; }
    setPptLoading(true);
    try {
      const detail = await generateTeachingDetail(teachingPlan);
      await generatePPTFromOutline(detail.detail);
      message.success('PPT生成成功');
    } catch {
      message.error('PPT生成失败');
    }
    setPptLoading(false);
  };

  const handleDeleteHistory = async (id) => {
    try { await deleteTeachingPlanHistory(id); message.success('删除成功'); fetchHistory(); } catch { message.error('删除失败'); }
  };

  const handleHistoryClick = (h) => {
    setCourseOutline(h.outline);
    setTeachingPlan(h.plan);
    setLessonSchedule(h.lesson_schedule || '');
  };

  return (
    <AppLayout>
      <h2 style={{ fontWeight: 700, marginTop: 0 }}>教学内容设置</h2>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <TextArea rows={4} value={courseOutline} onChange={e => setCourseOutline(e.target.value)} placeholder="请输入课程大纲..." />
        <Button type="primary" onClick={handleDesign} loading={planLoading}>生成教学内容</Button>
        <Spin spinning={planLoading}>
          {teachingPlan && (
            <div style={{ background: '#fafafa', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap' }}>{teachingPlan}</div>
          )}
          {lessonSchedule && (
            <div style={{ background: '#f6ffed', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', marginTop: 8 }}>{lessonSchedule}</div>
          )}
        </Spin>
        <Button onClick={handleGeneratePPT} loading={pptLoading}>根据教学内容生成PPT</Button>
        <div>
          <h3>教学内容历史</h3>
          <List
            dataSource={history}
            renderItem={(h) => (
              <List.Item actions={[<a onClick={(e) => { e.stopPropagation(); handleDeleteHistory(h.id); }} key="del">删除</a>]}>
                <div onClick={() => handleHistoryClick(h)} style={{ cursor: 'pointer', flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{h.outline?.slice(0, 50)}...</div>
                  <div style={{ color: '#888' }}>
                    <Tag color="green">知识框架</Tag>
                    <span>{h.plan?.slice(0, 80)}...</span>
                  </div>
                </div>
              </List.Item>
            )}
          />
        </div>
      </Space>
    </AppLayout>
  );
}


