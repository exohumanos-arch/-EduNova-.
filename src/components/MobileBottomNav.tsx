import React from 'react';
import { NavLink } from 'react-router-dom';
import { Award, ClipboardEdit, Home, Settings, Users } from 'lucide-react';

const MOBILE_TABS = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/marks', label: 'Marks', icon: ClipboardEdit },
  { to: '/results', label: 'Results', icon: Award },
  { to: '/settings', label: 'Profile', icon: Settings },
];

export const MobileBottomNav: React.FC = () => {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed bottom-0 inset-x-0 z-40 h-16 bg-white border-t border-[#ECEBF3] flex items-center justify-around px-2 lg:hidden no-print"
    >
      {MOBILE_TABS.map((tab) => {
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-colors min-w-[56px] ${
                isActive ? 'text-[#7357E8] bg-[#EEE9FF]/70 font-semibold' : 'text-[#85859B]'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
};
