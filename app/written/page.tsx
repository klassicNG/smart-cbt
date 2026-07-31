"use client";
import { useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import Link from 'next/link';
import { FileText, UploadCloud, CheckCircle2, XCircle, BookOpen, Layers, PenTool, Camera, ImagePlus, Loader2, AlertTriangle, Home, Zap, Printer, Brain, X, Crosshair } from 'lucide-react';

type TheoryQuestion = {
  mainQuestion: string;
  subQuestions: string[];
};

export default function WrittenExam() {
  const [step, setStep] = useState<'setup' | 'exam' | 'grading' | 'results' | 'cram'>('setup');
  
  const [files, setFiles] = useState<File[]>([]);
  const [pqFiles, setPqFiles] = useState<File[]>([]);
  const [notes, setNotes] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  
  const [questions, setQuestions] = useState<TheoryQuestion[] | null>(null);
  const [cramSheet, setCramSheet] = useState<any | null>(null);
  
  const [activeAnalogy, setActiveAnalogy] = useState<{title: string, analogy: string} | null>(null);
  const [isTutoring, setIsTutoring] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'exam' | 'cram' | 'grading' | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [answerImages, setAnswerImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [gradingResult, setGradingResult] = useState<any | null>(null);
  
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const { getRootProps: getMainProps, getInputProps: getMainInputProps, isDragActive: isMainDrag } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt', '.md'] },
    onDrop: (acceptedFiles) => setFiles((prev) => [...prev, ...acceptedFiles]),
  });

  const { getRootProps: getPqProps, getInputProps: getPqInputProps, isDragActive: isPqDrag } = useDropzone({
    accept: { 'application/pdf': ['.pdf'], 'text/plain': ['.txt', '.md'] },
    onDrop: (acceptedFiles) => setPqFiles((prev) => [...prev, ...acceptedFiles]),
  });

  const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));
  const removePqFile = (idx: number) => setPqFiles(pqFiles.filter((_, i) => i !== idx));

  // --- GENERATE THEORY EXAM ---
  const handleGenerateQuestions = async () => {
    setLoading(true);
    setLoadingType('exam');
    setError(null);
    setStep('exam');
    
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      pqFiles.forEach((f) => formData.append('pqFiles', f));
      if (notes) formData.append('notes', notes);
      formData.append('questionCount', questionCount.toString());

      const res = await fetch('/api/generate-written', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate questions.");

      setQuestions(data.questions);
    } catch (err: any) {
      setError(err.message || "Failed to generate questions. Please try again.");
      setStep('setup');
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  // --- GENERATE CRAM SHEET ---
  const handleGenerateCramSheet = async () => {
    setLoading(true);
    setLoadingType('cram');
    setError(null);
    setStep('cram');
    
    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f));
      if (notes) formData.append('notes', notes);

      const res = await fetch('/api/generate-cram', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate cram sheet.");

      setCramSheet(data);
    } catch (err: any) {
      setError(err.message || "Failed to generate cram sheet. Please try again.");
      setStep('setup');
    } finally {
      setLoading(false);
      setLoadingType(null);
    }
  };

  // --- ANALOGY ENGINE (TUTOR ME) ---
  const handleTutorMe = async (concept: string) => {
    setIsTutoring(true);
    setActiveAnalogy(null);
    
    try {
      const res = await fetch('/api/generate-analogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error("Tutor failed.");
      
      setActiveAnalogy(data);
    } catch (err) {
      setActiveAnalogy({
        title: "Tactical Communications Outage",
        analogy: "The connection to the tutor engine was intercepted. Review your foundational notes and attempt reconnection shortly."
      });
    } finally {
      setIsTutoring(false);
    }
  };

  const handleImageSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      setAnswerImages((prev) => [...prev, ...selectedFiles]);
      selectedFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => setImagePreviews((prev) => [...prev, reader.result as string]);
        reader.readAsDataURL(file);
      });
      setError(null);
    }
    e.target.value = '';
  };

  const removeImage = (idx: number) => {
    setAnswerImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const submitForGrading = async () => {
    if (answerImages.length === 0) return;
    setStep('grading');
    setLoadingType('grading');
    setError(null);
    
    try {
      const formData = new FormData();
      answerImages.forEach((img) => formData.append('images', img));
      formData.append('questions', JSON.stringify(questions));
      files.forEach((f) => formData.append('files', f));
      if (notes) formData.append('notes', notes);

      const res = await fetch('/api/grade-written', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to process grading request.");
      if (data.status === "REJECTED") {
        setError(`INVALID_IMAGE: ${data.reason}`);
        setStep('exam');
        return;
      }

      setGradingResult(data);
      setStep('results');
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred during grading.");
      setStep('exam');
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="flex h-screen bg-[#FDFBF7] text-[#2C2C2C] font-sans selection:bg-[#3B4638] selection:text-white overflow-hidden relative">
      
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
            <Link href="/" className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all bg-transparent text-[#7D7873] hover:bg-white hover:shadow-sm">
              <Home className="w-4 h-4" /> Overview
            </Link>
            <Link href="/" className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all bg-transparent text-[#7D7873] hover:bg-white hover:shadow-sm">
              <Layers className="w-4 h-4" /> E-Exam Simulator
            </Link>
            <button className="w-full flex items-center gap-3 px-5 py-4 rounded-2xl font-medium text-sm transition-all bg-white text-[#3B4638] shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-[#F3EFEA]">
              <PenTool className="w-4 h-4" /> Written Exam Grader
            </button>
          </nav>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-10 relative z-10 scroll-smooth">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {step === 'setup' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <header className="mb-6">
                <h1 className="text-3xl font-bold tracking-tight">Theory Engine Setup</h1>
                <p className="text-sm text-[#7D7873] font-medium mt-1">Upload course materials and calibrate the engine with Past Questions.</p>
              </header>
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div {...getMainProps()} className={`border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 h-[200px] ${isMainDrag ? 'border-[#3B4638] bg-[#F6F7F6]' : 'border-[#EAE6DF] bg-white hover:bg-[#FDFBF7]'}`}>
                    <input {...getMainInputProps()} />
                    <UploadCloud className="w-10 h-10 text-[#3B4638] mb-3" />
                    <h3 className="font-semibold">Drop Core Material</h3>
                    <p className="text-xs text-[#7D7873] mt-1 font-medium">PDFs, TXT, or MD</p>
                  </div>
                  
                  {/* PAST QUESTION DROPZONE */}
                  <div {...getPqProps()} className={`border-2 border-dashed rounded-[1.5rem] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 ${isPqDrag ? 'border-[#3B4638] bg-[#EAE6DF]' : 'border-[#EAE6DF] bg-[#F6F7F6] hover:bg-[#F3EFEA]'}`}>
                    <input {...getPqInputProps()} />
                    <Crosshair className="w-6 h-6 text-[#7D7873] mb-2" />
                    <h3 className="font-semibold text-sm text-[#7D7873]">Calibration: Past Questions</h3>
                    <p className="text-xs text-[#A39D98] mt-1">Optional style matching</p>
                  </div>
                </div>
                
                <div className="bg-white border border-[#F3EFEA] rounded-[2rem] p-8 flex flex-col shadow-[0_4px_20px_rgb(0,0,0,0.02)] h-full">
                  <label className="text-xs font-semibold text-[#7D7873] uppercase tracking-wider mb-3">Or Paste Notes</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Paste excerpts here..." className="w-full flex-1 bg-[#F6F7F6] border-none rounded-2xl p-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B4638]/20 resize-none placeholder:text-[#A39D98]" />
                </div>
                
                {(files.length > 0 || pqFiles.length > 0) && (
                  <div className="md:col-span-2 flex flex-wrap gap-3">
                    {files.map((file, idx) => (
                      <div key={`file-${idx}`} className="flex items-center gap-2 px-5 py-3 bg-white border border-[#EAE6DF] rounded-2xl text-sm font-medium text-[#3B4638] shadow-sm">
                        <FileText className="w-4 h-4" /> {file.name}
                        <button onClick={() => removeFile(idx)} className="ml-2 text-[#A39D98] hover:text-[#D47A74] transition-colors"><XCircle className="w-4 h-4" /></button>
                      </div>
                    ))}
                    {pqFiles.map((file, idx) => (
                      <div key={`pq-${idx}`} className="flex items-center gap-2 px-5 py-3 bg-[#F6F7F6] border border-[#EAE6DF] rounded-2xl text-sm font-medium text-[#7D7873] shadow-sm">
                        <Crosshair className="w-4 h-4" /> [PQ] {file.name}
                        <button onClick={() => removePqFile(idx)} className="ml-2 text-[#A39D98] hover:text-[#D47A74] transition-colors"><XCircle className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-[2rem] p-8 border border-[#F3EFEA] shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">Question Count (For Exam)</h3>
                  <p className="text-sm text-[#7D7873]">How many theory questions should be generated?</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-mono font-bold text-xl">{questionCount}</span>
                  <input type="range" min="1" max="10" value={questionCount} onChange={(e) => setQuestionCount(parseInt(e.target.value))} className="w-32 accent-[#3B4638]" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={handleGenerateCramSheet} disabled={files.length === 0 && !notes.trim()} className="w-full py-5 bg-white border border-[#EAE6DF] hover:bg-[#FDFBF7] font-bold rounded-[1.5rem] text-[#3B4638] transition-all shadow-sm disabled:opacity-50 flex items-center justify-center gap-2">
                  <Zap className="w-5 h-5 text-[#D99A29]" /> Generate Cram Sheet
                </button>
                <button onClick={handleGenerateQuestions} disabled={files.length === 0 && !notes.trim()} className="w-full py-5 bg-[#3B4638] hover:bg-[#2C3529] font-bold rounded-[1.5rem] text-white transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2">
                  <PenTool className="w-5 h-5" /> Generate Mock Exam
                </button>
              </div>
            </div>
          )}

          {loading && loadingType && (
            <div className="flex flex-col items-center justify-center h-[60vh] animate-in zoom-in-95 duration-500">
              <div className="w-24 h-24 bg-white rounded-full shadow-lg flex items-center justify-center mb-6 relative">
                <div className="absolute inset-0 border-4 border-[#F3EFEA] rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#3B4638] border-t-transparent rounded-full animate-spin"></div>
                {loadingType === 'cram' ? <Zap className="w-8 h-8 text-[#D99A29]" /> : <PenTool className="w-8 h-8 text-[#3B4638]" />}
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {loadingType === 'cram' ? 'Forging Survival Guide...' : loadingType === 'exam' ? 'Calibrating Theory Paper...' : 'AI Examiner is grading...'}
              </h2>
              <p className="text-[#7D7873] mt-2">
                {loadingType === 'cram' ? 'Extracting high-yield concepts and definitions.' : 'Running neural analysis on course materials and past questions.'}
              </p>
            </div>
          )}

          {step === 'cram' && cramSheet && !loading && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <header className="mb-8 border-b border-[#F3EFEA] pb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                    <Zap className="w-8 h-8 text-[#D99A29]" /> {cramSheet.title}
                  </h1>
                  <p className="text-sm text-[#7D7873] font-medium mt-2">Your last-minute survival guide. Scan and deploy.</p>
                </div>
                <button onClick={() => window.print()} className="px-5 py-3 bg-white border border-[#EAE6DF] rounded-xl hover:bg-[#F3EFEA] transition-all flex items-center gap-2 text-[#3B4638] font-semibold text-sm shadow-sm">
                  <Printer className="w-4 h-4" /> Print Sheet
                </button>
              </header>

              <div className="space-y-6">
                {cramSheet.modules.map((mod: any, mIdx: number) => (
                  <div key={mIdx} className="bg-white border border-[#F3EFEA] rounded-[2rem] p-8 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                    <h3 className="font-bold text-xl text-[#3B4638] mb-6 border-b border-[#EAE6DF] pb-4">{mod.category}</h3>
                    <ul className="space-y-5">
                      {mod.points.map((pt: any, pIdx: number) => (
                        <li key={pIdx} className="flex gap-4">
                          <div className="mt-1 flex-shrink-0 w-2 h-2 rounded-full bg-[#D99A29]" />
                          <p className="text-[#2C2C2C] leading-relaxed">
                            <strong className="text-[#3B4638] font-bold mr-2">{pt.term}:</strong>
                            {pt.detail}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('setup')} className="w-full py-5 bg-white border border-[#EAE6DF] hover:bg-[#FDFBF7] font-bold rounded-[1.5rem] text-[#7D7873] transition-all mt-8">
                Back to Setup
              </button>
            </div>
          )}

          {step === 'exam' && !loading && (
            <div className="space-y-6 animate-in fade-in duration-700">
              <header className="mb-8 border-b border-[#F3EFEA] pb-6 flex justify-between items-end">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Written Examination</h1>
                  <p className="text-sm text-[#7D7873] font-medium mt-2">Write your answers clearly on a physical sheet of paper.</p>
                </div>
              </header>

              <div className="space-y-6 mb-10">
                {questions?.map((q, idx) => (
                  <div key={idx} className="bg-white border border-[#F3EFEA] rounded-[2rem] p-8 shadow-sm flex gap-4">
                    <span className="font-bold text-[#3B4638] text-xl">Q{idx + 1}.</span>
                    <div className="w-full">
                      <p className="font-bold text-[#2C2C2C] leading-relaxed mb-5 border-b border-[#EAE6DF] pb-4">
                        {q.mainQuestion}
                      </p>
                      <div className="space-y-4">
                        {q.subQuestions.map((subQ, subIdx) => {
                          const romanNumeral = ['i', 'ii', 'iii', 'iv', 'v'][subIdx] || subIdx + 1;
                          return (
                            <div key={subIdx} className="flex gap-4">
                              <span className="font-semibold text-[#7D7873] mt-0.5">({romanNumeral})</span>
                              <p className="font-medium text-[#2C2C2C] leading-relaxed">{subQ}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#F6F7F6] rounded-[2rem] p-10 border border-[#EAE6DF] text-center">
                <h3 className="font-bold text-xl mb-2">Ready for Grading?</h3>
                <p className="text-[#7D7873] text-sm mb-8">Snap clear photos of your handwritten answers or upload from your gallery.</p>
                
                {error && (
                  <div className="mb-6 p-4 bg-[#FDF5F5] border border-[#F7DCDA] rounded-2xl flex items-center justify-center gap-3 text-[#D47A74]">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-semibold text-sm">{error}</span>
                  </div>
                )}

                <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleImageSelection} className="hidden" />
                <input type="file" accept="image/*" multiple ref={galleryInputRef} onChange={handleImageSelection} className="hidden" />

                {imagePreviews.length === 0 ? (
                  <div className="flex justify-center gap-4">
                    <button onClick={() => cameraInputRef.current?.click()} className="px-8 py-4 bg-white text-[#3B4638] font-bold rounded-2xl hover:bg-[#F3EFEA] transition-all shadow-sm border border-[#EAE6DF] flex items-center gap-2">
                      <Camera className="w-5 h-5" /> Open Camera
                    </button>
                    <button onClick={() => galleryInputRef.current?.click()} className="px-8 py-4 bg-[#3B4638] text-white font-bold rounded-2xl hover:bg-[#2C3529] transition-all shadow-md flex items-center gap-2">
                      <ImagePlus className="w-5 h-5" /> Choose from Gallery
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="flex flex-wrap justify-center gap-4">
                      {imagePreviews.map((src, idx) => (
                        <div key={idx} className="relative">
                          <img src={src} alt={`Answer Page ${idx + 1}`} className="h-48 w-auto rounded-xl border-4 border-white shadow-md object-cover" />
                          <button onClick={() => removeImage(idx)} className="absolute -top-3 -right-3 bg-white text-[#D47A74] rounded-full p-1 shadow-md hover:bg-[#FDF5F5] border border-[#EAE6DF]">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-4 mt-6">
                      <button onClick={() => galleryInputRef.current?.click()} className="px-6 py-3 bg-white text-[#7D7873] font-semibold rounded-xl hover:bg-[#F3EFEA] border border-[#EAE6DF] flex items-center gap-2">
                        <ImagePlus className="w-4 h-4" /> Add Another Page
                      </button>
                      <button onClick={submitForGrading} className="px-6 py-3 bg-[#3B4638] text-white font-bold rounded-xl hover:bg-[#2C3529] shadow-md">
                        Submit {answerImages.length} {answerImages.length > 1 ? 'Pages' : 'Page'} for AI Grading
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 'results' && gradingResult && !loading && (
            <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-700">
               <div className="bg-[#3B4638] rounded-[2.5rem] p-14 text-center shadow-lg">
                <h2 className="text-6xl font-bold text-white mb-2 tracking-tight">
                  {gradingResult.totalScore}<span className="text-3xl text-[#A7B3A4]">/60</span>
                </h2>
                <p className="text-[#A7B3A4] text-lg font-medium mt-2">Overall Theory Score</p>
              </div>

              <div className="space-y-6">
                <h3 className="font-bold text-2xl px-2">Granular Feedback</h3>
                {gradingResult.feedback.map((item: any, idx: number) => (
                  <div key={idx} className="bg-white p-8 rounded-[2rem] border border-[#EAE6DF] shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
                    <div className="flex justify-between items-center mb-6 border-b border-[#F3EFEA] pb-4">
                      <span className="font-bold text-xl text-[#3B4638]">Question {item.questionNumber}</span>
                      <span className="font-bold text-[#7D7873] bg-[#F6F7F6] px-4 py-2 rounded-xl border border-[#EAE6DF]">{item.questionScore} / {item.questionMax} Marks</span>
                    </div>
                    <div className="space-y-4">
                      {item.subFeedback.map((sub: any, sIdx: number) => (
                        <div key={sIdx} className={`p-5 rounded-2xl border ${sub.status === 'correct' ? 'bg-[#EAF3EA] border-[#C5E0CC]' : sub.status === 'partial' ? 'bg-[#FFF9EB] border-[#FDE68A]' : 'bg-[#FDF5F5] border-[#F7DCDA]'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {sub.status === 'correct' ? <CheckCircle2 className="w-5 h-5 text-[#486D51]" /> : sub.status === 'partial' ? <AlertTriangle className="w-5 h-5 text-[#D99A29]" /> : <XCircle className="w-5 h-5 text-[#D47A74]" />}
                              <span className="font-bold text-md text-[#2C2C2C]">Part ({sub.id})</span>
                            </div>
                          </div>
                          <p className="text-[#2C2C2C] font-medium text-sm leading-relaxed">{sub.comments}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-[#F6F7F6] p-8 rounded-[2rem] border border-[#EAE6DF]">
                  <h4 className="font-bold text-lg mb-4 text-[#3B4638]">Core Strengths</h4>
                  <ul className="space-y-2">
                    {gradingResult.strengths?.map((str: string, i: number) => <li key={i} className="flex gap-2 text-sm font-medium"><CheckCircle2 className="w-4 h-4 text-[#486D51] flex-shrink-0" /> {str}</li>)}
                  </ul>
                </div>
                <div className="bg-[#FDF5F5] p-8 rounded-[2rem] border border-[#F7DCDA]">
                  <h4 className="font-bold text-lg mb-4 text-[#8C3A35]">Areas to Review</h4>
                  <ul className="space-y-3">
                    {gradingResult.weaknesses?.map((wk: string, i: number) => (
                      <li key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-[#F7DCDA]">
                        <div className="flex gap-2 text-sm font-semibold text-[#8C3A35]"><AlertTriangle className="w-4 h-4 flex-shrink-0" /> {wk}</div>
                        <button onClick={() => handleTutorMe(wk)} className="px-3 py-1.5 bg-[#8C3A35] text-white text-xs font-bold rounded-lg hover:bg-[#6D2A26] transition-colors flex items-center gap-1 shadow-sm">
                          <Brain className="w-3 h-3" /> Tutor Me
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button onClick={() => { setStep('setup'); setImagePreviews([]); setAnswerImages([]); }} className="w-full py-5 bg-white hover:bg-[#FDFBF7] border border-[#EAE6DF] font-bold rounded-[1.5rem] text-[#7D7873] transition-all">
                Grade Another Paper
              </button>
            </div>
          )}
        </div>
      </main>

      {/* TUTOR MODAL OVERLAY */}
      {(isTutoring || activeAnalogy) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2rem] p-8 shadow-2xl relative">
            {isTutoring ? (
              <div className="flex flex-col items-center py-10">
                <Brain className="w-12 h-12 text-[#3B4638] animate-pulse mb-4" />
                <h3 className="text-xl font-bold text-[#3B4638]">Synthesizing Analogy...</h3>
                <p className="text-[#7D7873] text-sm text-center mt-2">Connecting theory to tactical real-world models.</p>
              </div>
            ) : activeAnalogy && (
              <div className="space-y-4">
                <button onClick={() => setActiveAnalogy(null)} className="absolute top-6 right-6 text-[#A39D98] hover:text-[#3B4638] transition-colors">
                  <X className="w-6 h-6" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-[#F6F7F6] rounded-xl border border-[#EAE6DF]">
                    <Brain className="w-6 h-6 text-[#3B4638]" />
                  </div>
                  <h3 className="text-xl font-bold text-[#2C2C2C] leading-tight">{activeAnalogy.title}</h3>
                </div>
                <div className="bg-[#FDFBF7] p-6 rounded-[1.5rem] border border-[#F3EFEA]">
                  <p className="text-[#2C2C2C] leading-relaxed font-medium">{activeAnalogy.analogy}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}