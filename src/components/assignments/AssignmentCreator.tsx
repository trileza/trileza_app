import React, { useState, useEffect } from 'react';
import { Card, Button } from '../ui';
import { PlusCircle, FileText, Video, ListChecks, Type, Send, Settings, X, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../../utils';
import { nexus } from '../../lib/nexus';

interface AssignmentCreatorProps {
  courseId: string;
  tutorId: string;
  showFeedback: (msg: string, type?: 'success' | 'info') => void;
}

const AssignmentCreator = ({ courseId, tutorId, showFeedback }: AssignmentCreatorProps) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [taskType, setTaskType] = useState<'multichoice' | 'blanks' | 'written' | 'video'>('multichoice');

  // Form State
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [points, setPoints] = useState<number>(100);

  // Task-specific configurations
  const [questions, setQuestions] = useState<Array<{ questionText: string; options: string[]; correctOptionIndex: number }>>([
    { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }
  ]);
  const [textWithBlanks, setTextWithBlanks] = useState('');
  const [writtenPrompt, setWrittenPrompt] = useState('');
  const [requireFile, setRequireFile] = useState(false);
  const [videoPrompt, setVideoPrompt] = useState('');

  // Async States
  const [saving, setSaving] = useState(false);
  const [existingAssignments, setExistingAssignments] = useState<any[]>([]);
  const [loadingExisting, setLoadingExisting] = useState(false);

  const fetchExistingAssignments = async () => {
    if (!tutorId) return;
    setLoadingExisting(true);
    try {
      const { data: profile, error } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', tutorId)
        .single();

      if (profile && !error) {
        setExistingAssignments(profile.metadata?.created_assignments || []);
      }
    } catch (e) {
      console.error('Error fetching existing assignments:', e);
    } finally {
      setLoadingExisting(false);
    }
  };

  useEffect(() => {
    if (tutorId) {
      fetchExistingAssignments();
    }
  }, [tutorId]);

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length === 1) return;
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionTextChange = (index: number, val: string) => {
    const updated = [...questions];
    updated[index].questionText = val;
    setQuestions(updated);
  };

  const handleOptionTextChange = (qIndex: number, optIndex: number, val: string) => {
    const updated = [...questions];
    updated[qIndex].options[optIndex] = val;
    setQuestions(updated);
  };

  const handleCorrectOptionChange = (qIndex: number, optIndex: number) => {
    const updated = [...questions];
    updated[qIndex].correctOptionIndex = optIndex;
    setQuestions(updated);
  };

  const handleAssign = async () => {
    if (!title.trim()) {
      alert('Please enter an assignment title');
      return;
    }
    if (!courseId) {
      alert('No course selected');
      return;
    }

    setSaving(true);
    try {
      const { data: profile } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', tutorId)
        .single();

      const metadata = profile?.metadata || {};
      const createdAssignments = metadata.created_assignments || [];

      const newAssignment = {
        assignmentId: 'asn_' + Math.random().toString(36).substr(2, 9),
        courseId,
        title,
        dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        points: Number(points) || 100,
        type: taskType,
        createdAt: new Date().toISOString(),
        details: {
          questions: taskType === 'multichoice' ? questions : null,
          textWithBlanks: taskType === 'blanks' ? textWithBlanks : null,
          writtenPrompt: taskType === 'written' ? writtenPrompt : null,
          requireFile: taskType === 'written' ? requireFile : false,
          videoPrompt: taskType === 'video' ? videoPrompt : null
        }
      };

      const updatedAssignments = [...createdAssignments, newAssignment];
      const updatedMetadata = {
        ...metadata,
        created_assignments: updatedAssignments
      };

      const { error } = await nexus.database
        .from('profiles')
        .update({ metadata: updatedMetadata })
        .eq('id', tutorId);

      if (error) throw error;

      showFeedback('Assignment dispatched successfully!');
      
      // Reset Form fields
      setTitle('');
      setDueDate('');
      setPoints(100);
      setQuestions([{ questionText: '', options: ['', '', '', ''], correctOptionIndex: 0 }]);
      setTextWithBlanks('');
      setWrittenPrompt('');
      setRequireFile(false);
      setVideoPrompt('');
      
      await fetchExistingAssignments();
    } catch (e: any) {
      console.error(e);
      alert('Failed to dispatch assignment: ' + (e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (asnId: string) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      const { data: profile } = await nexus.database
        .from('profiles')
        .select('metadata')
        .eq('id', tutorId)
        .single();

      const metadata = profile?.metadata || {};
      const createdAssignments = metadata.created_assignments || [];
      const updatedAssignments = createdAssignments.filter((a: any) => a.assignmentId !== asnId);

      const updatedMetadata = {
        ...metadata,
        created_assignments: updatedAssignments
      };

      const { error } = await nexus.database
        .from('profiles')
        .update({ metadata: updatedMetadata })
        .eq('id', tutorId);

      if (error) throw error;

      showFeedback('Assignment deleted successfully!');
      await fetchExistingAssignments();
    } catch (e: any) {
      console.error(e);
      alert('Failed to delete assignment: ' + (e.message || e));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <button 
          onClick={() => setActiveTab('create')}
          className={cn("font-bold pb-2 border-b-2 transition-all", activeTab === 'create' ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Create New Assignment
        </button>
        <button 
          onClick={() => setActiveTab('manage')}
          className={cn("font-bold pb-2 border-b-2 transition-all", activeTab === 'manage' ? "border-emerald-600 text-emerald-700 dark:text-emerald-400" : "border-transparent text-slate-500 hover:text-slate-700")}
        >
          Manage Existing
        </button>
      </div>

      {activeTab === 'create' && (
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2rem] bg-white dark:bg-slate-950">
          <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Standardized Test Creator</h3>
          
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
                    taskType === type.id 
                      ? "bg-emerald-50 dark:bg-emerald-950/20 border-2 border-emerald-500 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/20" 
                      : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 hover:bg-slate-50"
                  )}
                >
                  <type.icon size={20} className={taskType === type.id ? "text-emerald-600" : "text-slate-400"} />
                  {type.label}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assignment Title</label>
                  <input 
                    type="text" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" 
                    placeholder="e.g. Week 4: Advanced React Patterns" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Due Date</label>
                    <input 
                      type="date" 
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Total Points</label>
                    <input 
                      type="number" 
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value))}
                      className="w-full p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white" 
                      placeholder="100" 
                    />
                  </div>
                </div>
              </div>

              {taskType === 'multichoice' && (
                <div className="space-y-4">
                  {questions.map((q, qIndex) => (
                    <div key={qIndex} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative group">
                      {questions.length > 1 && (
                        <button 
                          onClick={() => removeQuestion(qIndex)}
                          className="absolute top-2 right-2 text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <X size={16}/>
                        </button>
                      )}
                      <input 
                        type="text" 
                        value={q.questionText}
                        onChange={(e) => handleQuestionTextChange(qIndex, e.target.value)}
                        className="w-full p-2 font-bold text-slate-800 dark:text-white bg-transparent border-b border-slate-100 dark:border-slate-800 outline-none mb-3" 
                        placeholder={`Question ${qIndex + 1} Text...`} 
                      />
                      <div className="space-y-2 pl-4">
                        {q.options.map((opt, optIndex) => (
                          <div key={optIndex} className="flex items-center gap-3">
                            <input 
                              type="radio" 
                              name={`correct-${qIndex}`} 
                              checked={q.correctOptionIndex === optIndex}
                              onChange={() => handleCorrectOptionChange(qIndex, optIndex)}
                              className="w-4 h-4 text-emerald-600 focus:ring-emerald-500" 
                            />
                            <input 
                              type="text" 
                              value={opt}
                              onChange={(e) => handleOptionTextChange(qIndex, optIndex, e.target.value)}
                              className="flex-1 p-2 text-sm bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800 outline-none focus:border-emerald-300 text-slate-800 dark:text-white" 
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`} 
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button 
                    variant="outline" 
                    onClick={addQuestion}
                    className="w-full border-dashed border-slate-300 dark:border-slate-800 text-slate-500 font-bold bg-white dark:bg-slate-900 hover:border-emerald-400 hover:text-emerald-600"
                  >
                    <PlusCircle size={16} className="mr-2"/> Add Question
                  </Button>
                </div>
              )}

              {taskType === 'blanks' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Text with Blanks</label>
                    <p className="text-xs text-slate-500 mb-2">Use square brackets for blanks. Example: The capital of France is [Paris].</p>
                    <textarea 
                      value={textWithBlanks}
                      onChange={(e) => setTextWithBlanks(e.target.value)}
                      className="w-full h-32 p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-400 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                      placeholder="Enter text here..." 
                    />
                  </div>
                </div>
              )}

              {taskType === 'written' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Task Prompt / Instructions</label>
                    <textarea 
                      value={writtenPrompt}
                      onChange={(e) => setWrittenPrompt(e.target.value)}
                      className="w-full h-40 p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-400 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                      placeholder="Describe the essay or code task..." 
                    />
                    <div className="mt-4 flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="require-file" 
                        checked={requireFile}
                        onChange={(e) => setRequireFile(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500" 
                      />
                      <label htmlFor="require-file" className="text-sm font-bold text-slate-700 dark:text-slate-300">Require File Upload (PDF, ZIP)</label>
                    </div>
                  </div>
                </div>
              )}

              {taskType === 'video' && (
                <div className="space-y-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Video size={24} className="text-emerald-600" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white mb-2">Record Prompt Video</h4>
                    <p className="text-sm text-slate-500 mb-6">Explain the assignment directly to your students via webcam.</p>
                    <Button className="bg-slate-900 text-white font-bold px-8 hover:bg-slate-800"><Video size={16} className="mr-2"/> Start Recording</Button>
                    <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-left">
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Additional Video URL / Notes</label>
                      <textarea 
                        value={videoPrompt}
                        onChange={(e) => setVideoPrompt(e.target.value)}
                        className="w-full h-24 p-3 text-sm rounded-lg border border-slate-200 dark:border-slate-800 outline-none focus:border-emerald-400 resize-none bg-white dark:bg-slate-900 text-slate-900 dark:text-white" 
                        placeholder="Paste video link or explain requirements..." 
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end gap-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <Button 
                  onClick={handleAssign}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 shadow-lg shadow-emerald-600/30 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" /> Dispatching...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Assign Test
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'manage' && (
        <Card className="p-8 border-none shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 rounded-[2.5rem] bg-white dark:bg-slate-950">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">Active Assignments</h3>
          </div>
          
          {loadingExisting ? (
            <div className="text-center py-8 text-slate-500 font-medium">Loading assignments...</div>
          ) : existingAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-500 font-medium">No active assignments created.</div>
          ) : (
            <div className="space-y-4">
              {existingAssignments.map((asn) => (
                <div key={asn.assignmentId} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-white dark:hover:bg-slate-900 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      {asn.type === 'multichoice' ? <ListChecks size={20} /> : asn.type === 'written' ? <FileText size={20} /> : <Video size={20} />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{asn.title}</h4>
                      <p className="text-xs font-medium text-slate-500 mt-1">Due {asn.dueDate} • {asn.points} Points</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleDeleteAssignment(asn.assignmentId)}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl transition-colors"
                      title="Delete Assignment"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
};

export default AssignmentCreator;
