import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pin } from 'lucide-react';
import { listAnnouncements } from '@/api/announcement';
import { Card, CardBody, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatTime, relativeTime } from '@/lib/utils';

export function AnnouncementsPage() {
  const [page] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => listAnnouncements(page, 30),
    staleTime: 60_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">公告</h1>
        <p className="text-sm text-muted mt-1">来自管理员的站点动态。</p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-5 w-5 text-muted" />
        </div>
      ) : data?.items?.length ? (
        <div className="space-y-4">
          {data.items.map((a) => (
            <Card key={a.id}>
              <CardHeader className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>
                    <Link to={`/announcements/${a.id}`} className="hover:text-accent">
                      {a.title}
                    </Link>
                  </CardTitle>
                  <div className="text-2xs text-muted mt-1">
                    {a.publishedAt ? formatTime(a.publishedAt) : formatTime(a.createdAt)}
                  </div>
                </div>
                {a.isPinned && (
                  <Badge tone="warning">
                    <Pin className="h-3 w-3" />
                    置顶
                  </Badge>
                )}
              </CardHeader>
              <CardBody>
                <Markdown>{a.contentMd || '（无内容）'}</Markdown>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardBody className="py-16 text-center text-sm text-muted">
            暂无公告。
          </CardBody>
        </Card>
      )}
    </div>
  );
}

export function AnnouncementDetailPage() {
  return null; // placeholder so router file import shape stays consistent
}

export const _relative = relativeTime;
