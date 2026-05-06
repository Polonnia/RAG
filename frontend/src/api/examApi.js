import http from './http';

export const createExam = (payload) => http.post('/teacher/exam', payload).then(r => r.data);
export const listExams = () => http.get('/teacher/exams').then(r => r.data);
export const getExam = (examId) => http.get(`/teacher/exam/${examId}`).then(r => r.data);
export const getExamAnswers = (examId) => http.get(`/teacher/exam/${examId}/answers`).then(r => r.data);
export const getExamAnalysis = (examId) => http.get(`/teacher/exam/${examId}/analysis`).then(r => r.data);
export const resetStudentExam = (examId, studentId) => http.post(`/teacher/exam/${examId}/reset-student/${studentId}`).then(r => r.data);

export default {
  createExam,
  listExams,
  getExam,
  getExamAnswers,
  getExamAnalysis,
  resetStudentExam,
};


