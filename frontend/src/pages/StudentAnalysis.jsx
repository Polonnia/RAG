import React, { useState, useEffect, useRef } from 'react';
import { Card, List, Empty, Spin, Tag, Button, Input, Modal, Radio, Space, Progress, Result, Checkbox } from 'antd';
import { DeleteOutlined, BookOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import http from '../api/http';
import AppLayout from '../components/layout/AppLayout';
import ReactECharts from 'echarts-for-react';

const { TextArea } = Input;

export default function StudentAnalysis() {
  const navigate = useNavigate();
  const chartRef = useRef(null);
  const [accuracyData, setAccuracyData] = useState([]);
  const [keywordAccuracy, setKeywordAccuracy] = useState([]);
  const [examKeywordAccuracy, setExamKeywordAccuracy] = useState({});
  const [hoveredExamIndex, setHoveredExamIndex] = useState(null);
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

  const chartContainerRef = useRef(null);

  useEffect(() => {
    if (chartRef.current && accuracyData.length > 0) {
      const echartsInstance = chartRef.current.getEchartsInstance();
      
      // 监听showTip事件 - 当悬停到某个考试时更新索引
      echartsInstance.on('showTip', (params) => {
        if (params.dataIndex !== undefined) {
          setHoveredExamIndex(params.dataIndex);
        }
      });

      return () => {
        echartsInstance.off('showTip');
      };
    }
  }, [accuracyData]);

  const weakKeywords = hoveredExamIndex !== null && accuracyData[hoveredExamIndex]?.keyword_accuracy
    ? accuracyData[hoveredExamIndex].keyword_accuracy.filter(item => item.accuracy < 80)
    : [];

  const displayKeywords = hoveredExamIndex !== null && accuracyData[hoveredExamIndex]?.keyword_accuracy
    ? accuracyData[hoveredExamIndex].keyword_accuracy
    : [];

  const handleKeywordClick = (keyword) => {
    navigate('/wrongbook');
    // 延迟设置选中的知识点，确保页面转移完成
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('selectKeyword', { detail: keyword }));
    }, 100);
  };

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

            <div style={{ 
              height: '4px', 
              background: 'linear-gradient(to right, #8fc0d2, #77d2d9, #70e2ce, #8aefb3, #bcf790, #f9f871)',
              marginBottom: '32px',
              borderRadius: '2px'
            }} />

            {accuracyData.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>历次考试正确率曲线</h4>
                <Card style={{ borderRadius: 12 }}>
                  <ReactECharts 
                    ref={chartRef}
                    option={{
                      tooltip: {
                        trigger: 'axis',
                        formatter: (params) => {
                          if (!params || params.length === 0) return '';
                          const dataIndex = params[0].dataIndex;
                          const exam = accuracyData[dataIndex];
                          if (!exam) return '';
                          
                          let html = `<div style="padding: 8px;">`;
                          html += `<strong>${exam.exam_title}</strong><br/>`;
                          html += `日期: ${exam.date}<br/>`;
                          html += `总正确率: <strong style="color: #1677ff;">${exam.accuracy}%</strong><br/>`;
                          
                          if (exam.keyword_accuracy && exam.keyword_accuracy.length > 0) {
                            html += `<hr style="margin: 8px 0; border: none; border-top: 1px solid #ddd;"/>`;
                            html += `<strong>知识点正确率：</strong><br/>`;
                            exam.keyword_accuracy.forEach(kw => {
                              const color = kw.accuracy >= 80 ? '#52c41a' : kw.accuracy >= 60 ? '#faad14' : '#f5222d';
                              // 清理知识点名称中的特殊字符 ([], ", 等)
                              const cleanedKeyword = kw.keyword.replace(/[\[\]"']/g, '').trim();
                              html += `<div style="margin: 4px 0;">
                                • ${cleanedKeyword}：<span style="color: ${color}; font-weight: bold;">${kw.accuracy}%</span>（${kw.correct}/${kw.total}）
                              </div>`;
                            });
                          }
                          html += `</div>`;
                          return html;
                        }
                      },
                      xAxis: {
                        type: 'category',
                        data: accuracyData.map(item => item.exam_title),
                        boundaryGap: false
                      },
                      yAxis: {
                        type: 'value',
                        min: 0,
                        max: 100,
                        axisLabel: {
                          formatter: '{value}%'
                        }
                      },
                      series: [
                        {
                          name: '正确率',
                          type: 'line',
                          data: accuracyData.map(item => item.accuracy),
                          smooth: true,
                          itemStyle: {
                            color: '#82aaca'
                          },
                          areaStyle: {
                            color: 'rgba(130, 160, 202, 0.1)'
                          },
                          lineStyle: {
                            color: '#82aaca',
                            width: 3
                          }
                        }
                      ],
                      grid: {
                        left: '3%',
                        right: '3%',
                        bottom: '3%',
                        top: '3%',
                        containLabel: true
                      }
                    }}
                    style={{ height: '300px' }}
                  />
                </Card>
              </div>
            )}

            {hoveredExamIndex !== null && (
              <div style={{ background: '#eefcff', padding: '20px', borderRadius: '12px', marginTop: '32px' }}>
                <h4 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, textAlign: 'center' }}>
                  知识点掌握情况：
                  {hoveredExamIndex !== null && accuracyData[hoveredExamIndex] && (
                    <span style={{ marginLeft: '16px', fontSize: '12px', color: '#666', fontWeight: 'normal' }}>
                      ({accuracyData[hoveredExamIndex].exam_title}相关知识点)
                    </span>
                  )}
                </h4>
                {displayKeywords.length === 0 ? (
                  <Empty description="暂无数据" />
                ) : (
                  <List
                    dataSource={displayKeywords}
                    renderItem={item => {
                      const cleanedKeyword = item.keyword.replace(/[\[\]"']/g, '').trim();
                      return (
                        <List.Item 
                          style={{ 
                            padding: '12px 0', 
                            borderBottom: '1px solid #e8e8e8',
                            cursor: 'pointer',
                            transition: 'background-color 0.3s'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                          onClick={() => handleKeywordClick(cleanedKeyword)}
                        >
                          <div style={{ width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <span style={{ fontWeight: 600, color: '#1677ff' }}>
                                {cleanedKeyword}
                              </span>
                              <span style={{ color: item.accuracy < 60 ? '#f5222d' : item.accuracy < 80 ? '#faad14' : '#52c41a' }}>
                                {item.accuracy}%
                              </span>
                            </div>
                            <Progress percent={item.accuracy} strokeColor={{
                              '0%': '#8fc0d2',
                              '16.67%': '#77d2d9',
                              '33.33%': '#70e2ce',
                              '50%': '#8aefb3',
                              '66.67%': '#bcf790',
                              '100%': '#f9f871',
                            }} />
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
      </AppLayout>
    );
  }
