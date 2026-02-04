
export interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswerIndex: number;
  timeLimit?: number; // Thời gian làm bài tính bằng giây (tùy chọn)
}

export type ExamStatus = 'WAITING' | 'RUNNING' | 'COMPLETED';

export interface Exam {
  id: string;
  code: string;
  title: string;
  description: string;
  createdAt: number;
  questions: Question[];
  status: ExamStatus; // Trạng thái bài thi
}

export interface StudentResult {
  examId: string;
  studentName: string;
  team: string; // Thêm trường Đội
  score: number; // Điểm số cá nhân (đã quy đổi)
  rawScore: number; // Số câu đúng
  totalQuestions: number;
  submittedAt: number;
  answers: number[]; // Index of selected answers
}

export enum AppView {
  LANDING = 'LANDING',
  TEACHER_DASHBOARD = 'TEACHER_DASHBOARD',
  TEACHER_CREATE = 'TEACHER_CREATE',
  STUDENT_ENTER = 'STUDENT_ENTER',
  STUDENT_EXAM = 'STUDENT_EXAM',
  STUDENT_RESULT = 'STUDENT_RESULT'
}
