import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import ExamDetail from './ExamDetail';
import QAPage from './pages/QAPage';
import TeachingSettings from './pages/TeachingSettings';
import ExamGenerator from './pages/ExamGenerator';
import ExamManage from './pages/ExamManage';
import Grading from './pages/Grading';
import StudentExams from './pages/StudentExams';
import StudentExamResult from './pages/StudentExamResult';
import StudentAnalysis from './pages/StudentAnalysis';
import StudentWrongbook from './pages/StudentWrongbook';
import StudentAssistant from './pages/StudentAssistant';
import StudentKnowledgeGraph from './pages/StudentKnowledgeGraph';
import KnowledgeManagement from './pages/KnowledgeManagement';
import Login from './pages/Login';
import RequireAuth from './auth/RequireAuth';

// 根据登录状态和角色选择首页
function HomeRoute() {
  return <Navigate to="/login" replace />;
}

export default function AppRoutes() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomeRoute />} />
        <Route path="/login" element={<Login />} />
        
        {/* 共享路由 */}
        <Route path="/qa" element={<RequireAuth roles={["teacher","admin","student"]}><QAPage /></RequireAuth>} />
        
        {/* 教师路由 */}
        <Route path="/knowledge" element={<RequireAuth roles={["teacher","admin"]}><KnowledgeManagement /></RequireAuth>} />
        <Route path="/teaching" element={<RequireAuth roles={["teacher","admin"]}><TeachingSettings /></RequireAuth>} />
        <Route path="/exam" element={<RequireAuth roles={["teacher","admin"]}><ExamGenerator /></RequireAuth>} />
        <Route path="/manage" element={<RequireAuth roles={["teacher","admin"]}><ExamManage /></RequireAuth>} />
        <Route path="/grading" element={<RequireAuth roles={["teacher","admin"]}><Grading /></RequireAuth>} />
        
        {/* 学生路由 */}
        <Route path="/student" element={<RequireAuth roles={["student"]}><StudentExams /></RequireAuth>} />
        <Route path="/exam-result/:id" element={<RequireAuth roles={["student"]}><StudentExamResult /></RequireAuth>} />
        <Route path="/analysis" element={<RequireAuth roles={["student"]}><StudentAnalysis /></RequireAuth>} />
        <Route path="/wrongbook" element={<RequireAuth roles={["student"]}><StudentWrongbook /></RequireAuth>} />
        <Route path="/assistant" element={<RequireAuth roles={["student"]}><StudentAssistant /></RequireAuth>} />
        <Route path="/knowledge-graph" element={<RequireAuth roles={["student"]}><StudentKnowledgeGraph /></RequireAuth>} />
        
        <Route path="/exam/:examId" element={<RequireAuth roles={["teacher","admin"]}><ExamDetail /></RequireAuth>} />
        <Route path="*" element={<HomeRoute />} />
      </Routes>
    </HashRouter>
  );
}
