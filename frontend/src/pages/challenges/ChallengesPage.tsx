import i18n from '@/locales/i18n';
import { useDeferredValue, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Search } from 'lucide-react';
import { listChallenges } from '@/api/challenge';
import { listCategories } from '@/api/category';
import { Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { ChallengeView } from '@/types';

/**
 * Challenges — presented as a directory listing, not a card grid.
 *
 *   ID    TITLE                                CATEGORY       SOLVES     SCORE
 *   001   SQL Injection Basics                web            142        300
 *   002   Buffer Overflow                     pwn            38         700
 *
 * Filter chips above; everything ruled; mono numerals; left-aligned prose.
 */
export function ChallengesPage() {
  const [catId, setCatId] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState('');
  const [difficulty, setDifficulty] = useState(0);
  const [type, setType] = useState('');
  const [solved, setSolved] = useState('');
  const deferredQuery = useDeferredValue(query);

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: listCategories,
    staleTime: 5 * 60_000,
  });
  const challenges = useQuery({
    queryKey: ['challenges', catId, deferredQuery, difficulty, type, solved],
    queryFn: () =>
      listChallenges({
        categoryId: catId,
        q: deferredQuery.trim() || undefined,
        difficulty: difficulty || undefined,
        type: (type as 'static' | 'container') || undefined,
        solved: solved === '' ? undefined : solved === 'true',
        pageSize: 100,
      }),
    staleTime: 30_000,
  });

  const filtered = challenges.data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          $ ls /challenges
        </p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
              {i18n.t('题目')}
            </h1>
            <p className="mt-2 text-ink-2 max-w-prose">
              {i18n.t('选择分类开始练习 —— 提交 flag、启动容器实例、登上榜单。')}
            </p>
          </div>
          <div className="relative">
            <Search
              aria-hidden
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={i18n.t('搜索标题 / 标签')}
              className="h-9 w-56 pl-8 pr-3 bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber transition-colors"
            />
          </div>
        </div>
      </header>

      <div
        role="tablist"
        aria-label={i18n.t('分类')}
        className="flex items-center gap-1 mb-2 flex-wrap"
      >
        <FilterChip active={!catId} onClick={() => setCatId(undefined)}>
          {i18n.t('全部')}
        </FilterChip>
        {categories.isLoading ? (
          <Spinner className="h-4 w-4 text-ink-3" />
        ) : (
          categories.data?.map((c) => (
            <FilterChip
              key={c.id}
              active={catId === c.id}
              onClick={() => setCatId(c.id)}
            >
              {c.name}
            </FilterChip>
          ))
        )}
      </div>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(Number(e.target.value))}
          className="h-8 px-2 bg-paper border border-rule rounded-sm text-sm"
        >
          <option value={0}>{i18n.t('全部难度')}</option>
          <option value={1}>{i18n.t('难度 1')}</option>
          <option value={2}>{i18n.t('难度 2')}</option>
          <option value={3}>{i18n.t('难度 3')}</option>
          <option value={4}>{i18n.t('难度 4')}</option>
          <option value={5}>{i18n.t('难度 5')}</option>
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-8 px-2 bg-paper border border-rule rounded-sm text-sm"
        >
          <option value="">{i18n.t('全部类型')}</option>
          <option value="static">{i18n.t('静态附件题')}</option>
          <option value="container">{i18n.t('容器题')}</option>
        </select>
        <select
          value={solved}
          onChange={(e) => setSolved(e.target.value)}
          className="h-8 px-2 bg-paper border border-rule rounded-sm text-sm"
        >
          <option value="">{i18n.t('全部状态')}</option>
          <option value="true">{i18n.t('已解出')}</option>
          <option value="false">{i18n.t('未解出')}</option>
        </select>
      </div>

      {challenges.isLoading ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty />
      ) : (
        <ChallengeTable items={filtered} />
      )}
    </div>
  );
}

/**
 * The table itself: ruled rows, mono numerals, single hairline column headers.
 * Reads like a Unix directory listing — the data IS the design.
 */
function ChallengeTable({ items }: { items: ChallengeView[] }) {
  return (
    <div className="border-t border-rule">
      {/* column header — minimal, lowercase, mono */}
      <div className="hidden md:grid grid-cols-[3.5rem_1fr_9rem_6rem_5rem] gap-x-4 py-2 border-b border-rule-strong font-mono text-2xs text-ink-3">
        <span>id</span>
        <span>title</span>
        <span>category</span>
        <span className="text-right">solves</span>
        <span className="text-right">score</span>
      </div>

      <ul>
        {items.map((c) => (
            <li key={c.id}>
              <Link
                to={`/challenges/${c.id}`}
                className="group grid grid-cols-[3.5rem_1fr_auto] md:grid-cols-[3.5rem_1fr_9rem_6rem_5rem] gap-x-4 items-center py-3 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline"
              >
                <span className="font-mono text-2xs text-ink-3 tabular-nums">
                  {String(c.id).padStart(3, '0')}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={cn(
                        'font-medium truncate text-ink transition-colors min-w-0',
                        'group-hover:text-amber',
                      )}
                    >
                      {c.title}
                    </span>
                    {c.solved && (
                      <Badge tone="success">
                        <CheckCircle2 className="h-3 w-3" />
                        {i18n.t('已通过')}
                      </Badge>
                    )}
                    {c.isDynamic && (
                      <span className="hidden sm:inline text-2xs font-mono text-ink-3 border border-rule px-1 py-px rounded-sm">
                        container
                      </span>
                    )}
                  </div>
                  <div className="md:hidden mt-1 flex items-center gap-3 text-2xs font-mono text-ink-3 tabular-nums">
                    <span>{c.category?.name ?? 'uncategorized'}</span>
                    <span>{c.solveCount} solves</span>
                    <span>{c.baseScore} pts</span>
                  </div>
                </div>
                <span className="hidden md:block font-mono text-sm text-ink-2 truncate">
                  {c.category?.name ?? '—'}
                </span>
                <span className="hidden md:block font-mono text-sm text-ink-3 tabular-nums text-right">
                  {c.solveCount}
                </span>
                <span className="hidden md:block font-mono text-sm text-ink tabular-nums text-right">
                  {c.baseScore}
                </span>
              </Link>
            </li>
          ))}
      </ul>
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
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 h-8 px-3 text-sm rounded-sm border transition-colors',
        active
          ? 'bg-ink text-paper border-ink'
          : 'bg-paper text-ink-2 border-rule hover:border-rule-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <Spinner className="h-5 w-5 text-ink-3" />
    </div>
  );
}

function Empty() {
  return (
    <div className="border-t border-rule py-16 text-center text-sm text-ink-3">
      {i18n.t('该分类下暂无题目。')}
    </div>
  );
}
