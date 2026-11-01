import { DiscussionPanel } from '@/components/DiscussionPanel';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionDiscussionsPage() {
  const { competition: c } = useCompetitionOutlet();

  return (
    <DiscussionPanel
      target={{ scope: 'competition', id: c.id }}
      title="赛事答疑"
      canPost={!c.registrationRequired || !!c.registered}
      postDeniedText="报名后才能参与赛事答疑。"
      emptyText="暂无答疑。"
    />
  );
}
