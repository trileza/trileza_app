import React from 'react';
import { Card, Button } from '../../components/ui';
import { 
  Search, 
  Filter, 
  ArrowUpRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  MoreVertical,
  BookOpen,
  Users,
  ChevronRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../../utils';
import { motion } from 'framer-motion';


const StudentAudit = () => {
  const [selectedCourse, setSelectedCourse] = React.useState<string | null>(null);
  
  const students = [
    { id: 1, name: 'Sarah Jenkins', course: 'UI Design Mastery', progress: 85, lastActive: '2h ago', status: 'On Track', enrolled: '2,400' },
    { id: 2, name: 'Michael Obi', course: 'Advanced Agentic Coding', progress: 42, lastActive: '5h ago', status: 'Falling Behind', enrolled: '850' },
    { id: 3, name: 'Aisha Yusuf', course: 'UX Case Study', progress: 100, lastActive: '1d ago', status: 'Completed', enrolled: '1,200' },
    { id: 4, name: 'David Chen', course: 'UI Design Mastery', progress: 12, lastActive: '3d ago', status: 'At Risk', enrolled: '2,400' },
    { id: 5, name: 'Elena Rodriguez', course: 'Advanced Agentic Coding', progress: 67, lastActive: '12m ago', status: 'On Track', enrolled: '850' },
    { id: 6, name: 'Bisi Adeleye', course: 'UX Case Study', progress: 88, lastActive: '1h ago', status: 'On Track', enrolled: '1,200' },
  ];

  const courses = Array.from(new Set(students.map(s => s.course)));
  const filteredStudents = students.filter(s => s.course === selectedCourse);

  const avgProgress = selectedCourse ? Math.round(filteredStudents.reduce((acc, s) => acc + s.progress, 0) / filteredStudents.length) || 0 : 0;
  const atRiskCount = selectedCourse ? filteredStudents.filter(s => s.progress < 30).length : 0;
  const completionRate = selectedCourse ? Math.round((filteredStudents.filter(s => s.status === 'Completed').length / filteredStudents.length) * 100) || 0 : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Global Premium Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-slate-950 p-8 md:p-12 rounded-[2.5rem] text-white shadow-2xl shadow-emerald-900/20 relative overflow-hidden mb-8">
        <div className="absolute -top-32 -left-32 w-80 h-80 bg-emerald-500 rounded-full blur-[100px] opacity-30 animate-pulse" />
        <div className="absolute right-0 bottom-0 w-80 h-80 bg-brand-primary rounded-full blur-[100px] opacity-20 translate-y-1/2 translate-x-1/3" />
        
        <div className="relative z-10">
          {selectedCourse && (
            <button 
              onClick={() => setSelectedCourse(null)}
              className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-widest mb-4 hover:text-emerald-300 transition-colors group bg-white/10 px-3 py-1.5 rounded-lg border border-white/20 w-max backdrop-blur-md"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> Back to Catalog
            </button>
          )}
          
          <div className="flex items-center gap-2 mb-3">
             <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-lg">
                <Users className="text-emerald-400" size={20} />
             </div>
             <span className="text-emerald-400 font-black tracking-[0.2em] uppercase text-xs">Analytics Center</span>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">
            {selectedCourse ? selectedCourse : 'Student Audit Catalog'}
          </h1>
          <p className="text-slate-400 font-medium max-w-xl text-lg mt-2">
            {selectedCourse 
              ? `Real-time performance audit for ${filteredStudents.length} active students in this cohort.`
              : 'Direct oversight of mentee progression across all high-performance courses.'}
          </p>
        </div>
        
        {selectedCourse && (
          <div className="relative z-10 w-full md:w-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search students..." 
                className="w-full md:w-64 pl-12 pr-4 py-3.5 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md text-white outline-none focus:ring-2 focus:ring-emerald-500/50 font-medium placeholder:text-slate-500 shadow-inner"
              />
            </div>
          </div>
        )}
      </div>

      {!selectedCourse ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {courses.map(course => {
            const courseStudents = students.filter(s => s.course === course);
            const courseCompletion = Math.round((courseStudents.filter(s => s.status === 'Completed').length / courseStudents.length) * 100);
            
            return (
              <Card 
                key={course}
                className="group p-6 overflow-hidden cursor-pointer hover:shadow-2xl hover:shadow-emerald-500/10 transition-all border-none ring-1 ring-slate-200 bg-white rounded-[2rem] flex flex-col justify-between"
                onClick={() => setSelectedCourse(course)}
              >
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center ring-1 ring-emerald-100 group-hover:bg-emerald-500 group-hover:text-white transition-colors shadow-sm">
                      <BookOpen size={24} />
                    </div>
                    <div className="px-3 py-1.5 rounded-full bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-widest border border-slate-200">
                      Active
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-black text-slate-900 leading-tight mb-6">{course}</h3>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Learners</p>
                      <div className="flex items-center gap-2">
                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                         <p className="text-xl font-black text-slate-900 tracking-tight">{courseStudents[0].enrolled}</p>
                      </div>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Yield</p>
                      <p className="text-xl font-black text-emerald-600">{courseCompletion}%</p>
                    </div>
                  </div>
                  
                  <div className="relative pt-1">
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${courseCompletion}%` }}
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                     <div className="flex -space-x-2">
                        {[1,2,3].map(i => (
                          <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-100 ring-1 ring-slate-200" />
                        ))}
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-emerald-500 flex items-center justify-center text-[10px] font-black text-white shadow-lg ring-1 ring-emerald-500/20">
                          +{courseStudents.length}
                        </div>
                     </div>
                     <button className="flex items-center gap-1.5 text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-100">
                        Detail <ChevronRight size={14} />
                     </button>
                  </div>
                </div>
              </Card>

            );
          })}
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'Completion Rate', value: `${completionRate}%`, icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-50' },
              { label: 'Avg. Progress', value: `${avgProgress}%`, icon: Users, color: 'text-brand-primary', bg: 'bg-emerald-50/50' },
              { label: 'At Risk Learners', value: atRiskCount, icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-50' },
            ].map((stat, i) => (
              <Card key={i} className="border-none ring-1 ring-slate-100 shadow-sm">
                <div className="flex items-center gap-4">
                  <div className={cn("p-4 rounded-2xl", stat.bg)}>
                    <stat.icon className={stat.color} size={28} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</p>
                    <h3 className="text-3xl font-black mt-1 text-slate-900">{stat.value}</h3>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="overflow-hidden p-0 border-none shadow-2xl shadow-slate-200/50 ring-1 ring-slate-100">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 border-b border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Student</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Progression</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Pulse</th>
                    <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Intervention</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center font-black text-sm border border-brand-primary/5">
                            {student.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 text-sm leading-none mb-1">{student.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">ID: #TZ-0{student.id}202</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="w-full max-w-[140px] space-y-2">
                          <div className="flex justify-between text-[10px] font-black text-slate-600">
                            <span>{student.progress}%</span>
                            <TrendingUp size={12} className="text-brand-primary" />
                          </div>
                          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full rounded-full transition-all duration-700",
                                student.progress === 100 ? "bg-emerald-600" : "bg-brand-primary"
                              )} 
                              style={{ width: `${student.progress}%` }} 
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={cn(
                          "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-[0.1em]",
                          student.status === 'Completed' ? "bg-brand-primary/10 text-brand-primary border border-brand-primary/10" :
                          student.status === 'On Track' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                          student.status === 'Falling Behind' ? "bg-orange-50 text-orange-600 border border-orange-100" :
                          "bg-red-50 text-red-600 border border-red-100"
                        )}>
                          {student.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-2">
                           <Clock size={14} className="text-slate-300" />
                           <span className="text-[11px] text-slate-500 font-bold">{student.lastActive}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Button variant="ghost" size="icon" className="hover:bg-brand-primary/5 hover:text-brand-primary">
                          <MoreVertical size={16} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center">
              <button className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] hover:text-brand-primary transition-colors">Load Extended Audit Records</button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

const TrendingUp = (props: any) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);

export default StudentAudit;
