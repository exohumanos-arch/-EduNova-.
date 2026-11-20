import React, { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Calendar, Menu, Sparkles } from 'lucide-react';
import type { AuthUser, DashboardPayload } from '../types';
import { SearchBar } from './SearchBar';
import { StudentAvatar } from './StudentAvatar';
import { NotificationPanel } from './NotificationPanel';
import { SIDEBAR_NAV_ITEMS } from './Sidebar';

interface NavbarProps {
  pageTitle: string;
  user: AuthUser;
  dashboard: DashboardPayload | null;
  onOpenMobileMenu: () => void;
  onOpenAiDrawer: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  pageTitle,
  user,
  dashboard,
  onOpenMobileMenu,
  onOpenAiDrawer,
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  );

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return { students: [], pages: [] };

    const students = (dashboard?.results ?? [])
      .filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.roll_no.toLowerCase().includes(q) ||
          s.branch.toLowerCase().includes(q)
      )
      .slice(0, 5);

    const pages = SIDEBAR_NAV_ITEMS.filter(
      (p) =>
        (!p.adminOnly || user.role === 'ADMIN') &&
        p.label.toLowerCase().includes(q)
    ).slice(0, 4);

    return { students, pages };
  }, [searchQuery, dashboard, user.role]);

  const alertCount = dashboard?.summary.low_performers.length ?? 0;

  return (
    <header className="h-16 bg-white border-b border-[#ECEBF3] px-4 lg:px-8 flex items-center justify-between gap-4 shrink-0 no-print">
      {/* Left: Mobile menu + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 rounded-xl text-[#85859B] hover:text-[#24243A] hover:bg-[#F7F7FC]"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm truncate">
          <span className="text-[#85859B] hidden sm:inline">EduNova</span>
          <span className="text-[#ECEBF3] hidden sm:inline">/</span>
          <span className="font-display font-semibold text-[#24243A] truncate">
            {pageTitle}
          </span>
        </div>
      </div>

      {/* Center: Global Search */}
      <div
        ref={searchContainerRef}
        className="relative hidden md:block flex-1 max-w-md"
        onFocus={() => setSearchFocused(true)}
        onBlur={(e) => {
          if (!searchContainerRef.current?.contains(e.relatedTarget as Node)) {
            setSearchFocused(false);
          }
        }}
      >
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search students, roll numbers, or modules..."
          ariaLabel="Global search"
        />

        {searchFocused && searchQuery.trim() !== '' && (
          <div className="absolute left-0 right-0 top-12 z-50 rounded-[18px] bg-white border border-[#ECEBF3] shadow-[0_12px_32px_rgba(36,36,58,0.12)] overflow-hidden">
            {searchResults.students.length === 0 && searchResults.pages.length === 0 ? (
              <div className="px-4 py-3 text-xs text-[#85859B]">
                No matching students or pages found.
              </div>
            ) : (
              <div className="divide-y divide-[#ECEBF3]/70">
                {searchResults.students.map((st) => (
                  <button
                    key={st.student_id}
                    type="button"
                    onClick={() => {
                      navigate(`/students/${st.student_id}`);
                      setSearchQuery('');
                      setSearchFocused(false);
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F7FC]"
                  >
                    <div>
                      <p className="text-xs font-semibold text-[#24243A]">{st.name}</p>
                      <p className="text-[11px] text-[#85859B] font-mono">
                        {st.roll_no} · {st.branch}
                      </p>
                    </div>
                    <span className="text-xs font-mono font-semibold text-[#7357E8] tabular-nums">
                      {st.percentage.toFixed(1)}%
                    </span>
                  </button>
                ))}
                {searchResults.pages.map((p) => (
                  <button
                    key={p.to}
                    type="button"
                    onClick={() => {
                      navigate(p.to);
                      setSearchQuery('');
                      setSearchFocused(false);
                    }}
                    className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-[#F7F7FC]"
                  >
                    <span className="text-xs font-medium text-[#24243A]">{p.label}</span>
                    <span className="text-[11px] text-[#85859B]">Page</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right: Date, AI CTA, Notifications, Profile */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden xl:flex items-center gap-1.5 text-xs text-[#85859B] tabular-nums pr-1">
          <Calendar className="w-3.5 h-3.5" />
          <span>{todayFormatted}</span>
        </div>

        <button
          type="button"
          onClick={onOpenAiDrawer}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#7357E8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#4935A8] transition-colors whitespace-nowrap shadow-[0_4px_12px_rgba(115,87,232,0.25)]"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ask AI Advisor</span>
          <span className="sm:hidden">AI</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNotifOpen((o) => !o)}
            aria-label="Toggle academic alerts"
            className="relative w-9 h-9 rounded-xl border border-[#ECEBF3] bg-[#F7F7FC] flex items-center justify-center text-[#24243A] hover:bg-[#EEE9FF] hover:text-[#7357E8] transition-colors"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EF6262] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {alertCount}
              </span>
            )}
          </button>
          <NotificationPanel
            open={notifOpen}
            onClose={() => setNotifOpen(false)}
            dashboard={dashboard}
          />
        </div>

        <Link
          to="/settings"
          title="Account settings"
          className="flex items-center gap-2.5 pl-1 rounded-xl hover:opacity-90 transition-opacity"
        >
          <StudentAvatar name={user.username} size="sm" />
        </Link>
      </div>
    </header>
  );
};
