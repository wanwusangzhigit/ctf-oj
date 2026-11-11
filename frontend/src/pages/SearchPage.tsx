import i18n from '@/locales/i18n';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon } from 'lucide-react';
import { Input, Spinner } from '@/components/ui';
import { search } from '@/api/search';
import type { SearchHit } from '@/types';

const SECTIONS: { type: SearchHit['type']; label: string }[] = [
  { type: 'challenge', label: i18n.t('题目') },
  { type: 'user', label: i18n.t('用户') },
  { type: 'team', label: i18n.t('团队') },
  { type: 'announcement', label: i18n.t('公告') },
];

function href(hit: SearchHit): string {
  switch (hit.type) {
    case 'challenge':
      return `/challenges/${hit.id}`;
    case 'user':
      return `/users/${hit.id}`;
    case 'team':
      return `/teams/${hit.id}`;
    default:
      return `/announcements/${hit.id}`;
  }
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initial = params.get('q') ?? '';
  const [input, setInput] = useState(initial);
  const q = initial.trim();

  const result = useQuery({
    queryKey: ['search', q],
    queryFn: () => search(q, 8),
    enabled: q.length > 0,
    staleTime: 30_000,
  });

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-6">
        <p className="font-mono text-2xs text-ink-3 mb-2">$ grep -ri</p>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{i18n.t('全局搜索')}</h1>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink-3" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={i18n.t('题目、用户、团队、公告')}
            className="pl-8"
          />
        </div>
      </form>

      {q.length === 0 ? (
        <p className="mt-8 text-sm text-ink-3">{i18n.t('输入关键词开始搜索。')}</p>
      ) : result.isLoading ? (
        <div className="mt-10 flex justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : (result.data?.length ?? 0) === 0 ? (
        <p className="mt-8 text-sm text-ink-3">{i18n.t('没有找到与「{{v0}}」相关的结果。', { v0: q })}</p>
      ) : (
        <div className="mt-8 space-y-8">
          {SECTIONS.map((section) => {
            const hits = result.data?.filter((h) => h.type === section.type) ?? [];
            if (hits.length === 0) return null;
            return (
              <section key={section.type}>
                <div className="border-b border-rule pb-2 mb-2">
                  <h2 className="text-sm font-medium text-ink">{section.label}</h2>
                </div>
                <ul>
                  {hits.map((hit) => (
                    <li key={`${hit.type}-${hit.id}`} className="border-b border-rule">
                      <Link
                        to={href(hit)}
                        className="flex items-baseline justify-between gap-3 py-2.5 hover:no-underline"
                      >
                        <span className="text-sm text-ink truncate">{hit.title}</span>
                        {hit.subtitle && (
                          <span className="font-mono text-2xs text-ink-3 truncate shrink-0 max-w-[45%]">
                            {hit.subtitle}
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
