import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Lock, Filter } from 'lucide-react';
import { listChallenges } from '@/api/challenge';
import { listCategories } from '@/api/category';
import { Card, CardBody, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';

export function ChallengesPage() {
  const [catId, setCatId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
  const challenges = useQuery({
    queryKey: ['challenges', catId],
    queryFn: () => listChallenges({ categoryId: catId, pageSize: 100 }),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const items = challenges.data?.items ?? [];
    if (!query.trim()) return items;
    const q = query.trim().toLowerCase();
    return items.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.tags || '').toLowerCase().includes(q),
    );
  }, [challenges.data, query]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">题目</h1>
          <p className="text-sm text-muted mt-1">选择一个分类，开始练习。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索题目"
              className="h-9 w-56 pl-3 pr-3 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-accent"
            />
          </div>
        </div>
      </header>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <FilterChip active={!catId} onClick={() => setCatId(undefined)}>
          全部
        </FilterChip>
        {categories.isLoading ? (
          <Spinner className="h-4 w-4 text-muted" />
        ) : (
          categories.data?.map((c) => (
            <FilterChip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>
              {c.name}
            </FilterChip>
          ))
        )}
      </div>

      {challenges.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/challenges/${c.id}`} className="hover:no-underline group">
              <Card className="h-full transition-shadow hover:shadow-popover">
                <CardBody>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate group-hover:text-accent transition-colors">
                        {c.title}
                      </div>
                      <div className="text-2xs text-muted mt-0.5">
                        {c.category?.name ?? '未分类'} · {c.solveCount} 人已解
                      </div>
                    </div>
                    {c.solved ? (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3 w-3" /> 已解
                      </Badge>
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 text-muted">
                        <Lock className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <DifficultyBar level={c.difficulty} />
                    <span className="font-mono text-sm tabular-nums text-fg">
                      {c.baseScore}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 h-8 px-3 rounded-full text-sm whitespace-nowrap border transition-colors',
        active
          ? 'bg-accent text-accent-fg border-transparent'
          : 'bg-surface text-muted border-border hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Filter className="h-3 w-3" />
      {children}
    </button>
  );
}

function DifficultyBar({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(5, level));
  return (
    <div className="flex items-center gap-1">
      <span className="text-2xs text-muted mr-1">难度</span>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            'h-1 w-4 rounded-sm',
            i <= clamped ? 'bg-accent' : 'bg-border',
          )}
        />
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="h-5 w-5 text-muted" />
    </div>
  );
}

function Empty() {
  return (
    <Card>
      <CardBody className="py-20 text-center">
        <div className="text-sm text-muted">该分类下暂无题目。</div>
      </CardBody>
    </Card>
  );
}
