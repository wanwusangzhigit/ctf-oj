import { WriteupsPanel } from '@/components/WriteupsPanel';
import { useChallengeOutlet } from './ChallengeLayout';

export function ChallengeWriteupsPage() {
  const { challenge, competitionId } = useChallengeOutlet();

  return (
    <WriteupsPanel
      challengeId={challenge.id}
      competitionId={competitionId}
      solved={challenge.solved}
    />
  );
}
