import React, { useState, useEffect, useRef } from 'react';
import { Card, List, Empty, Spin, Progress, Row, Col } from 'antd';
import { BarChartOutlined, FileTextOutlined, AlertOutlined, LineChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import http from '../api/http';
import AppLayout from '../components/layout/AppLayout';
import ReactECharts from 'echarts-for-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ChartCard from '../components/ChartCard';

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
      <div className="page-content-wrap page-enter">
        <PageHeader
          title="学情分析"
          subtitle="追踪考试走势并定位薄弱知识点"
          icon={<BarChartOutlined />}
          variant="dashboard"
        />
        <Card style={{ borderRadius: 18, boxShadow: '0 4px 24px #e6eaf1', marginBottom: 24 }}>
          {loading ? (
            <Spin style={{ display: 'block', textAlign: 'center', padding: '48px 0' }} />
          ) : (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 26 }}>
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="参加考试次数" value={accuracyData.length} icon={<FileTextOutlined />} color="#1677ff" />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="平均正确率"
                  value={accuracyData.length > 0 ? Math.round(accuracyData.reduce((sum, item) => sum + item.accuracy, 0) / accuracyData.length) : 0}
                  suffix="%"
                  icon={<LineChartOutlined />}
                  color="#52c41a"
                />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard title="薄弱知识点" value={weakKeywords.length} icon={<AlertOutlined />} color="#faad14" />
              </Col>
              <Col xs={24} sm={12} lg={6}>
                <StatCard
                  title="需加强考试"
                  value={accuracyData.length > 0 ? accuracyData.filter(item => item.accuracy < 60).length : 0}
                  icon={<BarChartOutlined />}
                  color="#f5222d"
                />
              </Col>
            </Row>

            <div style={{ 
              height: '4px', 
              background: 'linear-gradient(to right, #8fc0d2, #77d2d9, #70e2ce, #8aefb3, #bcf790, #f9f871)',
              marginBottom: '32px',
              borderRadius: '2px'
            }} />

            {accuracyData.length > 0 && (
              <div style={{ marginBottom: '32px' }}>
                <ChartCard title="历次考试正确率曲线" description="悬停曲线可联动下方知识点掌握明细" style={{ borderRadius: 12 }} height={300}>
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
                              // 后端返回的字段名是 earned/total（来自accuracy_curve中的keyword_accuracy）
                              const correct = (kw.earned !== undefined && kw.earned !== null) 
                                ? kw.earned 
                                : ((kw.correct !== undefined && kw.correct !== null) ? kw.correct : 0);
                              const total = (kw.total !== undefined && kw.total !== null) ? kw.total : 0;
                              html += `<div style="margin: 4px 0;">
                                • ${cleanedKeyword}：<span style="color: ${color}; font-weight: bold;">${kw.accuracy}%</span>（${correct}/${total}）
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
                </ChartCard>
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
