import i18n from '@/locales/i18n';
import { useParams } from 'react-router-dom';
import { CompetitionAdminShell } from '@/components/admin/CompetitionAdminShell';
import { CompetitionAnnouncementManager } from '@/components/admin/CompetitionAnnouncementManager';

/** /admin/competitions/:id/announcements */
export function AdminCompetitionAnnouncementsPage() {
  const { id } = useParams<{ id: string }>();
  const competitionId = Number(id);

  return (
    <CompetitionAdminShell
      competitionId={competitionId}
      command={`announcements ${competitionId}`}
      title={i18n.t('比赛公告')}
      note={i18n.t('草稿只对管理端可见')}
    >
      {(competition) => <CompetitionAnnouncementManager competition={competition} />}
    </CompetitionAdminShell>
  );
}
