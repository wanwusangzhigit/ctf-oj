import i18n from '@/locales/i18n';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { useChallengeOutlet } from './ChallengeLayout';

export function ChallengeDiscussionsPage() {
  const { challenge, competitionId } = useChallengeOutlet();

  return (
    <DiscussionPanel
      target={{ scope: 'challenge', id: challenge.id, competitionId }}
      title={i18n.t('题目讨论')}
    />
  );
}
