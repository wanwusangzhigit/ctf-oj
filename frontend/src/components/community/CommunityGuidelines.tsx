import { Badge } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { postingLabel, visibilityLabel, type CommunityCopy } from '@/lib/communityCopy';
import { cn } from '@/lib/utils';
import type { CommunityMeta } from '@/types';

export function CommunityGuidelines({
  meta,
  copy,
  tagCounts,
  activeTag,
  onTag,
}: {
  meta: CommunityMeta;
  copy: CommunityCopy;
  tagCounts: [string, number][];
  activeTag: string;
  onTag: (key: string, value: string) => void;
}) {
  return (
    <aside className="space-y-6 lg:border-l lg:border-rule lg:pl-6">
      <section>
        <h2 className="font-mono text-2xs text-ink-3 mb-2">{copy.guidelines_title}</h2>
        <Markdown className="text-xs text-ink-2">{copy.guidelines_body}</Markdown>
      </section>
      <section>
        <h2 className="font-mono text-2xs text-ink-3 mb-2">{copy.policy_title}</h2>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={meta.visibility === 'public' ? 'success' : 'neutral'}>
            {visibilityLabel(copy, meta.visibility)}
          </Badge>
          <Badge tone={meta.posting === 'restricted' ? 'warning' : 'neutral'}>
            {postingLabel(copy, meta.posting)}
          </Badge>
        </div>
      </section>
      {tagCounts.length > 0 && (
        <section>
          <h2 className="font-mono text-2xs text-ink-3 mb-2">本页标签</h2>
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map(([name, count]) => (
              <button
                key={name}
                type="button"
                onClick={() => onTag('tag', name === activeTag ? '' : name)}
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-sm font-mono text-2xs transition-colors',
                  name === activeTag
                    ? 'border-amber text-amber'
                    : 'border-rule text-ink-3 hover:border-rule-strong hover:text-ink',
                )}
              >
                #{name}
                <span className="tabular-nums">{count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
