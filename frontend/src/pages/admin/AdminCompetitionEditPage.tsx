import i18n from '@/locales/i18n';
import { useNavigate, useParams } from 'react-router-dom';
import { CompetitionAdminShell } from '@/components/admin/CompetitionAdminShell';
import { CompetitionForm } from '@/components/admin/CompetitionForm';

/**
 * /admin/competitions/:id/edit — global managers and holders of a manage grant
 * on this competition. Delegates see no archive / activate / grant controls.
 */
export function AdminCompetitionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const competitionId = Number(id);

  return (
    <CompetitionAdminShell
      competitionId={competitionId}
      command={`edit ${competitionId}`}
      title={i18n.t('编辑赛事')}
      note={i18n.t('激活、归档、删除与导出仅全局管理员可用')}
    >
      {(competition) => (
        <CompetitionForm
          mode="edit"
          competition={competition}
          onCancel={() => navigate('/admin/competitions')}
          onSaved={() => navigate('/admin/competitions')}
        />
      )}
    </CompetitionAdminShell>
  );
}
