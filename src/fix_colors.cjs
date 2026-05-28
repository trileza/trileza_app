const fs = require('fs');
const path = require('path');

const baseDir = 'c:/Users/David Ileza Adamu/Documents/TRILEZA/PROJECTS/trileza app/src';

// 1. Fix Dashboard.tsx (Student / Mentee)
const dashboardPath = path.join(baseDir, 'pages/student/Dashboard.tsx');
let dashboardCode = fs.readFileSync(dashboardPath, 'utf8');

// Remove main background color
dashboardCode = dashboardCode.replace(
  '<div className="dark bg-[#0a0a30] text-white p-5 rounded-[2.5rem] space-y-10 pb-20 max-w-7xl mx-auto animate-in fade-in duration-700 font-sans border border-[#202272]/20">',
  '<div className="p-5 space-y-10 pb-20 max-w-7xl mx-auto animate-in fade-in duration-700 font-sans">'
);

// Replace indigo containers with dark containers
dashboardCode = dashboardCode.replace(/bg-\[#12134a\]\/[0-9]+/g, 'bg-slate-900');
dashboardCode = dashboardCode.replace(/bg-\[#12134a\]/g, 'bg-slate-900');
dashboardCode = dashboardCode.replace(/border-\[#1b1d6b\]\/[0-9]+/g, 'border-slate-800');
dashboardCode = dashboardCode.replace(/bg-\[#242582\]/g, 'bg-slate-800');
dashboardCode = dashboardCode.replace(/bg-gradient-to-br from-\[#12134a\] via-\[#1b1d6b\]\/25 to-slate-950/g, 'bg-gradient-to-br from-slate-900 to-slate-950');
dashboardCode = dashboardCode.replace(/bg-gradient-to-br from-\[#12134a\] to-slate-950/g, 'bg-gradient-to-br from-slate-900 to-slate-950');
dashboardCode = dashboardCode.replace(/border-indigo-900\/[0-9]+/g, 'border-slate-800');

fs.writeFileSync(dashboardPath, dashboardCode);

// 2. Fix Mentorship.tsx (Mentor & Mentee)
const mentorshipPath = path.join(baseDir, 'pages/shared/Mentorship.tsx');
let mentorshipCode = fs.readFileSync(mentorshipPath, 'utf8');

// Mentee Dashboard in Mentorship.tsx has #12134a too, make it dark
mentorshipCode = mentorshipCode.replace(/bg-\[#12134a\]\/[0-9]+/g, 'bg-slate-900');
mentorshipCode = mentorshipCode.replace(/bg-\[#12134a\]/g, 'bg-slate-900');
mentorshipCode = mentorshipCode.replace(/border-\[#1b1d6b\]\/[0-9]+/g, 'border-slate-800');
mentorshipCode = mentorshipCode.replace(/bg-\[#242582\]/g, 'bg-slate-800');
mentorshipCode = mentorshipCode.replace(/bg-gradient-to-br from-\[#12134a\] to-slate-950/g, 'bg-gradient-to-br from-slate-900 to-slate-950');
mentorshipCode = mentorshipCode.replace(/bg-gradient-to-br from-\[#12134a\]\/45 to-slate-950/g, 'bg-gradient-to-br from-slate-900 to-slate-950');
mentorshipCode = mentorshipCode.replace(/border-indigo-900\/[0-9]+/g, 'border-slate-800');

// Mentor containers: make them green. Currently they are bg-slate-900/60 or bg-slate-905
// Let's replace Mentor specific backgrounds.
// "For the mentors, they can maintain a black sidebar with green containers."
mentorshipCode = mentorshipCode.replace(/bg-slate-900\/60/g, 'bg-emerald-950/60');
mentorshipCode = mentorshipCode.replace(/bg-slate-905/g, 'bg-emerald-950/80');
mentorshipCode = mentorshipCode.replace(/border-slate-800/g, 'border-emerald-900/50');
// In mentor header
mentorshipCode = mentorshipCode.replace(/bg-slate-950/g, 'bg-black');
mentorshipCode = mentorshipCode.replace(/bg-gradient-to-br from-indigo-955 via-slate-900 to-slate-950/g, 'bg-gradient-to-br from-emerald-950 via-slate-950 to-black');
mentorshipCode = mentorshipCode.replace(/bg-indigo-900\/30/g, 'bg-emerald-900/30');

// Mentorship wrapper background
mentorshipCode = mentorshipCode.replace(
  'activeRoleIsMentee \n        // Deep Indigo/Royal Blue color theme for Mentee (from image)\n        ? "bg-[#0a0a30] border border-[#202272]/20" \n        // Sleek matte dark carbon-black for Coach (Mentor)\n        : "bg-[#07090e] border border-slate-900/20"',
  'activeRoleIsMentee ? "" : ""'
);
mentorshipCode = mentorshipCode.replace(/className={cn\(\n\s*"dark p-1 rounded-\[2\.5rem\] overflow-hidden min-h-screen text-white transition-all duration-500",\n\s*activeRoleIsMentee \? "" : ""\n\s*\)}/, 'className="p-1 rounded-[2.5rem] overflow-hidden min-h-screen text-white transition-all duration-500"');

fs.writeFileSync(mentorshipPath, mentorshipCode);

// 3. Fix RoleSwitcher.tsx
const roleSwitcherPath = path.join(baseDir, 'components/shared/RoleSwitcher.tsx');
let roleSwitcherCode = fs.readFileSync(roleSwitcherPath, 'utf8');

roleSwitcherCode = roleSwitcherCode.replace(/from-\[#1e227d\] via-\[#242582\] to-\[#2f31a6\]/g, 'from-emerald-500 via-emerald-400 to-brand-primary');
roleSwitcherCode = roleSwitcherCode.replace(/from-indigo-500 via-purple-500 to-fuchsia-500/g, 'from-emerald-600 via-emerald-500 to-brand-primary');
roleSwitcherCode = roleSwitcherCode.replace(/bg-\[#0c0d35\]\/90 border-\[#242582\] shadow-\[0_0_15px_rgba\(30,34,130,0\.3\)\]/g, 'bg-slate-900 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]');
roleSwitcherCode = roleSwitcherCode.replace(/bg-slate-900 border-indigo-500\/80 shadow-\[0_0_15px_rgba\(99,102,241,0\.3\)\]/g, 'bg-slate-900 border-emerald-500/80 shadow-[0_0_15px_rgba(16,185,129,0.3)]');
roleSwitcherCode = roleSwitcherCode.replace(/text-indigo-200\/80/g, 'text-slate-400');
roleSwitcherCode = roleSwitcherCode.replace(/text-indigo-305/g, 'text-emerald-400');
roleSwitcherCode = roleSwitcherCode.replace(/text-indigo-400\/70/g, 'text-emerald-400/70');
roleSwitcherCode = roleSwitcherCode.replace(/border-indigo-500\/80/g, 'border-emerald-500/80');
roleSwitcherCode = roleSwitcherCode.replace(/hover:border-indigo-450/g, 'hover:border-emerald-450');
roleSwitcherCode = roleSwitcherCode.replace(/shadow-\[0_0_20px_rgba\(99,102,241,0\.25\)\]/g, 'shadow-[0_0_20px_rgba(16,185,129,0.25)]');
roleSwitcherCode = roleSwitcherCode.replace(/hover:shadow-\[0_0_30px_rgba\(99,102,241,0\.45\)\]/g, 'hover:shadow-[0_0_30px_rgba(16,185,129,0.45)]');
roleSwitcherCode = roleSwitcherCode.replace(/from-indigo-500\/20 to-purple-500\/10/g, 'from-emerald-500/20 to-brand-primary/10');
roleSwitcherCode = roleSwitcherCode.replace(/bg-indigo-500 border-indigo-400/g, 'bg-brand-primary border-emerald-400');
roleSwitcherCode = roleSwitcherCode.replace(/shadow-\[0_0_10px_rgba\(99,102,241,0\.5\)\]/g, 'shadow-[0_0_10px_rgba(16,185,129,0.5)]');
roleSwitcherCode = roleSwitcherCode.replace(/bg-indigo-400/g, 'bg-emerald-400');
roleSwitcherCode = roleSwitcherCode.replace(/bg-indigo-500/g, 'bg-emerald-500');
roleSwitcherCode = roleSwitcherCode.replace(/text-indigo-400/g, 'text-emerald-400');

fs.writeFileSync(roleSwitcherPath, roleSwitcherCode);

console.log('Colors replaced successfully!');
