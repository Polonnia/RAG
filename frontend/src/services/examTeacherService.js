import http from '../api/http';

export async function generateExam({ courseOutline, questionConfig, difficulty }) {
  const formData = new FormData();
  formData.append('course_outline', courseOutline);
  formData.append('question_config', JSON.stringify(questionConfig));
  formData.append('difficulty', difficulty);
  const res = await http.post('/generate-exam', formData, { timeout: 180000 });
  return res.data;
}

export async function saveExamHistory(outline, examContent) {
  return http.post('/exam-history', new URLSearchParams({ outline, exam_content: JSON.stringify(examContent) })).then(r => r.data);
}

export async function getExamHistory() {
  return http.get('/exam-history').then(r => r.data);
}

export async function deleteExamHistory(id) {
  return http.delete(`/exam-history/${id}`).then(r => r.data);
}

export async function listTeacherExams() {
  return http.get('/teacher/exams').then(r => r.data);
}

export async function createExam({ title, description, duration, questions }) {
  const formData = new FormData();
  formData.append('title', title);
  formData.append('description', description);
  formData.append('duration', duration);
  formData.append('questions_data', JSON.stringify(questions));
  return http.post('/create-exam', formData).then(r => r.data);
}


