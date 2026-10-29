import { useNavigate } from 'react-router-dom';
import { ChallengeForm } from '@/components/admin/ChallengeForm';

/**
 * /admin/challenges/new — create a new challenge.
 *
 * On success we navigate to the edit page so the admin can immediately
 * upload attachments and (for dockerfile/compose) the build context —
 * those endpoints require the challenge to already exist in the DB.
 */
export function AdminChallengeNewPage() {
  const navigate = useNavigate();

  return (
    <ChallengeForm
      mode="create"
      onCreated={(id) => navigate(`/admin/challenges/${id}/edit`, { replace: true })}
    />
  );
}
