import React, { useState, useEffect } from 'react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { useAuthStore } from '../../store/authStore';
import { FreeMentorDashboard } from './FreeMentorDashboard';
import { MentorProDashboard } from './MentorProDashboard';
import { InstitutionalDashboard } from '../admin/InstitutionalDashboard';
import type { SubscriptionTier } from '../../lib/monetization/types';
import TodoWidget from '../../components/shared/TodoWidget';

export const TutorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { tier, fetchSubscription } = useSubscriptionStore();
  const [viewOverride, setViewOverride] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    if (user) {
      fetchSubscription(user.id);
    }
  }, [user]);

  const activeTierView: SubscriptionTier = viewOverride || tier || 'free';

  return (
    <div className="w-full space-y-8">
      {activeTierView === 'institutional' ? (
        <InstitutionalDashboard activeTierView={activeTierView} onViewOverride={setViewOverride} />
      ) : activeTierView === 'pro' ? (
        <MentorProDashboard activeTierView={activeTierView} onViewOverride={setViewOverride} />
      ) : (
        <FreeMentorDashboard activeTierView={activeTierView} onViewOverride={setViewOverride} />
      )}

      {/* Marking queue and personal tasks, shown on every tier */}
      <TodoWidget />
    </div>
  );
};

export default TutorDashboard;
