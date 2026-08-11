import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { LayoutDashboard, MessageCircle, BarChart3, CalendarDays, User, DollarSign, FolderKanban, Dumbbell, Settings, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import FloatingChatBubble from "@/components/chat/FloatingChatBubble";
import { useAuth } from "@/lib/AuthContext";
import { checkReminders, getUnreadCount, clearUnread } from "@/lib/reminderEngine";

const navItems = [
  { name: "Day Tracker", icon: Clock, page: "DayTracker" },
  { name: "Financials", icon: DollarSign, page: "Financials" },
  { name: "Gym", icon: Dumbbell, page: "Gym" },
  { name: "Chat", icon: MessageCircle, page: "Chat" },
  { name: "Dashboard", icon: LayoutDashboard, page: "Dashboard" },
  { name: "Projects", icon: FolderKanban, page: "Projects" },
  { name: "Progress", icon: BarChart3, page: "Progress" },
];

export default function Layout({ children, currentPageName }) {
  const { user } = useAuth();
  const [unread, setUnread] = useState(getUnreadCount);

  // Run reminder check every 30 s (skip when tab is hidden)
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState !== 'hidden') checkReminders();
    };
    tick();
    const interval = setInterval(tick, 30_000);
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
    <div className="min-h-screen bg-[hsl(220,14%,97%)] flex flex-col overflow-x-hidden">
      <FloatingChatBubble currentPageName={currentPageName} />

      {/* Top nav — Apple-style clean bar */}
      <header className="bg-white/80 backdrop-blur-xl border-b border-[hsl(220,13%,93%)] sticky top-0 z-50">
        <div className="w-full px-3 sm:px-6 flex items-center justify-between h-12 sm:h-14">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-[10px] bg-[#1e2228] flex items-center justify-center overflow-hidden shadow-sm">
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="Logo" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <span className="font-semibold text-[hsl(220,13%,10%)] text-[15px] tracking-tight hidden sm:block">Accountable</span>
          </div>

          <nav
            className="flex items-center gap-0.5 overflow-x-auto scrollbar-hide min-w-0 overscroll-x-contain"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {navItems.map(item => {
              const isActive = currentPageName === item.page;
              const showBadge = item.page === 'Chat' && !isActive && unread > 0;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  className={cn(
                    "relative flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)] flex-shrink-0 min-w-[44px] sm:min-w-0",
                    isActive
                      ? "bg-[hsl(220,14%,96%)] text-[hsl(211,100%,50%)]"
                      : "text-[hsl(220,9%,46%)] hover:text-[hsl(220,13%,18%)] hover:bg-[hsl(220,14%,96%)]"
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[9px] sm:text-[13px] leading-none">{item.name}</span>
                  {showBadge && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] rounded-full bg-[hsl(0,72%,51%)] text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            <Link
              to={createPageUrl("Settings")}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className={cn(
                "flex flex-col sm:flex-row items-center gap-0.5 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 flex-shrink-0 min-w-[44px] sm:min-w-0",
                currentPageName === "Settings"
                  ? "bg-[hsl(220,14%,96%)] text-[hsl(211,100%,50%)]"
                  : "text-[hsl(220,9%,46%)] hover:text-[hsl(220,13%,18%)] hover:bg-[hsl(220,14%,96%)]"
              )}
            >
              <Settings className="w-[18px] h-[18px] sm:w-4 sm:h-4" strokeWidth={currentPageName === "Settings" ? 2.2 : 1.8} />
              <span className="text-[9px] sm:text-[13px] leading-none">Settings</span>
            </Link>

            {user && (
              <Link
                to={createPageUrl("Settings")}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className="ml-1.5 pl-2.5 border-l border-[hsl(220,13%,91%)] flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[hsl(220,14%,96%)] transition-all duration-200 flex-shrink-0"
                title={user.full_name || user.email}
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover flex-shrink-0 ring-1 ring-black/[0.04]" />
                ) : (
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[hsl(211,100%,95%)] flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[hsl(211,100%,50%)]" />
                  </div>
                )}
                <span className="hidden sm:block text-xs font-medium text-[hsl(220,9%,46%)] max-w-[90px] truncate">
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
