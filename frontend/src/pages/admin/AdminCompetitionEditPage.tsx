import { useNavigate, useParams } from 'react-router-dom';
import { CompetitionAdminShell } from '@/components/admin/CompetitionAdminShell';
import { CompetitionForm } from '@/components/admin/CompetitionForm';

/**
 * /admin/competitions/:id/edit — global managers and holders of a manage grant
 * on this competition. Delegates see no 归档 / 激活 / 授权 controls.
 */
export function AdminCompetitionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const competitionId = Number(id);

  return (
    <CompetitionAdminShell
      competitionId={competitionId}
      command={`edit ${competitionId}`}
      title="编辑赛事"
      note="激活、归档、删除与导出仅全局管理员可用"
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
