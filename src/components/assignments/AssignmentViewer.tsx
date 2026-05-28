import React, { useState } from 'react';
import { Card, Button } from '../ui';
import { ListChecks, FileText, Video, Upload, CheckCircle2, AlertCircle, PlayCircle } from 'lucide-react';
import { cn } from '../../utils';

const AssignmentViewer = ({ showFeedback }: any) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const pendingAssignments = [
    { id: 1, title: 'Advanced React Patterns Quiz', type: 'multichoice', icon: ListChecks, due: '2 Days', points: 100 },
    { id: 2, title: 'Architecture Review Essay', type: 'written', icon: FileText, due: '4 Days', points: 150 },
    { id: 3, title: 'Algorithm Explanation', type: 'video', icon: Video, due: '1 Week', points: 200 },
  ];

  const completedAssignments = [
    { id: 4, title: 'Basic Hooks Quiz', type: 'multichoice', icon: ListChecks, score: '95/100', grade: 'A' },
    { id: 5, title: 'Component Lifecycle', type: 'blanks', icon: FileText, score: '88/100', grade: 'B+' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveTab('pending')}
          className={cn("font-bold pb-2 border-b-2 transition-all flex items-center gap-2", activeTab === 'pending' ? "border-amber-500 text-amber-600" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <AlertCircle size={16} /> Pending Tasks
        </button>
        <button 
          onClick={() => setActiveTab('completed')}
          className={cn("font-bold pb-2 border-b-2 transition-all flex items-center gap-2", activeTab === 'completed' ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          <CheckCircle2 size={16} /> Completed
        </button>
      </div>

      {activeTab === 'pending' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingAssignments.map(task => (
            <Card key={task.id} className="p-6 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white flex flex-col h-full group hover:shadow-2xl transition-all">
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <task.icon size={24} className="text-slate-700" />
              </div>
              <h4 className="font-black text-xl text-slate-900 mb-2 leading-tight">{task.title}</h4>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-500 mb-8 uppercase tracking-wider">
                <span className="text-amber-500">Due in {task.due}</span>
                <span>•</span>
                <span>{task.points} Pts</span>
              </div>
              <div className="mt-auto">
                {task.type === 'multichoice' && (
                  <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl" onClick={() => showFeedback('Opening secure testing environment...')}>
                    <PlayCircle size={16} className="mr-2" /> Start Quiz
                  </Button>
                )}
                {task.type === 'written' && (
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl" onClick={() => showFeedback('Opening text editor...')}>
                    <FileText size={16} className="mr-2" /> Open Editor
                  </Button>
                )}
                {task.type === 'video' && (
                  <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl" onClick={() => showFeedback('Launching camera...')}>
                    <Video size={16} className="mr-2" /> Record Response
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === 'completed' && (
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white">
          <h3 className="text-2xl font-black text-slate-900 mb-6 flex items-center gap-2">
            <CheckCircle2 className="text-emerald-500" /> Graded Assignments
          </h3>
          <div className="space-y-4">
            {completedAssignments.map(task => (
              <div key={task.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white border border-emerald-100 flex items-center justify-center">
                    <task.icon size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{task.title}</h4>
                    <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">Completed • Fully Graded</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="font-black text-2xl text-emerald-600">{task.grade}</p>
                    <p className="text-xs font-bold text-slate-500">{task.score}</p>
                  </div>
                  <Button variant="outline" className="border-emerald-200 text-emerald-700 font-bold bg-white" onClick={() => showFeedback('Viewing feedback...')}>View Feedback</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AssignmentViewer;
