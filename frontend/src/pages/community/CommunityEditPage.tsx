import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CommunityTopicForm } from '@/components/community/CommunityTopicForm';
import { useCommunityOutlet } from './CommunityLayout';

export function CommunityEditPage() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { copy, sections } = useCommunityOutlet();

  const back = () => navigate(`/community/${topicId}`);

  return (
    <div className="max-w-3xl mx-auto">
      <header className="border-t-2 border-ink pt-6 mb-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --edit #{topicId}</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15]">
          编辑主题
        </h1>
      </header>
      <CommunityTopicForm
        mode="edit"
        topicId={topicId}
        copy={copy}
        sections={sections}
        onCancel={back}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['community-topic', topicId] });
          qc.invalidateQueries({ queryKey: ['community-topics'] });
          qc.invalidateQueries({ queryKey: ['discussion-revisions', topicId] });
          navigate(`/community/${topicId}`, { replace: true });
        }}
      />
    </div>
  );
}
