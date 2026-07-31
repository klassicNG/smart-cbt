"use client";
import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { FileText, UploadCloud, CheckCircle2, XCircle, BookOpen, Layers, PenTool, Camera, ImagePlus, Loader, AlertTriangle, Home, Zap, Printer, Brain, X, Crosshair, User, Activity } from 'lucide-react';

type Question = {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
  topic: string;
};

type UserStats = {
  runs: number;
  totalCorrect: number;
  totalQuestions: number;
  weakestTopic: string;
  topicData: Record<string, { correct: number; total: number }>;
};

export default function Dashboard() {
  const [step, setStep] = useState<'onboarding' | 'home' | 'upload' | 'config' | 'exam' | 'results'>('onboarding');
  const [username, setUsername] = useState('');
  
  const [stats, setStats] = useState<UserStats>({
    runs: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    weakestTopic: 'None yet',
    topicData: {}
  });

  const [files, setFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [quiz, setQuiz] = useState<Question[] | null>(null);
  const [examMode, setExamMode] = useState<'ca' | 'exam'>('ca'); 
  const [feedbackMode, setFeedbackMode] = useState<'haptic' | 'standard'>('haptic');
  
  const [loading, setLoading] = useState(false);
  const [fetchingBatch, setFetchingBatch] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [chunkIndex, setChunkIndex] = useState(0);
  const targetQuestions = examMode === 'ca' ? 40 : 60;

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt', '.md'] },
    onDrop: (acceptedFiles) => setFiles((prev) => [...prev, ...acceptedFiles]),
  });

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

  useEffect(() => {
    if (step !== 'exam' || loading || timeLeft <= 0) {
      if (step === 'exam' && timeLeft === 0 && !loading) handleSubmitExam();
      return;
    }
    const timerId = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timerId);
  }, [step, timeLeft, loading]);

  useEffect(() => {
    if (step === 'exam' && quiz && quiz.length > 0 && quiz.length < targetQuestions && !fetchingBatch) {
      fetchNextBatch();
    }
  }, [quiz, step, fetchingBatch, targetQuestions]);

  const fetchNextBatch = async () => {
    setFetchingBatch(true);
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (notes) formData.append('notes', notes);
      formData.append('batchSize', '10');
      formData.append('chunkIndex', String(chunkIndex + 1)); 

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      if (res.ok) {
        const data = await res.json();
        setQuiz((prev) => [...(prev || []), ...data.quiz]);
        setChunkIndex((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Background batch fetch failed:", err);
    } finally {
      setFetchingBatch(false);
    }
  };

  const handleLaunch = async () => {
    setLoading(true);
    setQuiz(null);
    setSelectedAnswers({});
    setChunkIndex(0);
    setTimeLeft(examMode === 'ca' ? 30 * 60 : 40 * 60);
    setStep('exam');

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (notes) formData.append('notes', notes);
      formData.append('batchSize', '10'); 
      formData.append('chunkIndex', '0');

      const res = await fetch('/api/generate', { method: 'POST', body: formData });
      if (!res.ok) throw new Error("Generation failed");

      const data = await res.json();
      setQuiz(data.quiz);
    } catch (err) {
      alert("Error initializing simulator. Ensure files contain clear text.");
      setStep('config');
    } finally {
      setLoading(false);
    }
  };

  const calculateCurrentScore = () => {
    if (!quiz) return { score: 0, topics: {} };
    let correctCount = 0;
    const currentTopicData: Record<string, { correct: number; total: number }> = {};
    
    quiz.forEach((q, idx) => {
      const isCorrect = selectedAnswers[idx] === q.answer;
      if (isCorrect) correctCount++;
      const t = q.topic || "General";
      if (!currentTopicData[t]) currentTopicData[t] = { correct: 0, total: 0 };
      currentTopicData[t].total++;
      if (isCorrect) currentTopicData[t].correct++;
    });
    
    return { score: correctCount, topics: currentTopicData };
  };

  const handleSubmitExam = () => {
    const currentResults = calculateCurrentScore();
    setStats(prev => {
      const newRuns = prev.runs + 1;
      const newTotalCorrect = prev.totalCorrect + currentResults.score;
      const newTotalQuestions = prev.totalQuestions + quiz!.length;
      
      const newTopicData = { ...prev.topicData };
      Object.entries(currentResults.topics).forEach(([t, d]) => {
        if (!newTopicData[t]) newTopicData[t] = { correct: 0, total: 0 };
        newTopicData[t].correct += d.correct;
        newTopicData[t].total += d.total;
      });
      
      let weakest = 'None yet';
      let lowestPercent = 101;
      Object.entries(newTopicData).forEach(([t, d]) => {
        const pct = Math.round((d.correct / d.total) * 100);
        if (pct < lowestPercent) {
          lowestPercent = pct;
          weakest = t;
        }
      });
      return { runs: newRuns, totalCorrect: newTotalCorrect, totalQuestions: newTotalQuestions, weakestTopic: weakest, topicData: newTopicData };
    });
    setStep('results');
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentAnalytics = step === 'results' ? calculateCurrentScore() : null;
  const isExamComplete = quiz && quiz.length >= targetQuestions;
  const globalAverage = stats.totalQuestions > 0 ? Math.round((stats.totalCorrect / stats.totalQuestions) * 100) : 0;

  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#2C2C2C] font-sans selection:bg-[#3B4638] selection:text-white overflow-hidden">
      
      {/* STEP 0: ONBOARDING GATE */}
      {step === 'onboarding' && (
        <div className="m-auto flex flex-col items-center justify-center w-full max-w-md p-8 animate-in zoom-in-95 duration-700">
          <div className="bg-white border border-[#F3EFEA] rounded-[2rem] p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-full text-center">
            <div className="w-16 h-16 bg-[#F6F7F6] rounded-full flex items-center justify-center mx-auto mb-6">
              <User className="w-8 h-8 text-[#3B4638]" />
            </div>
            <h1 className="text-3xl font-bold mb-2 tracking-tight">Welcome.</h1>
            <p className="text-[#7D7873] text-sm mb-8">What should we call you during your sessions?</p>
            
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name..." 
              onKeyDown={(e) => { if(e.key === 'Enter' && username.trim()) setStep('home') }}
              className="w-full bg-[#F6F7F6] border-none rounded-2xl p-5 text-center font-medium focus:outline-none focus:ring-2 focus:ring-[#3B4638]/20 mb-6 transition-colors placeholder:text-[#A39D98] text-[#2C2C2C]"
            />
            
            <button 
              onClick={() => setStep('home')} 
              disabled={!username.trim()}
              className="w-full py-5 bg-[#3B4638] hover:bg-[#2C3529] text-white font-bold rounded-[1.5rem] disabled:opacity-50 transition-all shadow-md"
            >
              Access Dashboard
            </button>
          </div>
        </div>
      )}

      {/* MAIN APPLICATION */}
      {step !== 'onboarding' && (
        <>
          <aside className="w-72 border-r border-[#EAE6DF] bg-[#FDFBF7] p-8 flex-col justify-between hidden md:flex relative z-10">
            <div className="space-y-10">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-[#3B4638] rounded-2xl shadow-sm">
                  <BookOpen className="w-6 h-6 text-[#FDFBF7]" />
                </div>
                <div>
                  <h2 className="font-semibold text-xl tracking-tight leading-none">SmartCBT</h2>
                  <span className="text-xs font-medium text-[#7D7873]">Gemma Engine</span>
                </div>
              </div>
              <nav className="space-y-3">
                <button onClick={() => setStep('home')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all ${step === 'home' ? 'bg-white text-[#3B4638] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#F3EFEA]' : 'bg-transparent text-[#7D7873] hover:bg-white hover:shadow-sm'}`}>
                  <Home className="w-4 h-4" /> Overview
                </button>
                <button onClick={() => setStep('upload')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all ${step === 'upload' || step === 'config' ? 'bg-white text-[#3B4638] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#F3EFEA]' : 'bg-transparent text-[#7D7873] hover:bg-white hover:shadow-sm'}`}>
                  <Layers className="w-4 h-4" /> E-Exam Simulator
                </button>
                {/* NEW WRITTEN EXAM LINK */}
                <Link href="/written" className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all bg-transparent text-[#7D7873] hover:bg-white hover:shadow-sm border border-transparent">
                  <PenTool className="w-4 h-4" /> Written Exam Grader
                </Link>
              </nav>
            </div>
            
            <div className="text-[11px] font-medium tracking-wide text-[#A39D98] text-center">
              System Version 2.2.0-RC
            </div>
          </aside>

          <main className="flex-1 overflow-y-auto p-10 relative z-10 scroll-smooth">
            <div className="max-w-4xl mx-auto space-y-8">
              
              {/* STEP 1: HOME DASHBOARD */}
              {step === 'home' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <header className="mb-10">
                    <h1 className="text-4xl font-bold tracking-tight mb-2">Hello, {username}! 👋</h1>
                    <p className="text-[#7D7873] font-medium">Here's your performance overview based on recent sessions.</p>
                  </header>

                  <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#F3EFEA]">
                      <div className="w-12 h-12 rounded-2xl bg-[#F6F7F6] flex items-center justify-center mb-6">
                        <Activity className="w-5 h-5 text-[#3B4638]" />
                      </div>
                      <div className="text-4xl font-semibold mb-1">{stats.runs}</div>
                      <div className="text-sm text-[#7D7873] font-medium">Simulations Run</div>
                    </div>
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#F3EFEA]">
                      <div className="w-12 h-12 rounded-2xl bg-[#FDF5F5] flex items-center justify-center mb-6">
                        <BarChart3 className="w-5 h-5 text-[#D47A74]" />
                      </div>
                      <div className="text-4xl font-semibold mb-1">{globalAverage}%</div>
                      <div className="text-sm text-[#7D7873] font-medium">Average Score</div>
                    </div>
                    <div className="bg-white rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] border border-[#F3EFEA]">
                      <div className="w-12 h-12 rounded-2xl bg-[#FFF9EB] flex items-center justify-center mb-6">
                        <AlertCircle className="w-5 h-5 text-[#D99A29]" />
                      </div>
                      <div className="text-xl font-semibold mb-1 truncate pt-3">{stats.weakestTopic}</div>
                      <div className="text-sm text-[#7D7873] font-medium mt-2">Weakest Topic</div>
                    </div>
                  </div>

                  <div className="bg-[#3B4638] rounded-[2.5rem] p-10 shadow-lg flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold text-white mb-2 tracking-tight">Ready for your next session?</h3>
                      <p className="text-[#A7B3A4] font-medium text-sm">Upload your latest study materials to generate a new mock exam.</p>
                    </div>
                    <button onClick={() => setStep('upload')} className="px-8 py-4 bg-white text-[#3B4638] font-bold rounded-2xl hover:bg-[#F3EFEA] transition-all shadow-sm">
                      Start E-Exam Simulator
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: UPLOAD */}
              {step === 'upload' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                   <header className="mb-6">
                    <h1 className="text-3xl font-bold tracking-tight">E-Exam Setup</h1>
                    <p className="text-sm text-[#7D7873] font-medium mt-1">Provide your courseware to generate a tailored CBT.</p>
                  </header>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div {...getRootProps()} className={`border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isDragActive ? 'border-[#3B4638] bg-[#F6F7F6]' : 'border-[#EAE6DF] bg-white hover:bg-[#FDFBF7]'}`}>
                      <input {...getInputProps()} />
                      <UploadCloud className="w-12 h-12 text-[#3B4638] mb-4" />
                      <h3 className="font-semibold text-lg">Drop Documents</h3>
                      <p className="text-xs text-[#7D7873] mt-2 font-medium">Supports multiple PDFs, TXT, or MD</p>
                    </div>
                    
                    <div className="bg-white border border-[#F3EFEA] rounded-[2rem] p-8 flex flex-col shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                      <label className="text-xs font-semibold text-[#7D7873] uppercase tracking-wider mb-3">Or Paste Notes</label>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste excerpts here..." className="w-full flex-1 bg-[#F6F7F6] border-none rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B4638]/20 resize-none placeholder:text-[#A39D98]" />
                    </div>
                    
                    {files.length > 0 && (
                      <div className="md:col-span-2 flex flex-wrap gap-3">
                        {files.map((file, idx) => (
                          <div key={idx} className="flex items-center gap-2 px-5 py-3 bg-white border border-[#EAE6DF] rounded-2xl text-sm font-medium text-[#3B4638] shadow-sm">
                            <FileText className="w-4 h-4" /> {file.name}
                            <button onClick={() => removeFile(idx)} className="ml-2 text-[#A39D98] hover:text-[#D47A74] transition-colors"><XCircle className="w-4 h-4" /></button>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    <div className="md:col-span-2 mt-4">
                      <button onClick={() => setStep('config')} disabled={files.length === 0 && !notes.trim()} className="w-full py-5 bg-[#3B4638] hover:bg-[#2C3529] font-bold rounded-[1.5rem] text-white transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                        Configure Parameters <ChevronRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: CONFIGURATION */}
              {step === 'config' && (
                <div className="bg-white rounded-[2.5rem] p-12 animate-in zoom-in-95 duration-300 shadow-[0_8px_30px_rgb(0,0,0,0.03)] border border-[#F3EFEA]">
                  <div className="flex items-center gap-4 mb-10 pb-6 border-b border-[#F3EFEA]">
                    <div className="p-3 bg-[#F6F7F6] rounded-2xl">
                      <Settings className="w-6 h-6 text-[#3B4638]" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Simulator Parameters</h2>
                  </div>
                  <div className="grid md:grid-cols-2 gap-10 mb-12">
                    <div className="space-y-5">
                      <label className="text-xs font-semibold text-[#7D7873] uppercase tracking-wider">Assessment Type</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setExamMode('ca')} className={`p-6 rounded-[1.5rem] text-left transition-all border ${examMode === 'ca' ? 'bg-[#3B4638] border-[#3B4638] text-white shadow-md' : 'bg-[#FDFBF7] border-[#EAE6DF] text-[#7D7873] hover:bg-white'}`}>
                          <div className="font-semibold text-lg mb-1">C.A. Mode</div><div className={`text-xs font-medium ${examMode === 'ca' ? 'text-[#A7B3A4]' : 'text-[#A39D98]'}`}>40 Questions • 30m</div>
                        </button>
                        <button onClick={() => setExamMode('exam')} className={`p-6 rounded-[1.5rem] text-left transition-all border ${examMode === 'exam' ? 'bg-[#3B4638] border-[#3B4638] text-white shadow-md' : 'bg-[#FDFBF7] border-[#EAE6DF] text-[#7D7873] hover:bg-white'}`}>
                          <div className="font-semibold text-lg mb-1">Exam Mode</div><div className={`text-xs font-medium ${examMode === 'exam' ? 'text-[#A7B3A4]' : 'text-[#A39D98]'}`}>60 Questions • 40m</div>
                        </button>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <label className="text-xs font-semibold text-[#7D7873] uppercase tracking-wider">Feedback Rules</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button onClick={() => setFeedbackMode('haptic')} className={`p-6 rounded-[1.5rem] text-left transition-all border ${feedbackMode === 'haptic' ? 'bg-[#3B4638] border-[#3B4638] text-white shadow-md' : 'bg-[#FDFBF7] border-[#EAE6DF] text-[#7D7873] hover:bg-white'}`}>
                          <div className="font-semibold text-lg mb-1">Haptic</div><div className={`text-xs font-medium ${feedbackMode === 'haptic' ? 'text-[#A7B3A4]' : 'text-[#A39D98]'}`}>Instant grading</div>
                        </button>
                        <button onClick={() => setFeedbackMode('standard')} className={`p-6 rounded-[1.5rem] text-left transition-all border ${feedbackMode === 'standard' ? 'bg-[#3B4638] border-[#3B4638] text-white shadow-md' : 'bg-[#FDFBF7] border-[#EAE6DF] text-[#7D7873] hover:bg-white'}`}>
                          <div className="font-semibold text-lg mb-1">Standard</div><div className={`text-xs font-medium ${feedbackMode === 'standard' ? 'text-[#A7B3A4]' : 'text-[#A39D98]'}`}>Blind testing</div>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setStep('upload')} className="px-8 py-5 rounded-[1.5rem] font-semibold text-[#7D7873] bg-[#FDFBF7] border border-[#EAE6DF] hover:bg-white transition-all">
                      Cancel
                    </button>
                    <button onClick={handleLaunch} className="flex-1 py-5 bg-[#3B4638] text-white font-bold rounded-[1.5rem] transition-all hover:bg-[#2C3529] shadow-md flex items-center justify-center gap-2">
                      Initialize Neural Engine
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 4: EXAM INTERFACE */}
              {step === 'exam' && (
                <div className="space-y-6 animate-in fade-in duration-700 relative">
                  <div className="sticky top-0 z-50 flex justify-between items-center bg-white/90 p-5 rounded-[1.5rem] backdrop-blur-md shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-[#F3EFEA] mb-8">
                    <div className="flex items-center gap-3">
                       {loading ? (
                        <span className="text-sm font-semibold text-[#3B4638] animate-pulse flex items-center gap-2">
                          <Loader className="w-4 h-4 animate-spin" /> Parsing initial text context...
                        </span>
                      ) : fetchingBatch ? (
                        <span className="text-xs font-semibold text-[#3B4638] flex items-center gap-2 px-4 py-2 bg-[#F6F7F6] rounded-xl border border-[#EAE6DF]">
                          <Loader className="w-3.5 h-3.5 animate-spin" /> Generating Questions {(chunkIndex * 10) + 1}-{(chunkIndex * 10) + 10}...
                        </span>
                      ) : isExamComplete ? (
                         <span className="text-xs font-semibold text-[#486D51] flex items-center gap-2 px-4 py-2 bg-[#EAF3EA] rounded-xl border border-[#C5E0CC]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> All questions loaded
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-[#A39D98]">Batches synced</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {!loading && quiz && (
                        <span className="text-xs font-semibold bg-[#FDFBF7] border border-[#EAE6DF] px-4 py-2 rounded-xl text-[#7D7873]">
                          {Object.keys(selectedAnswers).length} / {targetQuestions} Answered
                        </span>
                      )}
                      <div className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-lg font-bold tracking-widest ${loading ? 'opacity-50 grayscale' : ''} ${timeLeft < 300 && !loading ? 'bg-[#FDF5F5] text-[#D47A74] border border-[#F7DCDA] animate-pulse' : 'bg-[#F6F7F6] border border-[#EAE6DF] text-[#3B4638]'}`}>
                        <Timer className="w-5 h-5" /> {loading ? '--:--' : formatTime(timeLeft)}
                      </div>
                    </div>
                  </div>

                  {!loading && quiz && quiz.map((q, idx) => {
                    const isSelected = selectedAnswers[idx] !== undefined;
                    const isCorrect = selectedAnswers[idx] === q.answer;
                    const showFeedback = feedbackMode === 'haptic' && isSelected;

                    return (
                      <div key={idx} className="bg-white border border-[#F3EFEA] rounded-[2rem] p-8 space-y-6 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                        <div className="flex justify-between items-start gap-4 mb-2">
                          <h3 className="font-semibold text-lg text-[#2C2C2C] leading-relaxed"><span className="text-[#3B4638] mr-1">{idx + 1}.</span> {q.question}</h3>
                          <span className="text-[10px] px-3 py-1.5 bg-[#F6F7F6] border border-[#EAE6DF] rounded-lg uppercase tracking-wider font-semibold text-[#7D7873] whitespace-nowrap">{q.topic}</span>
                        </div>
                        <div className="grid gap-3">
                          {q.options.map((opt, oIdx) => (
                            <button
                              key={oIdx}
                              disabled={isSelected && feedbackMode === 'haptic'}
                              onClick={() => setSelectedAnswers(prev => ({ ...prev, [idx]: opt }))}
                              className={`w-full text-left p-5 rounded-2xl border transition-all flex items-center justify-between font-medium text-sm ${
                                isSelected && feedbackMode === 'haptic'
                                  ? opt === q.answer ? 'bg-[#EAF3EA] border-[#89C794] text-[#2A4B31]' : opt === selectedAnswers[idx] ? 'bg-[#FDF5F5] border-[#D47A74] text-[#8C3A35]' : 'bg-[#FDFBF7] border-[#EAE6DF] opacity-40 text-[#A39D98]'
                                  : opt === selectedAnswers[idx] ? 'bg-[#3B4638] text-white border-[#3B4638] shadow-md' : 'bg-[#FDFBF7] border-[#EAE6DF] hover:bg-[#F6F7F6] text-[#6B6661]'
                              }`}
                            >
                              <span>{opt}</span>
                              {showFeedback && opt === q.answer && <CheckCircle2 className="w-5 h-5 text-[#486D51]" />}
                              {showFeedback && opt === selectedAnswers[idx] && opt !== q.answer && <XCircle className="w-5 h-5 text-[#D47A74]" />}
                            </button>
                          ))}
                        </div>
                        {showFeedback && (
                          <div className={`p-6 rounded-2xl text-sm space-y-2 mt-4 ${isCorrect ? 'bg-[#EAF3EA]/50 text-[#2A4B31] border border-[#C5E0CC]' : 'bg-[#FDF5F5]/50 text-[#8C3A35] border border-[#F7DCDA]'}`}>
                            <span className="font-bold uppercase tracking-wider text-[10px] opacity-80">Explanation</span>
                            <p className="leading-relaxed">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {!loading && quiz && (
                    <button 
                      onClick={handleSubmitExam} 
                      disabled={!isExamComplete}
                      className="w-full py-6 mt-10 bg-[#3B4638] hover:bg-[#2C3529] text-white font-bold text-lg rounded-[1.5rem] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
                    >
                      {isExamComplete ? "Finalize & Grade Assessment" : `Generating Assessment (${quiz.length}/${targetQuestions} Ready)...`}
                    </button>
                  )}
                </div>
              )}

              {/* STEP 5: RESULTS & ANALYTICS */}
              {step === 'results' && currentAnalytics && (
                <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
                  <div className="bg-[#3B4638] rounded-[2.5rem] p-14 text-center shadow-lg relative overflow-hidden">
                    <BarChart3 className="w-14 h-14 text-[#A7B3A4] mx-auto mb-6 relative z-10" />
                    <h2 className="text-6xl font-bold text-white mb-2 tracking-tight relative z-10">{Math.round((currentAnalytics.score / quiz!.length) * 100)}%</h2>
                    <p className="text-[#A7B3A4] text-lg font-medium relative z-10">You scored {currentAnalytics.score} out of {quiz!.length}</p>
                  </div>

                  <div className="bg-white border border-[#F3EFEA] rounded-[2.5rem] p-10 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                    <h3 className="text-xl font-bold text-[#2C2C2C] mb-8 tracking-tight flex items-center gap-3">
                      <Activity className="w-6 h-6 text-[#3B4638]" /> Topic Proficiency Breakdown
                    </h3>
                    <div className="space-y-5">
                      {Object.entries(currentAnalytics.topics).map(([topic, data]) => {
                        const percentage = Math.round((data.correct / data.total) * 100);
                        return (
                          <div key={topic} className="bg-[#FDFBF7] p-6 rounded-2xl border border-[#EAE6DF]">
                            <div className="flex justify-between mb-4">
                              <span className="font-semibold text-[#2C2C2C]">{topic}</span>
                              <span className={`font-bold ${percentage >= 70 ? 'text-[#486D51]' : percentage >= 50 ? 'text-[#D99A29]' : 'text-[#D47A74]'}`}>{percentage}%</span>
                            </div>
                            <div className="w-full bg-[#EAE6DF] rounded-full h-2.5 overflow-hidden">
                              <div className={`h-full rounded-full transition-all duration-1000 ${percentage >= 70 ? 'bg-[#486D51]' : percentage >= 50 ? 'bg-[#D99A29]' : 'bg-[#D47A74]'}`} style={{ width: `${percentage}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button onClick={() => setStep('home')} className="py-5 bg-white hover:bg-[#FDFBF7] border border-[#EAE6DF] font-semibold rounded-[1.5rem] text-[#7D7873] transition-all">
                      Return to Dashboard
                    </button>
                    <button onClick={() => setStep('upload')} className="py-5 bg-[#3B4638] hover:bg-[#2C3529] text-white font-bold rounded-[1.5rem] transition-all shadow-md">
                      Start New Session
                    </button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
}