
import React, { useState, useEffect, useRef } from 'react';
import { Layout } from './components/Layout';
import { Button } from './components/Button';
import { parseExamFile, formatContent } from './services/parserService';
import { saveExam, getExams, getExamByCode, saveResult, getResults, deleteExam, saveLiveScores, getLiveScores, clearLiveScores, getTeams, saveTeams } from './services/storageService';
import { Exam, Question, AppView, StudentResult, ExamStatus } from './types';
import { Peer } from 'peerjs';
import { 
  BookOpen, 
  GraduationCap, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  XCircle, 
  ArrowRight,
  Clock,
  Save,
  PenTool,
  Upload,
  Edit2,
  Users,
  Timer,
  Power,
  Zap,
  Trophy,
  BarChart3,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FileBarChart,
  X,
  Wifi,
  WifiOff,
  UserCheck,
  Signal,
  MoreVertical,
  Shuffle,
  FileText,
  Lock,
  Music,
  Volume2,
  VolumeX,
  UploadCloud,
  FileUp,
  HelpCircle,
  FlaskConical,
  Image as ImageIcon,
  Settings
} from 'lucide-react';

const FIXED_EXAM_CODE = 'FIXED01'; // Mã cố định cho đề thi mặc định
const APP_PREFIX = 'smartexam-2024-'; // Prefix to avoid PeerJS collisions

