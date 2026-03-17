import React, { useState, useEffect } from 'react';
import { Card, List, Empty, Spin, Tag, Button, Input, Modal, Radio, Space, Progress, Result, Checkbox } from 'antd';
import { DeleteOutlined, BookOutlined } from '@ant-design/icons';
import http from '../api/http';
import AppLayout from '../components/layout/AppLayout';

const { TextArea } = Input;

export default function StudentAnalysis() {
  const [accuracyData, setAccuracyData] = useState([]);
  const [keywordAccuracy, setKeywordAccuracy] = useState([]);
  const [examKeywordAccuracy, setExamKeywordAccuracy] = useState({});
  const [loading, setLoading] = useState(false);

  const fetchStudentAnalysis = async () => {
    setLoading(true);
    try {
      const res = await http.get('/student/analysis');
      setAccuracyData(res.data.accuracy_curve || []);
      setKeywordAccuracy(res.data.keyword_accuracy || []);
    } catch (error) {
      console.error('获取学情分析失败:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudentAnalysis();
  }, []);

  const weakKeywords = keywordAccuracy.filter(item => item.accuracy < 80);

  return (
    <AppLayout>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Card title={<span style={{ fontWeight: 700, fontSize: 22 }}><BookOutlined style={{ color: '#1677ff', marginRight: 8 }} />学情分析</span>} 
              style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', marginBottom: 24 }}>
          {loading ? (
            <Spin style={{ display: 'block', textAlign: 'center', padding: '48px 0' }} />
          ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #91d5ff',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1677ff', marginBottom: '8px' }}>
                  {accuracyData.length}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>参加考试次数</div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #f6ffed 0%, #d9f7be 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #b7eb8f',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a', marginBottom: '8px' }}>
                  {accuracyData.length > 0 ? 
                    Math.round(accuracyData.reduce((sum, item) => sum + item.accuracy, 0) / accuracyData.length) : 
                    0}%
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>平均正确率</div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #fff7e6 0%, #ffd591 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #ffc53d',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14', marginBottom: '8px' }}>
                  {weakKeywords.length}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>薄弱知识点</div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, #fff1f0 0%, #ffccc7 100%)',
                padding: '20px',
                borderRadius: '12px',
                border: '1px solid #ffa39e',
                textAlign: 'center'
              }}>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d', marginBottom: '8px' }}>
                  {accuracyData.length > 0 ? 
                    accuracyData.filter(item => item.accuracy < 60).length : 
                    0}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>需加强考试</div>
              </div>
            </div>

            <div style={{ background: '#f5f5f5', padding: '20px', borderRadius: '12px' }}>
              <h4>知识点掌握情况：</h4>
              {keywordAccuracy.length === 0 ? (
                <Empty description="暂无数据" />
              ) : (
                <List
                  dataSource={keywordAccuracy}
                  renderItem={item => (
                    <List.Item style={{ padding: '12px 0', borderBottom: '1px solid #e8e8e8' }}>
                      <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: 600 }}>{item.keyword}</span>
                          <span style={{ color: item.accuracy < 60 ? '#f5222d' : item.accuracy < 80 ? '#faad14' : '#52c41a' }}>
                            {item.accuracy}%
                          </span>
                        </div>
                        <Progress percent={item.accuracy} strokeColor={{
                          '0%': '#f5222d',
                          '50%': '#faad14',
                          '100%': '#52c41a',
                        }} />
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </div>
          </>
        )}
      </Card>
    </div>
      </AppLayout>
    );
  }
