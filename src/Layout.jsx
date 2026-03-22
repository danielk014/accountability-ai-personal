import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { LayoutDashboard, MessageCircle, BarChart3, CalendarDays, User, DollarSign, FolderKanban, Dumbbell } from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import { useAuth } from "@/lib/AuthContext";
import { checkReminders, getUnreadCount, clearUnread } from "@/lib/reminderEngine";

const navItems = [
  { name: "Chat", icon: MessageCircle, page: "Chat" },
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Calendar", icon: CalendarDays, page: "Calendar" },
  { name: "Projects", icon: FolderKanban, page: "Projects" },
  { name: "Financials", icon: DollarSign, page: "Financials" },
  { name: "Gym", icon: Dumbbell, page: "Gym" },
  { name: "Progress", icon: BarChart3, page: "Progress" },
];

export default function Layout({ children, currentPageName }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(getUnreadCount);

  // Run reminder check every 30 s
  useEffect(() => {
    checkReminders(); // check immediately on mount
    const interval = setInterval(checkReminders, 30_000);
    return () => clearInterval(interval);
  }, []);

  // React to unread count changes fired by the engine
  useEffect(() => {
    const handler = (e) => setUnread(e.detail?.count ?? getUnreadCount());
    window.addEventListener('unread-changed', handler);
    return () => window.removeEventListener('unread-changed', handler);
  }, []);

  // Auto-clear when user is on Chat page
  useEffect(() => {
    if (currentPageName === 'Chat') {
      clearUnread();
      setUnread(0);
    }
  }, [currentPageName]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      <FloatingChatBubble currentPageName={currentPageName} />

      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="w-full px-3 sm:px-6 flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-[#1e2228] flex items-center justify-center overflow-hidden">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="Logo" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <span className="font-bold text-slate-800 text-base sm:text-lg tracking-tight hidden sm:block">Accountable</span>
          </div>

          <nav
            className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide min-w-0 overscroll-x-contain"
            style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}
          >
            {navItems.map(item => {
              const isActive = currentPageName === item.page;
              const showBadge = item.page === 'Chat' && !isActive && unread > 0;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  style={{ touchAction: 'manipulation' }}
                  className={cn(
                    "relative flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2 rounded-xl text-sm font-medium transition-colors flex-shrink-0 min-w-[44px] sm:min-w-0",
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                  )}
                >
                  <item.icon className="w-5 h-5 sm:w-4 sm:h-4" />
                  <span className="text-[9px] sm:text-sm sm:inline leading-none">{item.name}</span>
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              to={createPageUrl("Settings")}
              style={{ touchAction: 'manipulation' }}
              className="flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0 min-w-[44px] sm:min-w-0"
            >
              <span className="text-[9px] sm:text-sm">Settings</span>
            </Link>

            {user && (
              <Link
                to={createPageUrl("Settings")}
                className="ml-1 pl-2 border-l border-slate-200 flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-all flex-shrink-0"
                title="Settings"
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                  </div>
                )}
                <span className="hidden sm:block text-xs font-medium text-slate-600 max-w-[90px] truncate">
                  {user.full_name || user.email}
                </span>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
