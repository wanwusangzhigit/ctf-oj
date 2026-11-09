import i18n from '@/locales/i18n';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionDiscussionsPage() {
  const { competition: c } = useCompetitionOutlet();

  return (
    <DiscussionPanel
      target={{ scope: 'competition', id: c.id }}
      title={i18n.t('赛事答疑')}
      canPost={!c.registrationRequired || !!c.registered}
      postDeniedText={i18n.t('报名后才能参与赛事答疑。')}
      emptyText={i18n.t('暂无答疑。')}
    />
  );
}
