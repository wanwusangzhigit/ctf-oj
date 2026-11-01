import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui';
import { CommunityGuidelines } from '@/components/community/CommunityGuidelines';
import { CommunityTopicList } from '@/components/community/CommunityTopicList';
import { TopicFilters } from '@/components/community/TopicFilters';
import { splitTags } from '@/components/community/TopicRow';
import { listDiscussions, type TopicSort } from '@/api/discussion';
import { useCommunityOutlet } from './CommunityLayout';
import { postingLabel, visibilityLabel } from '@/lib/communityCopy';

export function CommunityListPage() {
  const { meta, copy } = useCommunityOutlet();
  const [params, setParams] = useSearchParams();

  const sortParam = params.get('sort');
  const sort: TopicSort =
    sortParam === 'newest' || sortParam === 'oldest' ? sortParam : 'last_reply';
  const tag = params.get('tag') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const listQ = useQuery({
    queryKey: ['community-topics', page, sort, tag, q],
    queryFn: () =>
      listDiscussions(
        { scope: 'community' },
        { page, pageSize: 20, sort, tag: tag || undefined, q: q || undefined },
      ),
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

  return (
    <>
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --index</p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
              {copy.title}
            </h1>
            <p className="mt-2 text-ink-2 max-w-prose">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={meta.visibility === 'public' ? 'success' : 'neutral'}>
              {visibilityLabel(copy, meta.visibility)}
            </Badge>
            <Badge tone={meta.posting === 'restricted' ? 'warning' : 'neutral'}>
              {postingLabel(copy, meta.posting)}
            </Badge>
          </div>
        </div>
      </header>

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
              page={page}
              totalPages={totalPages}
              onParam={setParam}
              onClearFilters={() => setParams(new URLSearchParams())}
            />
          </div>
        </main>

        <CommunityGuidelines
          meta={meta}
          copy={copy}
          tagCounts={tagCounts}
          activeTag={tag}
          onTag={setParam}
        />
      </div>
    </>
  );
}
