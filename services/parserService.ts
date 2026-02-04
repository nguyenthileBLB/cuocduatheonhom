
import { Question } from "../types";

export const parseExamFile = (content: string): Question[] => {
  const lines = content.split('\n').map(line => line.trim()).filter(line => line !== '');
  const questions: Question[] = [];
  
  let currentQuestion: Partial<Question> | null = null;
  let currentOptions: string[] = [];
  
  // Regex patterns
  // Chấp nhận: "Câu 1:", "Câu 1.", "Câu 1"
  const questionStartRegex = /^Câu\s+\d+[:.]?\s*(.+)/i;
  // Chấp nhận: "A.", "A)", "A "
  const optionRegex = /^[A-D][.։)]\s*(.+)/i; 
  // Chấp nhận: "Đáp án:", "Đáp án", "Answer:"
  const answerRegex = /^(?:Đáp án|Answer|Dap an)[:.]?\s*([A-D])/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for Question Start
    const questionMatch = line.match(questionStartRegex);
    if (questionMatch) {
      // Save previous question if exists
      if (currentQuestion && currentOptions.length === 4) {
        questions.push({
          id: crypto.randomUUID(),
          text: currentQuestion.text!,
          options: currentOptions,
          correctAnswerIndex: currentQuestion.correctAnswerIndex || 0
        });
      }

      // Start new question
      currentQuestion = {
        text: questionMatch[1],
        correctAnswerIndex: 0 // Default
      };
      currentOptions = [];
      continue;
    }

    // Check for Options
    const optionMatch = line.match(optionRegex);
    if (optionMatch && currentQuestion) {
      currentOptions.push(optionMatch[1]);
      continue;
    }

    // Check for Answer
    const answerMatch = line.match(answerRegex);
    if (answerMatch && currentQuestion) {
      const char = answerMatch[1].toUpperCase();
      const map: {[key: string]: number} = {'A': 0, 'B': 1, 'C': 2, 'D': 3};
      currentQuestion.correctAnswerIndex = map[char];
      continue;
    }

    // If it's a continuation of the question text (multiline question)
    if (currentQuestion && currentOptions.length === 0 && !line.startsWith('Đáp án') && !line.startsWith('Answer') && !line.startsWith('Dap an')) {
      currentQuestion.text += ` <br/> ${line}`;
    }
  }

  // Push the last question
  if (currentQuestion && currentOptions.length === 4) {
    questions.push({
      id: crypto.randomUUID(),
      text: currentQuestion.text!,
      options: currentOptions,
      correctAnswerIndex: currentQuestion.correctAnswerIndex || 0
    });
  }

  return questions;
};

// Helper to render chemistry formulas, superscripts, subscripts, and images
export const formatContent = (text: string): string => {
  if (!text) return "";

  let formatted = text;

  // 1. Superscripts using ^ (e.g., 10^5, Fe^3+)
  // Syntax: ^{...} for multiple chars or ^x for single char
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup>$1</sup>');
  formatted = formatted.replace(/\^([a-zA-Z0-9+\-]+)/g, '<sup>$1</sup>');

  // 2. Explicit Subscripts using _ (e.g., H_2O, H_{2}SO_{4})
  // Syntax: _{...} for multiple chars or _x for single char
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');
  formatted = formatted.replace(/_([a-zA-Z0-9+\-]+)/g, '<sub>$1</sub>');

  // 3. Auto-format Chemical Formulas (Subscripts fallback):
  // Matches Element followed by number (e.g., O2, H2, Fe3) BUT ignores if explicit tags exist
  // Only apply this simple regex if no HTML tags were just added to avoid conflict
  // We use a safe lookbehindish approach or simply apply it carefully.
  // Converting H2O -> H<sub>2</sub>O
  formatted = formatted.replace(/([A-Z][a-z]?)(\d+)/g, '$1<sub>$2</sub>');

  // 4. Markdown Images: ![alt](url)
  // Example: ![Sơ đồ](https://example.com/image.png)
  formatted = formatted.replace(/!\[(.*?)\]\((.*?)\)/g, '<div class="my-3 flex justify-center"><img src="$2" alt="$1" class="max-h-64 rounded-lg border border-slate-200 shadow-sm" /></div>');

  // 5. Raw Image URLs (fallback)
  // If the text contains http ending in png/jpg/jpeg, wrap in img tag if not already inside "src"
  const urlRegex = /(?<!=["'])(https?:\/\/\S+\.(?:png|jpg|jpeg|gif|webp))/gi;
  formatted = formatted.replace(urlRegex, '<div class="my-3 flex justify-center"><img src="$1" class="max-h-64 rounded-lg border border-slate-200 shadow-sm" alt="Question Image" /></div>');

  // 6. Line breaks to <br> if not already HTML tags
  if (!formatted.includes('<br') && !formatted.includes('<div') && !formatted.includes('<p')) {
      formatted = formatted.replace(/\n/g, '<br/>');
  }

  return formatted;
};
