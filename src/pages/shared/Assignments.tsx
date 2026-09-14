import React, { useState } from 'react';
import AssignmentViewer from '../../components/assignments/AssignmentViewer';
import AssignmentCreator from '../../components/assignments/AssignmentCreator';
import { Toast } from '../../components/ui/Toast';
import { FileText } from 'lucide-react';
import { PageHeader } from '../../components/shared';
import { useAuthStore, resolveActiveRole } from '../../store/authStore';

/**
 * One route, two audiences: a learner sees the work set for them, a teacher
 * sees what they have set and what is waiting to be marked.
 */
const Assignments: React.FC = () => {
  const { user, activeRole } = useAuthStore();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const showFeedback = (msg: string, type: 'success' | 'info' = 'success') => setToast({ message: msg, type });

  const role = (activeRole || resolveActiveRole(user) || 'mentee').toLowerCase();
  const isTeacher = role === 'mentor' || role === 'tutor' || role === 'management' || role === 'staff';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20 w-full">
      <PageHeader
        title={isTeacher ? 'Assignments' : 'My Assignments'}
        description={
          isTeacher
            ? 'Set work, publish it to a class, and mark what comes back. Marks flow straight into the gradebook.'
            : 'Track your learning milestones, complete assigned tasks, and review your graded assessments.'
        }
        tag="Knowledge Verification"
        icon={FileText}
      />

      <div className="relative z-10">
        {isTeacher
          ? <AssignmentCreator showFeedback={showFeedback} />
          : <AssignmentViewer showFeedback={showFeedback} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default Assignments;