// Helper: Fisher-Yates Shuffle
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LANDING);
  
  // Teacher State
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentExamId, setCurrentExamId] = useState<string | null>(null);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [results, setResults] = useState<StudentResult[]>([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportExam, setReportExam] = useState<Exam | null>(null);
  const [teams, setTeamsState] = useState<string[]>(['Đội Đỏ', 'Đội Xanh']);
  
  // Team Settings State
  const [showTeamSettings, setShowTeamSettings] = useState(false);
  const [editingTeam1, setEditingTeam1] = useState('');
  const [editingTeam2, setEditingTeam2] = useState('');
  
  // LIVE SCORING STATE
  const [liveScores, setLiveScoresState] = useState<Record<string, number>>({});

  // Wrapper to save to storage
  const setLiveScores = (action: React.SetStateAction<Record<string, number>>) => {
      setLiveScoresState(prev => {
          const newState = typeof action === 'function' ? action(prev) : action;
          saveLiveScores(newState);
          return newState;
      });
  };

  // Music State
  const [musicFile, setMusicFile] = useState<string | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Teacher Online State (PeerJS)
  const [peerId, setPeerId] = useState<string | null>(null);
  const [teacherPeer, setTeacherPeer] = useState<Peer | null>(null);
  const [connectedStudents, setConnectedStudents] = useState<number>(0);
  const [teamLiveCounts, setTeamLiveCounts] = useState<Record<string, number>>({});
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'error'>('offline');
  const studentConnectionsRef = useRef<any[]>([]);

  // Teacher Question Editor
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQText, setCurrentQText] = useState('');
  const [currentQOptions, setCurrentQOptions] = useState<string[]>(['', '', '', '']);
  const [currentQCorrectIdx, setCurrentQCorrectIdx] = useState<number>(0);
  const [currentQTime, setCurrentQTime] = useState<number>(30);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);
  const examUploadRef = useRef<HTMLInputElement>(null);

  // Student State
  const [studentName, setStudentName] = useState('');
  const [studentTeam, setStudentTeam] = useState('');
  const [examCode, setExamCode] = useState(''); // This is now the "Room Code"
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  
  // New State for Shuffled Questions
  const [shuffledQuestions, setShuffledQuestions] = useState<Question[]>([]); 
  
  const [studentAnswers, setStudentAnswers] = useState<number[]>([]);
  const [examResult, setExamResult] = useState<StudentResult | null>(null);
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'DISCONNECTED' | 'CONNECTING' | 'CONNECTED'>('DISCONNECTED');
  const studentPeerRef = useRef<Peer | null>(null);

  // Timer State
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);

  // --- Initialization & Polling ---

  useEffect(() => {
    // Load initial data
    refreshData();
    ensureFixedExamExists();
    
    // Load live scores
    const savedScores = getLiveScores();
    setLiveScoresState(savedScores);

    // Load Teams
    const savedTeams = getTeams();
    setTeamsState(savedTeams);
    setStudentTeam(savedTeams[0]); // Default student team
  }, []);

  // Initialize Teacher Peer when entering Dashboard
  useEffect(() => {
    if (currentView === AppView.TEACHER_DASHBOARD) {
      if (!teacherPeer) {
        const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
        const fullId = `${APP_PREFIX}${randomCode}`;
        
        // Create Peer with config for better reliability
        const peer = new Peer(fullId, {
           debug: 1
        });
        
        peer.on('open', (id) => {
          console.log('Teacher Peer ID:', id);
          setPeerId(randomCode);
          setNetworkStatus('online');
        });

        peer.on('disconnected', () => {
           console.log('Peer disconnected from server, reconnecting...');
           setNetworkStatus('offline');
           peer.reconnect();
        });

        peer.on('error', (err) => {
           console.error('Teacher Peer Error:', err);
           setNetworkStatus('error');
        });

        peer.on('connection', (conn) => {
          // Track connections
          studentConnectionsRef.current.push(conn);
          setConnectedStudents(prev => prev + 1);

          // Get metadata (Team info)
          const meta = conn.metadata as { name?: string, team?: string } | undefined;
          if (meta?.team) {
             setTeamLiveCounts(prev => ({
                ...prev,
                [meta.team!]: (prev[meta.team!] || 0) + 1
             }));
          }

          conn.on('open', () => {
             // Find the currently RUNNING exam to sync immediately
             const runningExam = getExams().find(e => e.status === 'RUNNING');
             if (runningExam) {
                 conn.send({ type: 'SYNC_EXAM', exam: runningExam });
             } else {
                 // Or send the first waiting one if nothing is running, but don't force it active
                 const defaultExam = getExams()[0];
                 if (defaultExam) conn.send({ type: 'SYNC_EXAM', exam: defaultExam });
             }
          });

          conn.on('data', (data: any) => {
             // HANDLE FINAL SUBMISSION
             if (data.type === 'SUBMIT_RESULT') {
               const result = data.payload;
               saveResult(result);
               setResults(getResults());
             }

             // HANDLE LIVE SCORE UPDATES (REAL-TIME)
             if (data.type === 'LIVE_SCORE_UPDATE') {
                const { team, points } = data;
                setLiveScores(prev => ({
                    ...prev,
                    [team]: (prev[team] || 0) + points
                }));
             }
          });

          conn.on('close', () => {
             setConnectedStudents(prev => Math.max(0, prev - 1));
             studentConnectionsRef.current = studentConnectionsRef.current.filter(c => c !== conn);
             
             // Decrease team count
             if (meta?.team) {
                setTeamLiveCounts(prev => ({
                   ...prev,
                   [meta.team!]: Math.max(0, (prev[meta.team!] || 1) - 1)
                }));
             }
          });
        });

        setTeacherPeer(peer);
      }
    } else {
      // Cleanup teacher peer if leaving dashboard (optional, but good for reset)
      // For now we keep it alive to avoid disconnects if navigating sub-menus, 
      // but in this simple app, we can destroy if going back to landing.
      if (currentView === AppView.LANDING && teacherPeer) {
         teacherPeer.destroy();
         setTeacherPeer(null);
         setPeerId(null);
         setConnectedStudents(0);
         setTeamLiveCounts({});
         // Do NOT clear live scores here to allow resuming
         setNetworkStatus('offline');
         studentConnectionsRef.current = [];
      }
    }
  }, [currentView]);

  const refreshData = () => {
    const loadedExams = getExams();
    setExams(loadedExams);
    setResults(getResults());
  };

  const ensureFixedExamExists = () => {
    const loadedExams = getExams();
    if (loadedExams.length === 0) {
      const fixedQuestions: Question[] = [
        {
          id: crypto.randomUUID(),
          text: "Thủ đô của Việt Nam là gì?",
          options: ["Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Cần Thơ"],
          correctAnswerIndex: 0,
          timeLimit: 15
        },
        {
          id: crypto.randomUUID(),
          text: "Công thức hóa học của nước là?",
          options: ["HO", "H2O", "H2O2", "OH"],
          correctAnswerIndex: 1,
          timeLimit: 15
        },
        {
          id: crypto.randomUUID(),
          text: "Ai là người đầu tiên đặt chân lên mặt trăng?",
          options: ["Yuri Gagarin", "Buzz Aldrin", "Neil Armstrong", "Michael Collins"],
          correctAnswerIndex: 2,
          timeLimit: 20
        }
      ];

      const fixedExam: Exam = {
        id: "fixed-exam-default",
        code: FIXED_EXAM_CODE,
        title: "Đề thi mẫu (Mặc định)",
        description: "Cuộc thi giữa các đội",
        createdAt: Date.now(),
        questions: fixedQuestions,
        status: 'WAITING'
      };
      saveExam(fixedExam);
      setExams(getExams());
    }
  };

  // --- Timer Logic ---
  useEffect(() => {
    if (currentView === AppView.STUDENT_EXAM && currentExam && currentExam.status === 'RUNNING' && timeLeft > 0) {
      const timerId = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerId);
            handleNextQuestion(); // Auto move next when time up
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerId);
    }
  }, [currentView, currentExam, timeLeft, currentQuestionIndex]);

  // --- Audio Cleanup ---
  useEffect(() => {
      // Cleanup object URL when component unmounts
      return () => {
          if (musicFile) {
              URL.revokeObjectURL(musicFile);
          }
      };
  }, []);

  // --- Logic Handlers ---

  const handleMusicUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        // Revoke old url if exists
        if (musicFile) URL.revokeObjectURL(musicFile);
        
        const url = URL.createObjectURL(file);
        setMusicFile(url);
        
        // Reset state
        setIsMusicPlaying(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }
  };

  const handleExamFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          const parsedQuestions = parseExamFile(content);
          if (parsedQuestions.length === 0) {
             alert("Không tìm thấy câu hỏi nào trong file. Vui lòng kiểm tra lại định dạng.");
          } else {
             setQuestions(prev => [...prev, ...parsedQuestions]);
             alert(`Đã nhập thành công ${parsedQuestions.length} câu hỏi!`);
          }
        } catch (error) {
          console.error(error);
          alert("Có lỗi khi đọc file. Vui lòng đảm bảo file là dạng Text (.txt).");
        }
      };
      reader.readAsText(file);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
            e.preventDefault();
            const file = items[i].getAsFile();
            if (!file) continue;

            const reader = new FileReader();
            reader.onload = (event) => {
                const base64 = event.target?.result as string;
                if (base64) {
                     const markdownImage = `\n![Ảnh dán](${base64})\n`;
                     
                     // Insert at cursor position
                     const textarea = e.currentTarget;
                     const start = textarea.selectionStart;
                     const end = textarea.selectionEnd;
                     const text = currentQText;
                     const newText = text.substring(0, start) + markdownImage + text.substring(end);
                     
                     setCurrentQText(newText);
                }
            };
            reader.readAsDataURL(file);
            break; // Only paste one image at a time
        }
    }
  };

  const toggleMusic = () => {
      if (!audioRef.current || !musicFile) return;

      if (isMusicPlaying) {
          audioRef.current.pause();
      } else {
          audioRef.current.play().catch(e => console.error("Audio playback failed:", e));
      }
      setIsMusicPlaying(!isMusicPlaying);
  };

  const broadcastExamUpdate = (exam: Exam) => {
     // Broadcast to students
     studentConnectionsRef.current.forEach(conn => {
        if (conn.open) {
           conn.send({ type: 'SYNC_EXAM', exam: exam });
        }
     });
  };

  const handleActivateExam = (targetExam: Exam) => {
    setLiveScores({}); // Reset scores when starting new exam
    clearLiveScores(); // Clear storage
    
    // 1. Stop all other exams
    const updatedExams = exams.map(e => {
        if (e.id === targetExam.id) {
            return { ...e, status: 'RUNNING' as ExamStatus };
        } else {
            return { ...e, status: 'WAITING' as ExamStatus };
        }
    });

    // 2. Save all to storage
    updatedExams.forEach(e => saveExam(e));
    setExams(updatedExams);

    // 3. Broadcast the RUNNING exam
    const runningExam = updatedExams.find(e => e.id === targetExam.id);
    if (runningExam) {
        broadcastExamUpdate(runningExam);
    }
  };

  const handleStopExam = (targetExam: Exam) => {
      const updatedExam = { ...targetExam, status: 'COMPLETED' as ExamStatus };
      saveExam(updatedExam);
      refreshData();
      broadcastExamUpdate(updatedExam);
  };

  const handleResetExam = (targetExam: Exam) => {
      const updatedExam = { ...targetExam, status: 'WAITING' as ExamStatus };
      saveExam(updatedExam);
      refreshData();
      setLiveScores({}); // Reset live scores
      clearLiveScores();
      broadcastExamUpdate(updatedExam);
  };

  const handleDeleteExam = (id: string) => {
      if (confirm('Bạn có chắc chắn muốn xóa đề thi này không?')) {
          deleteExam(id);
          refreshData();
      }
  }

  const handleCreateNewExam = () => {
      const newId = crypto.randomUUID();
      setCurrentExamId(newId);
      setNewExamTitle('Đề thi mới');
      setQuestions([]);
      setCurrentView(AppView.TEACHER_CREATE);
  };

  const handleEditExam = (exam: Exam) => {
      setCurrentExamId(exam.id);
      setNewExamTitle(exam.title);
      setQuestions(exam.questions);
      setCurrentView(AppView.TEACHER_CREATE);
  };

  // Team Settings Handlers
  const handleOpenTeamSettings = () => {
    setEditingTeam1(teams[0]);
    setEditingTeam2(teams[1]);
    setShowTeamSettings(true);
  };

  const handleSaveTeamSettings = () => {
    if (!editingTeam1.trim() || !editingTeam2.trim()) {
      alert("Tên đội không được để trống");
      return;
    }
    const newTeams = [editingTeam1.trim(), editingTeam2.trim()];
    setTeamsState(newTeams);
    saveTeams(newTeams);
    setShowTeamSettings(false);
  };

  const calculateTeamScores = () => {
    // USE LIVE SCORES for real-time leaderboard
    const scores: Record<string, number> = { ...liveScores };
    
    // Ensure all teams appear even if 0 score
    teams.forEach(team => {
        if (!scores[team]) scores[team] = 0;
    });

    return Object.entries(scores).sort(([,a], [,b]) => b - a);
  };

  const handleViewReport = (exam: Exam) => {
    setReportExam(exam);
    setShowReportModal(true);
  };

  // Student Actions
  const handleStudentJoin = () => {
    // Trim extra spaces from code
    const cleanCode = examCode.trim();

    if (!studentName || !cleanCode) {
      alert("Vui lòng nhập tên và mã phòng");
      return;
    }

    // Update state to clean code visually
    setExamCode(cleanCode);
    
    // Cleanup existing peer if any to avoid conflicts
    if (studentPeerRef.current) {
        studentPeerRef.current.destroy();
        studentPeerRef.current = null;
    }

    setConnectionStatus('CONNECTING');
    setIsOnlineMode(true);

    const peer = new Peer();
    studentPeerRef.current = peer;

    // Handle peer errors (especially 'peer-unavailable')
    peer.on('error', (err: any) => {
       console.error("Peer Error", err);
       setConnectionStatus('DISCONNECTED');
       
       if (err.type === 'peer-unavailable') {
           alert(`Không tìm thấy phòng thi với mã "${cleanCode}".\n1. Kiểm tra lại mã trên màn hình của giáo viên.\n2. Đảm bảo giáo viên đang mở trang quản lý.`);
       } else if (err.type === 'network') {
           alert("Lỗi kết nối mạng. Vui lòng kiểm tra đường truyền 4G/Wifi.");
       } else {
           alert("Có lỗi xảy ra khi kết nối. Vui lòng thử lại.");
       }
    });

    peer.on('open', () => {
       // Pass metadata on connect!
       const conn = peer.connect(`${APP_PREFIX}${cleanCode}`, {
          metadata: { name: studentName, team: studentTeam },
          reliable: true // CRITICAL: Improves stability on mobile networks
       });
       
       conn.on('open', () => {
          setConnectionStatus('CONNECTED');
          // Wait for data
       });

       conn.on('data', (data: any) => {
          if (data.type === 'SYNC_EXAM') {
             const receivedExam = data.exam as Exam;
             
             setCurrentExam(prev => {
                const isNewExam = !prev || prev.id !== receivedExam.id;

                // Only SHUFFLE if it's a completely new exam loading in
                if (isNewExam) {
                    const shuffled = shuffleArray(receivedExam.questions);
                    setShuffledQuestions(shuffled);
                    setStudentAnswers(new Array(shuffled.length).fill(-1));
                    setCurrentQuestionIndex(0);
                    // Initialize timer based on first shuffled question
                    setTimeLeft(shuffled[0]?.timeLimit || 30);
                }

                // If status changed from WAITING to RUNNING, and we already have shuffled questions
                if (prev && prev.status === 'WAITING' && receivedExam.status === 'RUNNING') {
                   // Ensure timer starts correctly for the student's first question
                   setTimeLeft((prevQuestions) => { 
                       // We can't access state here reliably in setter, rely on effect or re-set
                       return prevQuestions?.[0]?.timeLimit || 30; // Fallback
                   });
                   // Actually, we should trigger this via a separate effect or just here if we had access
                }
                
                return receivedExam;
             });

             // If first load (view transition handled here)
             setCurrentView((prevView) => {
                 if (prevView !== AppView.STUDENT_EXAM) {
                     return AppView.STUDENT_EXAM;
                 }
                 return prevView;
             });
          }
       });

       conn.on('close', () => {
          alert("Mất kết nối với giáo viên.");
          setConnectionStatus('DISCONNECTED');
       });

       conn.on('error', (err) => {
          console.error(err);
          // Only show alert if connection status was connected or connecting
          // PeerJS sometimes throws internal errors we can ignore
          alert("Lỗi kết nối dữ liệu. Vui lòng thử lại.");
       });
    });
  };

  // Fix timer initialization when exam starts running
  useEffect(() => {
     if (currentExam?.status === 'RUNNING' && shuffledQuestions.length > 0 && timeLeft === 0 && currentQuestionIndex === 0) {
          setTimeLeft(shuffledQuestions[0].timeLimit || 30);
     }
  }, [currentExam?.status, shuffledQuestions]);

  const sendLiveScoreUpdate = (isCorrect: boolean) => {
      // If correct, send +10 points immediately
      if (isCorrect && isOnlineMode && studentPeerRef.current) {
         const cleanCode = examCode.trim();
         const conns = studentPeerRef.current.connections[`${APP_PREFIX}${cleanCode}`];
         if (conns && conns[0]) {
             conns[0].send({ 
                 type: 'LIVE_SCORE_UPDATE', 
                 team: studentTeam, 
                 points: 10 
             });
         }
      }
  };

  const handleNextQuestion = () => {
    if (!currentExam) return;
    
    // 1. CHECK CURRENT ANSWER BEFORE MOVING
    const currentQ = shuffledQuestions[currentQuestionIndex];
    const answerIdx = studentAnswers[currentQuestionIndex];
    
    // Check correctness of current question
    if (currentQ && answerIdx === currentQ.correctAnswerIndex) {
        sendLiveScoreUpdate(true);
    }
    
    // 2. MOVE TO NEXT OR SUBMIT
    if (currentQuestionIndex < shuffledQuestions.length - 1) {
      const nextIdx = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIdx);
      setTimeLeft(shuffledQuestions[nextIdx].timeLimit || 30);
    } else {
      handleSubmitExam();
    }
  };

  const handleSubmitExam = () => {
     if (!currentExam) return;

     // Note: If calling from handleNextQuestion, the last question's live score
     // has already been sent in the block above (conceptually).
     // BUT, if handleSubmitExam is called directly (e.g., timeout on last question),
     // we might need to check the last answer.
     // However, to keep it simple and avoid double counting, we assume handleNextQuestion handles the trigger
     // UNLESS it's the very last step.
     
     // Let's re-verify the last question logic inside handleNextQuestion:
     // "if (currentQuestionIndex < length - 1) { move } else { handleSubmit }"
     // So the score update logic runs BEFORE handleSubmitExam is called in the normal flow.

     // CALCULATE FINAL STUDENT SCORE
     let correctCount = 0;
     const answerMap = new Map<string, number>();

     shuffledQuestions.forEach((q, idx) => {
       const answerIdx = studentAnswers[idx];
       answerMap.set(q.id, answerIdx); 

       if (answerIdx === q.correctAnswerIndex) {
         correctCount++;
       }
     });

     // Score on 10-point scale for PERSONAL result
     const totalQ = currentExam.questions.length;
     const finalScore = totalQ > 0 ? +((correctCount / totalQ) * 10).toFixed(1) : 0;

     // PREPARE DATA FOR TEACHER (Master Order)
     const normalizedAnswers = currentExam.questions.map(q => {
         return answerMap.has(q.id) ? answerMap.get(q.id)! : -1;
     });

     const result: StudentResult = {
       examId: currentExam.id,
       studentName,
       team: studentTeam,
       score: finalScore,
       rawScore: correctCount,
       totalQuestions: currentExam.questions.length,
       submittedAt: Date.now(),
       answers: normalizedAnswers
     };

     // Send Final Report
     if (isOnlineMode && studentPeerRef.current) {
        const cleanCode = examCode.trim();
        const conns = studentPeerRef.current.connections[`${APP_PREFIX}${cleanCode}`];
        if (conns && conns[0]) {
           conns[0].send({ type: 'SUBMIT_RESULT', payload: result });
        }
     } else {
        saveResult(result);
     }
     
     setExamResult(result);
  };

  const renderExamReport = () => {
    if (!reportExam) return null;

    const examResults = results.filter(r => r.examId === reportExam.id);
    const sortedResults = [...examResults].sort((a, b) => b.score - a.score);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
        <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
          <div className="sticky top-0 bg-white p-4 border-b flex justify-between items-center z-10 rounded-t-2xl">
            <h2 className="text-xl font-bold flex items-center gap-2">
               <FileBarChart className="w-5 h-5 text-blue-600" /> 
               Kết Quả: {reportExam.title}
            </h2>
            <button onClick={() => setShowReportModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
               <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>

          <div className="p-6">
             {sortedResults.length === 0 ? (
                 <div className="text-center text-slate-500 py-10">
                     Chưa có kết quả nào được ghi nhận.
                 </div>
             ) : (
                 <div className="space-y-4">
                     <div className="grid grid-cols-12 gap-2 text-sm font-bold text-slate-500 border-b pb-2">
                        <div className="col-span-1">#</div>
                        <div className="col-span-5">Học Sinh</div>
                        <div className="col-span-3">Đội</div>
                        <div className="col-span-3 text-right">Điểm</div>
                     </div>
                     {sortedResults.map((res, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 hover:bg-slate-50 rounded-lg">
                           <div className="col-span-1 font-mono text-slate-400">
                              {idx + 1}
                           </div>
                           <div className="col-span-5 font-medium text-slate-900 truncate">
                              {res.studentName}
                           </div>
                           <div className="col-span-3 text-sm text-slate-600">
                              {res.team}
                           </div>
                           <div className="col-span-3 text-right font-bold text-indigo-600">
                              {res.score}
                           </div>
                        </div>
                     ))}
                 </div>
             )}
          </div>
          
          <div className="p-4 border-t bg-slate-50 flex justify-end rounded-b-2xl">
             <Button variant="secondary" onClick={() => setShowReportModal(false)} className="w-auto px-6 py-2">
                Đóng
             </Button>
          </div>
        </div>
      </div>
    );
  };

  // --- Render Views ---

  // 1. Landing
  if (currentView === AppView.LANDING) {
    return (
      <Layout>
        <div className="text-center space-y-8 mt-10">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl p-6 w-24 h-24 flex items-center justify-center mx-auto shadow-xl shadow-blue-500/40">
            <Trophy className="text-white w-12 h-12" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">ĐẤU TRƯỜNG</h1>
            <p className="text-slate-500 font-medium">Tranh tài kiến thức giữa các đội</p>
          </div>
          
          <div className="space-y-4 pt-4 px-4">
            <div 
              onClick={() => setCurrentView(AppView.TEACHER_DASHBOARD)}
              className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-100 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all flex items-center gap-4"
            >
              <div className="bg-blue-100 p-3 rounded-full group-hover:bg-blue-600 transition-colors">
                <PenTool className="text-blue-600 group-hover:text-white transition-colors" />
              </div>
              <div className="text-left flex-1">
                <h3 className="font-bold text-slate-800">Giáo Viên</h3>
                <p className="text-sm text-slate-500">Tạo phòng và điều khiển</p>
              </div>
              <ArrowRight className="text-slate-300 group-hover:text-blue-500" />
            </div>

            <div 
              onClick={() => setCurrentView(AppView.STUDENT_ENTER)}
              className="group bg-gradient-to-r from-indigo-500 to-purple-600 p-6 rounded-2xl shadow-lg shadow-indigo-500/30 cursor-pointer hover:scale-[1.02] transition-all flex items-center gap-4"
            >
              <div className="bg-white/20 p-3 rounded-full text-white">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="text-left flex-1 text-white">
                <h3 className="font-bold text-lg">Học Sinh / Thí Sinh</h3>
                <p className="text-indigo-100 text-sm">Vào thi trên điện thoại</p>
              </div>
              <ArrowRight className="text-white/60" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // 2. Teacher Dashboard & Leaderboard
  if (currentView === AppView.TEACHER_DASHBOARD) {
    const teamScores = calculateTeamScores();

    return (
      <Layout showBack onBack={() => setCurrentView(AppView.LANDING)}>
        {showReportModal && renderExamReport()}

        {/* Team Settings Modal */}
        {showTeamSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
             <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Settings className="w-5 h-5 text-blue-600" /> Cấu Hình Đội Thi</h3>
                    <button onClick={() => setShowTeamSettings(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                </div>
                <div className="p-6 space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tên Đội 1</label>
                      <input 
                         className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                         value={editingTeam1}
                         onChange={e => setEditingTeam1(e.target.value)}
                         placeholder="VD: Đội Đỏ"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Tên Đội 2</label>
                      <input 
                         className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                         value={editingTeam2}
                         onChange={e => setEditingTeam2(e.target.value)}
                         placeholder="VD: Đội Xanh"
                      />
                   </div>
                </div>
                <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
                   <Button variant="outline" onClick={() => setShowTeamSettings(false)} className="w-auto">Hủy</Button>
                   <Button onClick={handleSaveTeamSettings} className="w-auto">Lưu Thay Đổi</Button>
                </div>
             </div>
          </div>
        )}

        {/* Hidden Audio Element */}
        <audio ref={audioRef} src={musicFile || ''} loop />

        {/* Room Info Card */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-6 shadow-lg shadow-indigo-500/30 mb-6 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-20">
              <Wifi className="w-24 h-24" />
           </div>
           
           <div className="flex justify-between items-start mb-1">
              <h3 className="text-indigo-100 font-medium uppercase tracking-wider text-sm">Mã Phòng Thi Trực Tuyến</h3>
              {networkStatus === 'online' ? (
                 <div className="flex items-center gap-1 bg-green-500/20 px-2 py-0.5 rounded text-xs text-white border border-green-400/30">
                    <Signal className="w-3 h-3" /> Online
                 </div>
              ) : (
                 <div className="flex items-center gap-1 bg-red-500/20 px-2 py-0.5 rounded text-xs text-white border border-red-400/30">
                    <WifiOff className="w-3 h-3" /> Offline
                 </div>
              )}
           </div>

           <div className="flex items-end gap-3 mb-4">
              {peerId && networkStatus === 'online' ? (
                <span className="text-5xl font-black tracking-widest font-mono">{peerId}</span>
              ) : (
                <span className="text-2xl animate-pulse">Đang kết nối máy chủ...</span>
              )}
           </div>
           <div className="flex items-center gap-2 text-indigo-100 bg-white/20 w-fit px-3 py-1 rounded-full text-sm backdrop-blur-sm">
              <Users className="w-4 h-4" />
              <span>{connectedStudents} học sinh đang kết nối</span>
           </div>
           <p className="mt-4 text-xs text-indigo-200">
              * Yêu cầu học sinh nhập mã này trên điện thoại để tham gia.
           </p>
        </div>

        {/* Music Control Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${isMusicPlaying ? 'bg-green-100 text-green-600 animate-spin-slow' : 'bg-slate-100 text-slate-500'}`}>
                  {isMusicPlaying ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
              </div>
              <div>
                  <h3 className="font-bold text-slate-800">Nhạc nền trò chơi</h3>
                  <p className="text-xs text-slate-500">{musicFile ? 'Đã tải lên 1 file MP3' : 'Chưa có nhạc'}</p>
              </div>
           </div>
           
           <div className="flex gap-2">
               <input 
                  type="file" 
                  ref={musicInputRef} 
                  accept=".mp3,audio/*" 
                  className="hidden" 
                  onChange={handleMusicUpload}
               />
               <button 
                  onClick={() => musicInputRef.current?.click()}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl border border-slate-200"
                  title="Tải nhạc lên"
               >
                   <UploadCloud className="w-5 h-5" />
               </button>
               <button 
                  onClick={toggleMusic}
                  disabled={!musicFile}
                  className={`p-2 rounded-xl border transition-colors ${
                      !musicFile ? 'opacity-50 cursor-not-allowed border-slate-200 text-slate-400' :
                      isMusicPlaying ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-600'
                  }`}
                  title={isMusicPlaying ? "Tắt nhạc" : "Bật nhạc"}
               >
                   <Music className="w-5 h-5" />
               </button>
           </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                 <BarChart3 className="w-6 h-6 text-blue-600" /> Bảng Xếp Hạng Trực Tiếp
              </h2>
              <button onClick={handleOpenTeamSettings} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg" title="Cấu hình đội">
                 <Settings className="w-5 h-5" />
              </button>
          </div>
          
          <div className="space-y-3">
             {teamScores.map(([team, score], idx) => {
               const style = idx < 3 ? 'font-bold' : 'text-slate-600';
               const rankIcon = idx === 0 ? '👑' : `#${idx + 1}`;
               const memberCount = teamLiveCounts[team] || 0;

               return (
                 <div key={team} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100 transition-all hover:scale-[1.01]">
                    <div className="flex items-center gap-3">
                       <span className="w-8 text-center text-lg">{rankIcon}</span>
                       <div>
                          <div className={`font-medium ${style}`}>{team}</div>
                          {memberCount > 0 && (
                            <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                               <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                               </span>
                               {memberCount} đang online
                            </div>
                          )}
                       </div>
                    </div>
                    <span className="font-mono font-bold text-lg text-indigo-600">{score} điểm</span>
                 </div>
               )
             })}
          </div>
        </div>

        {/* Exam List */}
        <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Danh Sách Gói Đề Thi
             </h2>
             <button onClick={handleCreateNewExam} className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-bold shadow-md shadow-indigo-500/20 hover:bg-indigo-700 transition-colors">
                <Plus className="w-4 h-4" /> Tạo Đề Mới
             </button>
        </div>

        <div className="space-y-4">
           {exams.length === 0 ? (
               <div className="text-center py-10 text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                   Chưa có đề thi nào.
               </div>
           ) : (
               exams.map(exam => (
                   <div key={exam.id} className={`p-5 rounded-2xl border-2 transition-all ${
                       exam.status === 'RUNNING' ? 'border-green-500 bg-green-50 shadow-md ring-2 ring-green-100' : 'border-slate-100 bg-white hover:border-indigo-200'
                   }`}>
                       <div className="flex justify-between items-start mb-3">
                           <div>
                               <h3 className="font-bold text-slate-900 text-lg mb-1">{exam.title}</h3>
                               <p className="text-xs text-slate-500">{exam.questions.length} câu hỏi • Tạo lúc {new Date(exam.createdAt).toLocaleDateString()}</p>
                           </div>
                           <span className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${
                               exam.status === 'RUNNING' ? 'bg-green-600 text-white animate-pulse' :
                               exam.status === 'COMPLETED' ? 'bg-slate-200 text-slate-600' :
                               'bg-indigo-100 text-indigo-600'
                           }`}>
                               {exam.status === 'WAITING' ? 'Sẵn sàng' : 
                                exam.status === 'RUNNING' ? 'Đang phát' : 'Đã xong'}
                           </span>
                       </div>

                       <div className="grid grid-cols-2 gap-2 mt-4">
                           {exam.status === 'RUNNING' ? (
                               <Button variant="danger" onClick={() => handleStopExam(exam)} className="py-2 text-sm">
                                   <Power className="w-4 h-4" /> Dừng thi
                               </Button>
                           ) : (
                               <Button variant="primary" onClick={() => handleActivateExam(exam)} className="py-2 text-sm">
                                   <Play className="w-4 h-4" /> Phát đề này
                               </Button>
                           )}

                           {exam.status === 'COMPLETED' && (
                               <Button variant="secondary" onClick={() => handleResetExam(exam)} className="py-2 text-sm col-span-2">
                                   <RefreshCw className="w-4 h-4" /> Đặt lại
                               </Button>
                           )}
                           
                           <div className="flex gap-2 col-span-2">
                               <Button variant="outline" onClick={() => handleViewReport(exam)} className="py-2 text-sm flex-1">
                                   <BarChart3 className="w-4 h-4" /> Kết quả
                               </Button>
                               <Button variant="outline" onClick={() => handleEditExam(exam)} className="py-2 text-sm flex-1">
                                   <Edit2 className="w-4 h-4" /> Sửa
                               </Button>
                               <button onClick={() => handleDeleteExam(exam.id)} className="px-3 rounded-xl border-2 border-slate-100 text-red-500 hover:bg-red-50 hover:border-red-200">
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           </div>
                       </div>
                   </div>
               ))
           )}
        </div>
      </Layout>
    );
  }

  // 3. Teacher Edit (Enhanced)
  if (currentView === AppView.TEACHER_CREATE) {
      const handleSaveExam = () => {
         // Create default exam if we are creating new and only have ID
         const baseExam = exams.find(e => e.id === currentExamId);
         
         const updated: Exam = {
             id: currentExamId!,
             code: FIXED_EXAM_CODE, // We keep the same ROOM code, but change content
             title: newExamTitle || "Đề thi chưa đặt tên",
             description: "Đề thi trắc nghiệm",
             createdAt: baseExam ? baseExam.createdAt : Date.now(),
             questions: questions,
             status: 'WAITING'
         };

         // If creating new, we push. If updating, saveExam handles index logic.
         saveExam(updated);
         refreshData();
         
         // If we are editing the currently running exam, broadcast update immediately
         if (baseExam && baseExam.status === 'RUNNING') {
             broadcastExamUpdate(updated);
         }

         setCurrentView(AppView.TEACHER_DASHBOARD);
      };

      const handleAddQuestion = () => {
        setEditingQuestionId(null);
        setCurrentQText('');
        setCurrentQOptions(['', '', '', '']);
        setCurrentQCorrectIdx(0);
        setCurrentQTime(30);
        setShowQuestionModal(true);
      };

      const handleEditQuestion = (q: Question) => {
        setEditingQuestionId(q.id);
        setCurrentQText(q.text);
        setCurrentQOptions([...q.options]);
        setCurrentQCorrectIdx(q.correctAnswerIndex);
        setCurrentQTime(q.timeLimit || 30);
        setShowQuestionModal(true);
      };

      const handleDeleteQuestion = (id: string) => {
        if (confirm('Bạn có chắc chắn muốn xóa câu hỏi này?')) {
            setQuestions(prev => prev.filter(q => q.id !== id));
        }
      };

      const handleSaveQuestionForm = () => {
        if (!currentQText.trim() || currentQOptions.some(o => !o.trim())) {
            alert("Vui lòng nhập đầy đủ nội dung câu hỏi và các đáp án.");
            return;
        }
    
        const newQuestion: Question = {
            id: editingQuestionId || crypto.randomUUID(),
            text: currentQText,
            options: currentQOptions,
            correctAnswerIndex: currentQCorrectIdx,
            timeLimit: currentQTime
        };
    
        if (editingQuestionId) {
            setQuestions(prev => prev.map(q => q.id === editingQuestionId ? newQuestion : q));
        } else {
            setQuestions(prev => [...prev, newQuestion]);
        }
        setShowQuestionModal(false);
      };

      return (
         <Layout title="Soạn Thảo Đề Thi" showBack onBack={() => setCurrentView(AppView.TEACHER_DASHBOARD)}>
             
             {/* Format Guide Modal */}
             {showFormatGuide && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-white w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-lg flex items-center gap-2"><HelpCircle className="w-5 h-5 text-blue-600" /> Hướng Dẫn Soạn File Đề Thi</h3>
                        <button onClick={() => setShowFormatGuide(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                    </div>
                    <div className="p-6 space-y-4 text-slate-700">
                       <p>Soạn đề thi trong file <b>.txt</b> theo định dạng sau:</p>
                       
                       <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-sm space-y-1">
                          <p className="font-bold text-slate-900">Câu 1: Câu hỏi thứ nhất?</p>
                          <p>A. Đáp án A</p>
                          <p>B. Đáp án B</p>
                          <p>C. Đáp án C</p>
                          <p>D. Đáp án D</p>
                          <p className="text-green-600 font-bold">Đáp án: A</p>
                          <br/>
                          <p className="font-bold text-slate-900">Câu 2: Câu hỏi thứ hai?</p>
                          <p>...</p>
                       </div>

                       <h4 className="font-bold text-lg mt-4 flex items-center gap-2"><FlaskConical className="w-5 h-5 text-purple-600" /> Công Thức Hóa Học & Toán Học</h4>
                       <ul className="list-disc pl-5 space-y-2">
                          <li><b>Chỉ số dưới (Subscript):</b> Dùng dấu <code>_</code> hoặc tự động. <br/>Ví dụ: <code>H2O</code>, <code>H_2O</code>, <code>H_{'{'}2{'}'}SO_{'{'}4{'}'}</code> sẽ thành H<sub>2</sub>O, H<sub>2</sub>SO<sub>4</sub>.</li>
                          <li><b>Chỉ số trên (Superscript):</b> Dùng dấu <code>^</code>. <br/>Ví dụ: <code>x^2</code>, <code>Fe^3+</code>, <code>10^{'{'}23{'}'}</code> sẽ thành x<sup>2</sup>, Fe<sup>3+</sup>.</li>
                       </ul>

                       <h4 className="font-bold text-lg mt-4 flex items-center gap-2"><ImageIcon className="w-5 h-5 text-orange-600" /> Chèn Hình Ảnh</h4>
                       <ul className="list-disc pl-5 space-y-2">
                          <li>Dùng cú pháp: <code>![mô tả](link_ảnh)</code></li>
                          <li><b>Mẹo:</b> Bạn có thể copy ảnh từ máy tính (Ctrl+C) và dán (Ctrl+V) trực tiếp vào ô soạn câu hỏi.</li>
                       </ul>
                    </div>
                    <div className="p-4 border-t bg-slate-50 flex justify-end">
                       <Button onClick={() => setShowFormatGuide(false)} className="w-auto">Đã Hiểu</Button>
                    </div>
                  </div>
               </div>
             )}

             {/* Question Editor Modal */}
             {showQuestionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                  <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
                        <h3 className="font-bold text-lg">{editingQuestionId ? 'Sửa Câu Hỏi' : 'Thêm Câu Hỏi Mới'}</h3>
                        <button onClick={() => setShowQuestionModal(false)} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5 text-slate-500" /></button>
                    </div>
                    
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Nội dung câu hỏi</label>
                            <textarea 
                                className="w-full p-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" 
                                rows={3}
                                value={currentQText}
                                onChange={e => setCurrentQText(e.target.value)}
                                onPaste={handlePaste}
                                placeholder="Nhập câu hỏi... (Dán ảnh trực tiếp bằng Ctrl+V)"
                            />
                            <p className="text-xs text-slate-400 mt-1">Hỗ trợ: H2O (tự động), H_2 (chỉ số dưới), x^2 (mũ), Ctrl+V để dán ảnh.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Các lựa chọn (Chọn đáp án đúng)</label>
                            <div className="space-y-2">
                                {currentQOptions.map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2">
                                        <input 
                                            type="radio" 
                                            name="correctOption" 
                                            checked={currentQCorrectIdx === idx}
                                            onChange={() => setCurrentQCorrectIdx(idx)}
                                            className="w-5 h-5 text-blue-600"
                                        />
                                        <div className="flex-1 relative">
                                            <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">{String.fromCharCode(65+idx)}</span>
                                            <input 
                                                className={`w-full pl-8 p-2 border rounded-lg focus:ring-2 outline-none ${currentQCorrectIdx === idx ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' : 'border-slate-200'}`}
                                                value={opt}
                                                onChange={e => {
                                                    const newOpts = [...currentQOptions];
                                                    newOpts[idx] = e.target.value;
                                                    setCurrentQOptions(newOpts);
                                                }}
                                                placeholder={`Đáp án ${String.fromCharCode(65+idx)}`}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Thời gian trả lời (giây)</label>
                            <div className="flex items-center gap-2">
                                <Clock className="w-5 h-5 text-slate-500" />
                                <input 
                                    type="number" 
                                    min={5}
                                    max={300}
                                    className="w-24 p-2 border rounded-lg text-center font-bold"
                                    value={currentQTime}
                                    onChange={e => setCurrentQTime(Number(e.target.value))}
                                />
                                <span className="text-slate-500 text-sm">giây</span>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 border-t bg-slate-50 flex justify-end gap-2 rounded-b-2xl">
                        <Button variant="outline" onClick={() => setShowQuestionModal(false)} className="w-auto">Hủy</Button>
                        <Button onClick={handleSaveQuestionForm} className="w-auto">Lưu Câu Hỏi</Button>
                    </div>
                  </div>
                </div>
             )}

             <div className="bg-white p-6 rounded-2xl shadow-sm mb-6 border border-slate-100">
                 <label className="block text-sm font-bold text-slate-700 mb-1">Tên bài thi</label>
                 <input 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-lg font-medium text-slate-800" 
                    value={newExamTitle} 
                    onChange={e => setNewExamTitle(e.target.value)} 
                    placeholder="Nhập tên bài thi..."
                 />
             </div>
             
             <div className="flex items-center justify-between mb-4">
                 <h3 className="font-bold text-slate-700 flex items-center gap-2">
                    Danh sách câu hỏi <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{questions.length}</span>
                 </h3>
                 <div className="flex gap-2">
                    <button 
                       onClick={() => setShowFormatGuide(true)}
                       className="text-slate-500 hover:bg-slate-100 p-2 rounded-lg"
                       title="Hướng dẫn định dạng"
                    >
                       <HelpCircle className="w-5 h-5" />
                    </button>
                    <input 
                       type="file" 
                       ref={examUploadRef} 
                       accept=".txt" 
                       className="hidden" 
                       onChange={handleExamFileUpload}
                    />
                    <button 
                       onClick={() => examUploadRef.current?.click()}
                       className="flex items-center gap-1 bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-bold hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
                    >
                       <Upload className="w-4 h-4" /> Nhập từ File
                    </button>
                    <button onClick={handleAddQuestion} className="bg-blue-600 text-white text-sm font-bold flex items-center gap-1 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors shadow-sm shadow-blue-500/30">
                        <Plus className="w-4 h-4" /> Thêm thủ công
                    </button>
                 </div>
             </div>

             <div className="space-y-3 mb-8">
                 {questions.length === 0 ? (
                     <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-200 text-slate-400 flex flex-col items-center gap-3">
                        <div className="bg-slate-50 p-4 rounded-full">
                           <FileUp className="w-8 h-8 text-slate-300" />
                        </div>
                        <p>Chưa có câu hỏi nào.</p>
                        <div className="flex gap-2">
                           <button onClick={handleAddQuestion} className="text-blue-600 font-bold hover:underline">Thêm mới</button>
                           <span>hoặc</span>
                           <button onClick={() => examUploadRef.current?.click()} className="text-blue-600 font-bold hover:underline">Tải lên file TXT</button>
                        </div>
                     </div>
                 ) : (
                    questions.map((q, idx) => (
                        <div key={q.id} className="bg-white p-4 border border-slate-200 rounded-xl shadow-sm hover:border-blue-300 transition-colors group">
                            <div className="flex justify-between items-start mb-2 gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-bold text-slate-500 text-sm">Câu {idx+1}</span>
                                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> {q.timeLimit || 30}s
                                        </span>
                                    </div>
                                    {/* Use formatContent here to preview formatting in the list */}
                                    <div className="font-medium text-slate-800 line-clamp-2" dangerouslySetInnerHTML={{__html: formatContent(q.text)}} />
                                </div>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEditQuestion(q)} className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg" title="Sửa">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleDeleteQuestion(q.id)} className="p-2 hover:bg-red-50 text-red-500 rounded-lg" title="Xóa">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500">
                                Đáp án đúng: <span className="font-bold text-green-600">{String.fromCharCode(65 + q.correctAnswerIndex)}</span>
                            </div>
                        </div>
                    ))
                 )}
             </div>
             
             <div className="sticky bottom-4 z-10">
                 <Button onClick={handleSaveExam} className="shadow-xl shadow-blue-500/20">
                    <Save className="w-5 h-5" /> Lưu & Cập Nhật Đề Thi
                 </Button>
             </div>
         </Layout>
      )
  }

  // 4. Student Enter
  if (currentView === AppView.STUDENT_ENTER) {
      return (
          <Layout showBack onBack={() => setCurrentView(AppView.LANDING)}>
              <div className="text-center mb-8 mt-4">
                 <div className="bg-indigo-600 rounded-3xl p-5 w-16 h-16 flex items-center justify-center mx-auto shadow-lg shadow-indigo-500/30 mb-4">
                  <GraduationCap className="text-white w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Vào Phòng Thi</h2>
              </div>
      
              <div className="bg-white p-6 rounded-2xl shadow-sm space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Họ và tên</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Nhập tên của bạn"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Chọn Đội</label>
                  <div className="relative">
                    <select 
                      className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none bg-white font-medium text-slate-700"
                      value={studentTeam}
                      onChange={(e) => setStudentTeam(e.target.value)}
                    >
                      {teams.map(team => (
                        <option key={team} value={team}>{team}</option>
                      ))}
                    </select>
                    <Users className="absolute right-3 top-3.5 text-slate-400 w-5 h-5 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Mã Phòng Thi</label>
                  <input 
                    type="text" 
                    className="w-full p-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-center text-lg tracking-widest"
                    placeholder="VD: 123456"
                    value={examCode}
                    onChange={(e) => setExamCode(e.target.value)}
                  />
                  <p className="text-xs text-slate-400 mt-1 text-center">Nhập mã 6 số hiển thị trên màn hình giáo viên</p>
                </div>
                
                <Button 
                  variant="secondary" 
                  onClick={handleStudentJoin} 
                  className="mt-4"
                  isLoading={connectionStatus === 'CONNECTING'}
                >
                  <Wifi className="w-5 h-5" /> Kết Nối & Vào Thi
                </Button>
              </div>
            </Layout>
      )
  }

  // 5. Student Exam Flow
  if (currentView === AppView.STUDENT_EXAM && currentExam) {
      
      // A. Waiting Screen
      if (currentExam.status === 'WAITING') {
          return (
              <Layout>
                  <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
                      <div className="relative">
                          <div className="w-20 h-20 border-4 border-slate-200 rounded-full"></div>
                          <div className="w-20 h-20 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin absolute top-0 left-0"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                              <Wifi className="w-8 h-8 text-indigo-600" />
                          </div>
                      </div>
                      <div>
                          <h2 className="text-xl font-bold text-slate-800">Đã kết nối thành công!</h2>
                          <p className="text-slate-500 mt-2">Đang chờ giáo viên bắt đầu bài thi...</p>
                      </div>
                      <div className="bg-white px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-indigo-600 flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                          {studentName} • {studentTeam}
                      </div>
                  </div>
              </Layout>
          )
      }

      // B. Result/Completed Screen
      if (examResult) {
          if (currentExam.status !== 'COMPLETED') {
              return (
                  <Layout>
                      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                          <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
                             <CheckCircle className="w-12 h-12 text-green-600" />
                          </div>
                          <h2 className="text-2xl font-bold text-slate-900 mb-2">Đã nộp bài thành công!</h2>
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-4 max-w-sm">
                              <div className="flex items-center gap-2 text-slate-800 font-medium mb-1">
                                  <Lock className="w-4 h-4 text-slate-500" /> 
                                  Kết quả đang bị ẩn
                              </div>
                              <p className="text-slate-500 text-sm">
                                  Điểm số và đáp án sẽ được hiển thị trên màn hình này ngay sau khi Giáo viên ấn nút <b>"Dừng thi"</b>.
                              </p>
                          </div>
                          <div className="mt-8 flex items-center gap-2 text-sm text-slate-400 animate-pulse">
                              <div className="w-2 h-2 bg-slate-400 rounded-full"></div>
                              Đang chờ giáo viên kết thúc...
                          </div>
                      </div>
                  </Layout>
              )
          } else {
              // Exam COMPLETED -> Show Results
              // NOTE: For review, we ideally want to show the original order (or the shuffled order if preferred).
              // Since the result object answers are normalized to MASTER order, we should render using currentExam.questions (Master List).
              return (
                  <Layout>
                    <div className="text-center bg-white p-8 rounded-3xl shadow-sm mb-6 mt-4 border-2 border-indigo-100">
                      <div className="inline-block p-3 rounded-full bg-indigo-50 mb-4">
                         <Trophy className="w-8 h-8 text-indigo-600" />
                      </div>
                      <h2 className="text-xl font-bold text-slate-900 mb-1">Kết Quả Bài Thi</h2>
                      <div className="flex items-center justify-center gap-2 mb-6 text-sm">
                        <span className="font-semibold text-slate-700">{examResult.studentName}</span>
                        <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">{examResult.team}</span>
                      </div>
                      
                      <div className="flex justify-center items-end gap-2 mb-2">
                          <span className="text-7xl font-black text-indigo-600 tracking-tighter">{examResult.score}</span>
                          <div className="flex flex-col items-start pb-2">
                              <span className="text-sm font-bold text-slate-400 uppercase">Điểm</span>
                              <span className="text-xs text-slate-400">/ 10</span>
                          </div>
                      </div>
                      <div className="text-sm text-slate-500 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-100">
                          Đúng {examResult.rawScore}/{examResult.totalQuestions} câu hỏi
                      </div>
            
                      <div className="mt-8 pt-6 border-t border-slate-100">
                         <Button variant="outline" onClick={() => {
                             // Reset connection
                             if (studentPeerRef.current) studentPeerRef.current.destroy();
                             setConnectionStatus('DISCONNECTED');
                             setCurrentView(AppView.LANDING);
                         }}>
                           Về trang chủ
                         </Button>
                      </div>
                    </div>
            
                    <div className="space-y-4 pb-10">
                      {currentExam.questions.map((q, idx) => {
                        const userAnswer = examResult.answers[idx]; // These are normalized to Master Order
                        const isCorrect = userAnswer === q.correctAnswerIndex;
                        return (
                          <div key={q.id} className={`p-4 rounded-xl border-2 ${isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex justify-between items-start mb-2">
                               <div className="flex gap-2">
                                  <span className={`font-black text-sm w-6 h-6 rounded-full flex items-center justify-center ${isCorrect ? 'bg-green-200 text-green-700' : 'bg-red-200 text-red-700'}`}>
                                      {idx + 1}
                                  </span>
                                  <div className="font-medium text-slate-800 text-sm flex-1" dangerouslySetInnerHTML={{ __html: formatContent(q.text) }} />
                               </div>
                               {isCorrect ? <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" /> : <XCircle className="w-6 h-6 text-red-500 flex-shrink-0" />}
                            </div>
                            <div className="text-sm mt-3 pt-3 border-t border-black/5 space-y-1">
                               {!isCorrect && (
                                <div className="text-slate-600 flex flex-col gap-1">
                                  <span className="text-xs uppercase font-bold text-slate-400">Đáp án đúng</span>
                                  <span className="font-bold text-green-700" dangerouslySetInnerHTML={{ __html: formatContent(q.options[q.correctAnswerIndex]) }} />
                                </div>
                              )}
                              {isCorrect && (
                                  <div className="text-green-700 text-xs font-bold uppercase flex items-center gap-1">
                                      <CheckCircle className="w-3 h-3" /> Chính xác
                                  </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </Layout>
              )
          }
      }

      // C. Taking Exam - Use SHUFFLED Questions
      const activeQuestion = shuffledQuestions[currentQuestionIndex];
      const totalQ = shuffledQuestions.length;
      const progress = ((currentQuestionIndex) / totalQ) * 100;

      // Safety check in case shuffledQuestions isn't ready
      if (!activeQuestion) return <div className="p-10 text-center">Đang tải đề thi...</div>;

      return (
        <Layout showBack={false}>
          {/* Header */}
          <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 sticky top-4 z-10 border border-slate-100">
             <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                   <div className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold">
                      Câu {currentQuestionIndex + 1}/{totalQ}
                   </div>
                   <div className="text-xs text-slate-400 flex items-center gap-1">
                      <Shuffle className="w-3 h-3" /> Đề ngẫu nhiên
                   </div>
                </div>
                <div className={`flex items-center gap-1 font-mono text-xl font-bold ${timeLeft <= 5 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
                   <Timer className="w-5 h-5" />
                   {timeLeft}s
                </div>
             </div>
             <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                <div className="bg-indigo-500 h-2 rounded-full transition-all duration-300 ease-out" style={{ width: `${progress}%` }}></div>
             </div>
          </div>
  
          {/* Question */}
          <div className="space-y-6 pb-24">
            <div className="bg-white p-6 rounded-2xl shadow-sm min-h-[300px] flex flex-col">
              <div className="font-medium text-slate-800 text-xl leading-relaxed mb-6 flex-1" dangerouslySetInnerHTML={{ __html: formatContent(activeQuestion.text) }} />
              
              <div className="space-y-3">
                {activeQuestion.options.map((opt, optIdx) => (
                  <button
                    key={optIdx}
                    onClick={() => {
                        const newAnswers = [...studentAnswers];
                        newAnswers[currentQuestionIndex] = optIdx;
                        setStudentAnswers(newAnswers);
                    }}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 flex items-center gap-3 ${
                      studentAnswers[currentQuestionIndex] === optIdx 
                        ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold shadow-sm' 
                        : 'border-slate-100 hover:border-indigo-200 text-slate-600'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border ${
                       studentAnswers[currentQuestionIndex] === optIdx ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-white text-slate-400 border-slate-200'
                    }`}>
                        {String.fromCharCode(65 + optIdx)}
                    </div>
                    <span className="flex-1" dangerouslySetInnerHTML={{ __html: formatContent(opt) }} />
                  </button>
                ))}
              </div>
            </div>
          </div>
  
          {/* Next Button */}
          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 safe-area-bottom z-20">
            <div className="max-w-md mx-auto">
               <Button variant="secondary" onClick={handleNextQuestion}>
                  {currentQuestionIndex === totalQ - 1 ? "Nộp bài" : "Câu tiếp theo"} <ArrowRight className="w-5 h-5" />
               </Button>
            </div>
          </div>
        </Layout>
      );
  }

  return <div>Loading...</div>;
};

export default App;
