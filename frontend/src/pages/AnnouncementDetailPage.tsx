import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Pin, ArrowLeft } from 'lucide-react';
import { getAnnouncement } from '@/api/announcement';
import { Card, CardBody, CardHeader, CardTitle, Badge, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatTime } from '@/lib/utils';

export function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const aid = Number(id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['announcement', aid],
    queryFn: () => getAnnouncement(aid),
    enabled: !Number.isNaN(aid),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">
            公告不存在。
            <div className="mt-3">
              <Link to="/announcements" className="text-accent">
                返回列表
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/announcements"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回列表
      </Link>
      <Card>
        <CardHeader className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{data.title}</CardTitle>
            <div className="text-2xs text-muted mt-1">
              {data.publishedAt ? formatTime(data.publishedAt) : formatTime(data.createdAt)}
            </div>
          </div>
          {data.isPinned && (
            <Badge tone="warning">
              <Pin className="h-3 w-3" />
              置顶
            </Badge>
          )}
        </CardHeader>
        <CardBody>
          <Markdown>{data.contentMd || '（无内容）'}</Markdown>
        </CardBody>
      </Card>
    </div>
  );
}
