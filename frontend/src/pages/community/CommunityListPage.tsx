import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Lock, PencilLine } from 'lucide-react';
import { Badge } from '@/components/ui';
import { CommunityGuidelines } from '@/components/community/CommunityGuidelines';
import { CommunityTopicList } from '@/components/community/CommunityTopicList';
import { TopicFilters } from '@/components/community/TopicFilters';
import { splitTags } from '@/components/community/TopicRow';
import { listDiscussions, type TopicSort } from '@/api/discussion';
import { useCommunityOutlet } from './CommunityLayout';
import { postingLabel, visibilityLabel } from '@/lib/communityCopy';

export function CommunityListPage() {
  const { meta, copy, sections } = useCommunityOutlet();
  const [params, setParams] = useSearchParams();

  const sortParam = params.get('sort');
  const sort: TopicSort =
    sortParam === 'newest' || sortParam === 'oldest' ? sortParam : 'last_reply';
  const tag = params.get('tag') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const sectionId = Number(params.get('section')) || 0;
  const section = sections.find((s) => s.id === sectionId);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  // An id in the URL that matches no board is treated as 全部. A view the
  // caller cannot read must not fire a request that is guaranteed to 403.
  const denied = section ? !section.canView : !meta.canView;
  const listQ = useQuery({
    queryKey: ['community-topics', sectionId, page, sort, tag, q],
    queryFn: () =>
      listDiscussions(
        { scope: 'community', id: sectionId || undefined },
        { page, pageSize: 20, sort, tag: tag || undefined, q: q || undefined },
      ),
    enabled: !denied,
    staleTime: 15_000,
  });

  const topics = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const pageSize = listQ.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of topics) {
      for (const name of splitTags(t.tags)) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [topics]);

  // Both views report the policy that actually governs what is on screen.
  const visibility = section?.visibility ?? meta.visibility;
  const posting = section?.posting ?? meta.posting;

  return (
    <>
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          {section ? `$ community --board ${section.id}` : '$ community --index'}
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
              {section?.name ?? copy.title}
            </h1>
            <p className="mt-2 text-ink-2 max-w-prose">{section?.blurb ?? copy.subtitle}</p>
          </div>
          {!denied && (
            <div className="flex items-center gap-2">
              <Badge tone={visibility === 'public' ? 'success' : 'neutral'}>
                {visibilityLabel(copy, visibility)}
              </Badge>
              <Badge tone={posting === 'restricted' ? 'warning' : 'neutral'}>
                {postingLabel(copy, posting)}
              </Badge>
              {section?.canManage && (
                <Link
                  to={`/community/sections/${section.id}/edit`}
                  className="inline-flex h-6 items-center gap-1 text-xs text-ink-3 hover:text-amber hover:no-underline"
                >
                  <PencilLine className="h-3 w-3" />
                  编辑板块文案
                </Link>
              )}
            </div>
          )}
        </div>
      </header>

      {denied ? (
        <div className="border border-rule bg-paper-2/40 p-6">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="h-4 w-4 text-ink-3" />
            <h2 className="text-sm font-medium">{copy.restricted_title}</h2>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            {visibility === 'members' ? copy.restricted_members : copy.restricted_granted}
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_15rem] gap-8 lg:gap-10 items-start">
          <main className="min-w-0">
            <TopicFilters
              copy={copy}
              sort={sort}
              tag={tag}
              q={q}
              total={total}
              onParam={setParam}
            />
            <div className="mt-2">
              <CommunityTopicList
                topics={topics}
                isLoading={listQ.isLoading}
                isError={listQ.isError}
                copy={copy}
                filtered={!!q || !!tag}
                sections={section ? [] : sections}
                page={page}
                totalPages={totalPages}
                onParam={setParam}
                onClearFilters={() => {
                  // The board is part of the view, not a filter: clearing q/tag
                  // keeps the reader where they are.
                  const next = new URLSearchParams(params);
                  next.delete('q');
                  next.delete('tag');
                  next.delete('page');
                  setParams(next);
                }}
              />
            </div>
          </main>

          <CommunityGuidelines
            meta={meta}
            copy={copy}
            section={section}
            tagCounts={tagCounts}
            activeTag={tag}
            onTag={setParam}
          />
        </div>
      )}
    </>
  );
}
