
import { Exam, StudentResult } from '../types';

const EXAMS_KEY = 'smartexam_exams';
const RESULTS_KEY = 'smartexam_results';
const LIVE_SCORES_KEY = 'smartexam_live_scores';
const TEAMS_KEY = 'smartexam_teams';

export const saveExam = (exam: Exam): void => {
  const exams = getExams();
  const existingIndex = exams.findIndex(e => e.id === exam.id);
  
  if (existingIndex >= 0) {
    // Update existing exam
    exams[existingIndex] = exam;
  } else {
    // Add new exam
    exams.push(exam);
  }
  
  localStorage.setItem(EXAMS_KEY, JSON.stringify(exams));
};

export const getExams = (): Exam[] => {
  const data = localStorage.getItem(EXAMS_KEY);
  return data ? JSON.parse(data) : [];
};

export const getExamByCode = (code: string): Exam | undefined => {
  const exams = getExams();
  return exams.find((e) => e.code === code);
};

export const deleteExam = (id: string): void => {
  // 1. Delete Exam
  const exams = getExams();
  const newExams = exams.filter(e => e.id !== id);
  localStorage.setItem(EXAMS_KEY, JSON.stringify(newExams));

  // 2. Delete associated Results (Cascade delete)
  const results = getResults();
  const newResults = results.filter(r => r.examId !== id);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(newResults));
};

export const saveResult = (result: StudentResult): void => {
  const results = getResults();
  results.push(result);
  localStorage.setItem(RESULTS_KEY, JSON.stringify(results));
};

export const getResults = (): StudentResult[] => {
  const data = localStorage.getItem(RESULTS_KEY);
  return data ? JSON.parse(data) : [];
};

// --- Live Score Persistence ---
export const saveLiveScores = (scores: Record<string, number>): void => {
  localStorage.setItem(LIVE_SCORES_KEY, JSON.stringify(scores));
};

export const getLiveScores = (): Record<string, number> => {
  const data = localStorage.getItem(LIVE_SCORES_KEY);
  return data ? JSON.parse(data) : {};
};

export const clearLiveScores = (): void => {
  localStorage.removeItem(LIVE_SCORES_KEY);
};

// --- Team Names Persistence ---
export const saveTeams = (teams: string[]): void => {
  localStorage.setItem(TEAMS_KEY, JSON.stringify(teams));
};

export const getTeams = (): string[] => {
  const data = localStorage.getItem(TEAMS_KEY);
  return data ? JSON.parse(data) : ['Đội Đỏ', 'Đội Xanh'];
};
