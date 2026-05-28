import React, { useState } from 'react';
import { Card, Button } from '../ui';
import { PlusCircle, FileText, Video, ListChecks, Type, Send, Settings, X } from 'lucide-react';
import { cn } from '../../utils';

const AssignmentCreator = ({ showFeedback }: any) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [taskType, setTaskType] = useState<'multichoice' | 'blanks' | 'written' | 'video'>('multichoice');

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 pb-4">
        <button 
          onClick={() => setActiveTab('create')}
          className={cn("font-bold pb-2 border-b-2 transition-all", activeTab === 'create' ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Create New Assignment
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          className={cn("font-bold pb-2 border-b-2 transition-all", activeTab === 'manage' ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Manage Existing
        </button>
      </div>

      {activeTab === 'create' && (
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white">
          <h3 className="text-2xl font-black text-slate-900 mb-6">Standardized Test Creator</h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2 mb-4">Select Format</p>
              
              {[
                { id: 'multichoice', label: 'Multiple Choice', icon: ListChecks },
                { id: 'blanks', label: 'Fill in Blanks', icon: Type },
                { id: 'written', label: 'Written Task', icon: FileText },
                { id: 'video', label: 'Video Explanation', icon: Video },
              ].map((type) => (
                <button 
                  key={type.id}
                  onClick={() => setTaskType(type.id as any)}
                  className={cn(
                    "w-full text-left px-5 py-4 rounded-2xl font-bold flex items-center gap-3 transition-all",
                    taskType === type.id ? "bg-emerald-50 border-2 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-500/20" : "bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:bg-slate-50"
                  )}
                >
                  <type.icon size={20} className={taskType === type.id ? "text-emerald-600" : "text-slate-400"} />
                  {type.label}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Assignment Title</label>
                  <input type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="e.g. Week 4: Advanced React Patterns" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Due Date</label>
                    <input type="date" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Total Points</label>
                    <input type="number" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500" placeholder="100" defaultValue="100" />
                  </div>
                </div>
              </div>

              {taskType === 'multichoice' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 relative group">
                    <button className="absolute top-2 right-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16}/></button>
                    <input type="text" className="w-full p-2 font-bold text-slate-800 border-b border-slate-100 outline-none mb-3" placeholder="Question Text..." />
                    <div className="space-y-2 pl-4">
                      {['Option A', 'Option B', 'Option C', 'Option D'].map((opt, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <input type="radio" name="correct-1" className="w-4 h-4 text-emerald-600" />
                          <input type="text" className="flex-1 p-2 text-sm bg-slate-50 rounded border border-slate-100 outline-none focus:border-emerald-300" placeholder={opt} />
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full border-dashed border-slate-300 text-slate-500 font-bold bg-white hover:border-emerald-400 hover:text-emerald-600"><PlusCircle size={16} className="mr-2"/> Add Question</Button>
                </div>
              )}

              {taskType === 'blanks' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Text with Blanks</label>
                    <p className="text-xs text-slate-500 mb-2">Use square brackets for blanks. Example: The capital of France is [Paris].</p>
                    <textarea className="w-full h-32 p-3 text-sm rounded-lg border border-slate-200 outline-none focus:border-emerald-400 resize-none" placeholder="Enter text here..." />
                  </div>
                </div>
              )}

              {taskType === 'written' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <label className="block text-sm font-bold text-slate-700 mb-2">Task Prompt / Instructions</label>
                    <textarea className="w-full h-40 p-3 text-sm rounded-lg border border-slate-200 outline-none focus:border-emerald-400 resize-none" placeholder="Describe the essay or code task..." />
                    <div className="mt-4 flex items-center gap-2">
                      <input type="checkbox" id="require-file" className="w-4 h-4 text-emerald-600" />
                      <label htmlFor="require-file" className="text-sm font-bold text-slate-700">Require File Upload (PDF, ZIP)</label>
                    </div>
                  </div>
                </div>
              )}

              {taskType === 'video' && (
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-center">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Video size={24} className="text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-800 mb-2">Record Prompt Video</h4>
                    <p className="text-sm text-slate-500 mb-6">Explain the assignment directly to your students via webcam.</p>
                    <Button className="bg-slate-900 text-white font-bold px-8 hover:bg-slate-800"><Video size={16} className="mr-2"/> Start Recording</Button>
                    <div className="mt-6 pt-6 border-t border-slate-100 text-left">
                      <label className="block text-sm font-bold text-slate-700 mb-2">Additional Text Instructions</label>
                      <textarea className="w-full h-24 p-3 text-sm rounded-lg border border-slate-200 outline-none focus:border-emerald-400 resize-none" placeholder="Optional notes..." />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-slate-200">
                <Button variant="ghost" className="font-bold text-slate-500 hover:text-slate-700">Save as Draft</Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-600/30" onClick={() => showFeedback('Assignment dispatched successfully!')}>
                  <Send size={16} className="mr-2" /> Assign Test
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'manage' && (
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 rounded-[2rem] bg-white">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900">Active Assignments</h3>
            <Button variant="outline" className="border-slate-200 text-slate-600 font-bold"><Settings size={16} className="mr-2"/> Bulk Actions</Button>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:border-emerald-200 hover:bg-white transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    {i === 1 ? <ListChecks size={20} /> : i === 2 ? <FileText size={20} /> : <Video size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">Week {i} Mastery Check</h4>
                    <p className="text-xs font-medium text-slate-500 mt-1">Due in {i * 2} days • {10 + i * 5} Submissions</p>
                  </div>
                </div>
                <Button className="bg-slate-900 text-white text-xs font-bold px-4 hover:bg-emerald-600">Grade Submissions</Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

export default AssignmentCreator;
