import React from 'react';

interface Tab {
  key: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface StatusTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

const StatusTabs: React.FC<StatusTabsProps> = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="flex gap-1 border-b border-slate-200 pb-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-4 py-2.5 min-h-[44px] shrink-0 snap-start rounded-t-xl font-bold text-xs tracking-wide uppercase transition-all flex items-center gap-2 active:scale-[0.97] ${
            activeTab === tab.key
              ? 'text-emerald-700 border-b-[3px] border-emerald-600 bg-emerald-50/40'
              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          {tab.icon && <span>{tab.icon}</span>}
          <span>{tab.label}</span>
          {typeof tab.count === 'number' && tab.count > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black leading-none ${
              activeTab === tab.key
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-600'
            } ${tab.key === 'pending' ? 'animate-pulse' : ''}`}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

export default React.memo(StatusTabs);
