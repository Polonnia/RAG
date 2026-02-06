import * as examApi from '../api/examApi';

export async function fetchExamDetail(examId) {
  const exam = await examApi.getExam(examId);
  const answers = await examApi.getExamAnswers(examId);
  return { exam, students: answers?.students || [] };
}

export async function fetchExamAnalysis(examId) {
  return examApi.getExamAnalysis(examId);
}

export async function allowStudentRetake(examId, studentId) {
  await examApi.resetStudentExam(examId, studentId);
  const answers = await examApi.getExamAnswers(examId);
  return answers?.students || [];
}


