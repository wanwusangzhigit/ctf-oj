import { DiscussionPanel } from '@/components/DiscussionPanel';
import { useChallengeOutlet } from './ChallengeLayout';

export function ChallengeDiscussionsPage() {
  const { challenge, competitionId } = useChallengeOutlet();

  return (
    <DiscussionPanel
      target={{ scope: 'challenge', id: challenge.id, competitionId }}
      title="题目讨论"
    />
  );
}
