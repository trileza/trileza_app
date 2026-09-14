import React from 'react';
import { useSubscriptionStore } from '../../store/subscriptionStore';
import { MONETIZATION_TIERS } from '../../lib/monetization/config';
import { Sparkles, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Button } from '../ui';

export const UsageLimitBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { tier, usage, openUpgradeModal, isPro } = useSubscriptionStore();
  const tierConfig = MONETIZATION_TIERS[tier] || MONETIZATION_TIERS.free;

  const maxCourses = tierConfig.features.max_courses;
  const courseCount = usage.published_courses_count;
  const isCourseLimitReached = courseCount >= maxCourses && maxCourses !== Infinity;

  const maxStudents = tierConfig.features.max_students_per_course;
  const studentCount = usage.total_students_enrolled;
  const isStudentLimitReached = studentCount >= maxStudents && maxStudents !== Infinity;

  if (tier === 'institutional' || (isPro() && !isStudentLimitReached)) {
    return null;
  }

  const coursePercentage = maxCourses === Infinity ? 0 : Math.min(100, Math.round((courseCount / maxCourses) * 100));

  return (
    <div className={`rounded-2xl p-4 border transition-all ${
      isCourseLimitReached || isStudentLimitReached
        ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
        : 'bg-slate-900/60 border-slate-800 text-slate-200'
    } ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isCourseLimitReached ? (
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            ) : (
              <Sparkles className="w-4 h-4 text-emerald-400" />
            )}
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {tierConfig.name} Quota
            </span>
          </div>

          <div className="text-xs text-slate-400">
            Published Courses: <strong className="text-white">{courseCount}</strong> / {maxCourses === Infinity ? 'Unlimited' : maxCourses}
            {' • '}
            Students: <strong className="text-white">{studentCount}</strong> / {maxStudents === Infinity ? 'Unlimited' : maxStudents}
          </div>

          {/* Mini progress bar */}
          {maxCourses !== Infinity && (
            <div className="w-full max-w-xs h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
              <div 
                className={`h-full transition-all duration-500 ${
                  isCourseLimitReached ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${coursePercentage}%` }}
              />
            </div>
          )}
        </div>

        <div>
          <Button
            size="sm"
            onClick={() => openUpgradeModal(tier === 'free' ? 'pro' : 'institutional')}
            className={`text-xs font-bold px-3.5 py-1.5 rounded-xl shadow-md flex items-center gap-1 cursor-pointer ${
              isCourseLimitReached
                ? 'bg-amber-500 hover:bg-amber-400 text-black'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            {isCourseLimitReached ? 'Upgrade for Unlimited' : 'Upgrade Plan'}
            <ArrowUpRight className="w-3 h-3" />
          </Button>
        </div>

      </div>
    </div>
  );
};
