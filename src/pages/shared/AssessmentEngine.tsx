import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Timer, 
  ChevronRight, 
  ChevronLeft, 
  AlertCircle,
  FileUp,
  BrainCircuit,
  Award
} from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { cn } from '../../utils';

interface Question {
  id: string;
  type: 'multiple-choice' | 'practical' | 'branching';
  text: string;
  options?: { id: string; text: string; nextId?: string }[];
  timeLimit?: number; // in seconds
}

const AssessmentEngine = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes
  const [isFinished, setIsFinished] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const quizData: Question[] = [
    {
      id: 'q1',
      type: 'multiple-choice',
      text: 'What is the primary purpose of the "Z-Pattern" in layout design?',
      options: [
        { id: 'a', text: 'To maximize whitespace in mobile apps.' },
        { id: 'b', text: 'To follow the natural eye path of Western readers on less text-heavy pages.' },
        { id: 'c', text: 'To ensure accessibility compliance.' },
        { id: 'd', text: 'To reduce the DOM size of the application.' },
      ]
    },
    {
      id: 'branch_1',
      type: 'branching',
      text: 'Did you find the previous section about Hierarchy easy or difficult?',
      options: [
        { id: 'easy', text: 'It was very straightforward.', nextId: 'hard_path' },
        { id: 'hard', text: 'I struggled with some concepts.', nextId: 'remedial_path' },
      ]
    },
    {
      id: 'q3',
      type: 'practical',
      text: 'Upload a screenshot of your prototype showing proper use of contrast ratios.',
    }
  ];

  useEffect(() => {
    if (timeLeft > 0 && !isFinished) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0) {
      setIsFinished(true);
    }
  }, [timeLeft, isFinished]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const handleNext = () => {
    if (currentStep < quizData.length - 1) {
      setCurrentStep(prev => prev + 1);
      setSelectedOption(null);
    } else {
      setIsFinished(true);
    }
  };

  if (isFinished) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center animate-in fade-in zoom-in duration-500">
        <div className="w-24 h-24 bg-brand-mint/10 text-brand-mint rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-brand-mint/20">
          <Award size={48} />
        </div>
        <h2 className="text-4xl font-bold mb-4">Assessment Complete!</h2>
        <p className="text-slate-500 text-lg mb-8 uppercase tracking-widest font-semibold italic">Trileza Certification Score: 92/100</p>
        <Card className="bg-brand-indigo text-white border-none p-8 mb-8">
          <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest mb-2">Performance Breakdown</p>
          <div className="flex justify-around items-center">
            <div>
              <p className="text-3xl font-bold">14/15</p>
              <p className="text-xs text-indigo-300">Correct</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-3xl font-bold">08:42</p>
              <p className="text-xs text-indigo-300">Time Taken</p>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <p className="text-3xl font-bold">Top 5%</p>
              <p className="text-xs text-indigo-300">Global Rank</p>
            </div>
          </div>
        </Card>
        <div className="flex flex-col gap-3">
          <Button className="w-full py-4 text-lg bg-brand-indigo">Download PDF Certificate</Button>
          <Button variant="ghost" onClick={() => navigate('/')} className="w-full py-4 text-slate-500 font-bold">Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const question = quizData[currentStep];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-indigo/10 text-brand-indigo rounded-2xl">
            <BrainCircuit size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Final Competency Test</h1>
            <p className="text-sm text-slate-500">Module 01: Product Strategy</p>
          </div>
        </div>
        
        <Card className="py-2.5 px-6 border-brand-indigo/20 flex items-center gap-3">
          <Timer className={cn("text-brand-indigo", timeLeft < 60 && "text-red-500 animate-pulse")} size={20} />
          <span className={cn("text-xl font-bold tabular-nums", timeLeft < 60 && "text-red-500")}>
            {formatTime(timeLeft)}
          </span>
        </Card>
      </div>

      {/* Progress Bar */}
      <div className="flex gap-2 mb-10">
        {quizData.map((_, idx) => (
          <div 
            key={idx}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-all duration-500",
              idx <= currentStep ? "bg-brand-indigo" : "bg-slate-100 dark:bg-slate-800"
            )}
          />
        ))}
      </div>

      <Card className="p-10 shadow-2xl shadow-brand-indigo/5 border-slate-100 dark:border-slate-800">
        <div className="mb-8">
          <span className="text-xs font-bold text-brand-indigo uppercase tracking-[0.2em]">Question {currentStep + 1} of {quizData.length}</span>
          <h2 className="text-2xl font-bold mt-4 leading-snug">{question.text}</h2>
        </div>

        {question.type === 'multiple-choice' || question.type === 'branching' ? (
          <div className="grid gap-4">
            {question.options?.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSelectedOption(opt.id)}
                className={cn(
                  "flex items-center justify-between p-6 rounded-2xl border-2 transition-all text-left group",
                  selectedOption === opt.id 
                    ? "bg-brand-indigo/5 border-brand-indigo ring-4 ring-brand-indigo/5" 
                    : "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-brand-indigo/50"
                )}
              >
                <span className="font-semibold text-slate-700 dark:text-slate-200">{opt.text}</span>
                <div className={cn(
                  "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all",
                  selectedOption === opt.id ? "bg-brand-indigo border-brand-indigo" : "border-slate-200"
                )}>
                  {selectedOption === opt.id && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-full aspect-video border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 bg-slate-50/50 hover:bg-slate-50 transition-colors cursor-pointer group">
              <div className="p-4 bg-white rounded-full shadow-lg group-hover:scale-110 transition-transform">
                <FileUp className="text-brand-indigo" size={32} />
              </div>
              <div className="text-center">
                <p className="font-bold">Drop your file here or click to browse</p>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Support: Figma, PDF, PNG (Max 50MB)</p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-10 flex justify-between items-center">
          <Button 
            variant="ghost" 
            className="gap-2"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep(prev => prev - 1)}
          >
            <ChevronLeft size={18} /> Previous
          </Button>
          <Button 
            className="gap-2 px-10 h-14 text-lg rounded-2xl shadow-xl shadow-brand-indigo/20"
            disabled={!selectedOption && question.type !== 'practical'}
            onClick={handleNext}
          >
            {currentStep === quizData.length - 1 ? 'Finish Assessment' : 'Next Question'} <ChevronRight size={18} />
          </Button>
        </div>
      </Card>

      <div className="mt-8 flex items-center gap-3 justify-center text-slate-400">
        <AlertCircle size={14} />
        <span className="text-[10px] font-bold uppercase tracking-wider">Navigating away from this tab will auto-submit the assessment.</span>
      </div>
    </div>
  );
};

export default AssessmentEngine;
