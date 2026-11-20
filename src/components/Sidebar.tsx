import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CalendarDays,
  ClipboardEdit,
  Award,
  Medal,
  BarChart3,
  FileSpreadsheet,
  Box,
  MessageSquare,
  Code2,
  UserCog,
  Settings,
  LogOut,
  X,
} from 'lucide-react';
import type { AuthUser } from '../types';
import { EduNovaLogo } from './EduNovaLogo';
import { StudentAvatar } from './StudentAvatar';

export interface NavRouteItem {
  to: string;
  label: string;
  icon: React.FC<{ className?: string }>;
  adminOnly?: boolean;
}

export const SIDEBAR_NAV_ITEMS: NavRouteItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/students', label: 'Students', icon: Users },
  { to: '/subjects', label: 'Subjects', icon: BookOpen },
  { to: '/examinations', label: 'Examinations', icon: CalendarDays },
  { to: '/marks', label: 'Marks Management', icon: ClipboardEdit },
  { to: '/results', label: 'Results', icon: Award },
  { to: '/grades', label: 'Grade Management', icon: Medal },
  { to: '/reports', label: 'Reports & Analytics', icon: BarChart3 },
  { to: '/import-export', label: 'Import / Export', icon: FileSpreadsheet },
  { to: '/observatory-3d', label: '3D Observatory', icon: Box },
  { to: '/ai-advisor', label: 'AI Advisor', icon: MessageSquare },
  { to: '/python-inspector', label: 'Python Inspector', icon: Code2 },
  { to: '/users', label: 'User Management', icon: UserCog, adminOnly: true },
  { to: '/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  user: AuthUser;
  mobileMenuOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  mobileMenuOpen,
  onCloseMobile,
  onLogout,
}) => {
  const visibleItems = SIDEBAR_NAV_ITEMS.filter(
    (item) => !item.adminOnly || user.role === 'ADMIN'
  );

  return (
    <>
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#24243A]/40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#ECEBF3] flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-[#ECEBF3] shrink-0">
          <EduNovaLogo size="md" />
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#EEE9FF] text-[#7357E8] font-semibold'
                      : 'text-[#85859B] hover:bg-[#F7F7FC] hover:text-[#24243A]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#ECEBF3] shrink-0 space-y-3">
          <div className="flex items-center gap-3">
            <StudentAvatar name={user.username} size="md" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#24243A] truncate">{user.username}</p>
              <p className="text-xs text-[#85859B] font-mono truncate">{user.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] px-3 py-2 text-xs font-semibold text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#4935A8] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};
