import i18n from '@/locales/i18n';
import { useParams } from 'react-router-dom';
import { CompetitionAdminShell } from '@/components/admin/CompetitionAdminShell';
import { CompetitionRegistrationTable } from '@/components/admin/CompetitionRegistrationTable';

/** /admin/competitions/:id/registrations */
export function AdminCompetitionRegistrationsPage() {
  const { id } = useParams<{ id: string }>();
  const competitionId = Number(id);

  return (
    <CompetitionAdminShell
      competitionId={competitionId}
      command={`registrations ${competitionId}`}
      title={i18n.t('报名与成绩')}
      note={i18n.t('取消成绩会从赛事榜移除，并阻止继续提交赛事题')}
    >
      {(competition) => <CompetitionRegistrationTable competition={competition} />}
    </CompetitionAdminShell>
  );
}
