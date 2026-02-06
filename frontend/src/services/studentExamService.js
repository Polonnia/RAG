import http from '../api/http';

export const listStudentExams = () => http.get('/student/exams').then(r => r.data);
export const getStudentExam = (examId) => http.get(`/student/exam/${examId}`).then(r => r.data);
export const submitExam = (examId, answers) => {
  const formData = new FormData();
  formData.append('exam_id', examId);
  formData.append('answers_data', JSON.stringify(answers));
  return http.post('/student/submit-exam', formData).then(r => r.data);
};
export const getLatestAnalysis = (examId) => http.get(`/student/latest-analysis/${examId}`).then(r => r.data);
export const getExamResult = (examId) => http.get(`/student/exam-result/${examId}`).then(r => r.data);


