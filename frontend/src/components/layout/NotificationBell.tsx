import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check, CheckCheck, Trophy, MessageSquare, Megaphone, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from '@/api/notification';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import type { NotificationKind } from '@/types';

const KIND_ICON: Record<NotificationKind, typeof Bell> = {
  solve: Trophy,
  reply: MessageSquare,
  announcement: Megaphone,
  system: Settings,
};

const KIND_TONE: Record<NotificationKind, string> = {
  solve: 'text-success',
  reply: 'text-accent',
  announcement: 'text-warning',
  system: 'text-muted',
};

export function NotificationBell() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const [open, setOpen] = useState(false);

  const unread = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: unreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 0,
  });
  const recent = useQuery({
    queryKey: ['notifications-recent'],
    queryFn: () => listNotifications(1, 5),
    enabled: !!user && open,
    staleTime: 0,
  });

  const markAllMut = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
    },
  });
  const markOneMut = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications-unread'] });
      qc.invalidateQueries({ queryKey: ['notifications-recent'] });
    },
  });

  if (!user) return null;

  const count = unread.data ?? 0;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center h-8 w-8 rounded hover:bg-surface-2 transition-colors"
        aria-label="通知"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 inline-flex items-center justify-center text-2xs font-medium rounded-full bg-danger text-danger-fg">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-surface border border-border rounded-lg shadow-popover z-40">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">通知</span>
              <div className="flex items-center gap-2">
                {count > 0 && (
                  <button
                    type="button"
                    onClick={() => markAllMut.mutate()}
                    className="inline-flex items-center gap-1 text-2xs text-accent hover:underline"
                  >
                    <CheckCheck className="h-3 w-3" />
                    全部已读
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {recent.isLoading ? (
                <div className="px-3 py-6 text-center text-2xs text-muted">加载中...</div>
              ) : recent.data?.items?.length ? (
                recent.data.items.map((n) => {
                  const Icon = KIND_ICON[n.kind] ?? Bell;
                  return (
                    <Link
                      key={n.id}
                      to={n.link || '/notifications'}
                      onClick={() => {
                        if (!n.readAt) markOneMut.mutate(n.id);
                        setOpen(false);
                      }}
                      className={cn(
                        'block px-3 py-2 hover:bg-surface-2 transition-colors border-b border-border last:border-b-0',
                        !n.readAt && 'bg-accent/5',
                      )}
                    >
                      <div className="flex items-start gap-2">
                        <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', KIND_TONE[n.kind])} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{n.title}</div>
                          {n.body && <div className="text-2xs text-muted truncate">{n.body}</div>}
                          <div className="text-2xs text-muted mt-0.5">{relativeTime(n.createdAt)}</div>
                        </div>
                        {!n.readAt && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent mt-1.5" />
                        )}
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-3 py-8 text-center text-2xs text-muted">
                  <Bell className="h-5 w-5 mx-auto mb-2 opacity-50" />
                  暂无通知
                </div>
              )}
            </div>
            <div className="border-t border-border px-3 py-2 text-center">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="text-2xs text-accent hover:underline inline-flex items-center gap-1"
              >
                <Check className="h-3 w-3" />
                查看全部
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
