import { useNavigate } from 'react-router-dom';
import { CommunityTopicForm } from '@/components/community/CommunityTopicForm';
import { useCommunityOutlet } from './CommunityLayout';

export function CommunityNewPage() {
  const navigate = useNavigate();
  const { meta, copy } = useCommunityOutlet();

  if (!meta.canPost) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border border-rule bg-paper-2/40 p-6">
          <h1 className="text-sm font-medium text-ink">{copy.restricted_title}</h1>
          <p className="mt-2 text-sm text-ink-3">{copy.restricted_granted}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <header className="border-t-2 border-ink pt-6 mb-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --new</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15]">
          {copy.new_topic}
        </h1>
      </header>
      <CommunityTopicForm
        mode="create"
        copy={copy}
        onCreated={(id) => navigate(`/community/${id}`, { replace: true })}
        onCancel={() => navigate('/community')}
      />
    </div>
  );
}
