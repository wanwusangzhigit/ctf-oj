import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, X } from 'lucide-react';
import { Button, Input, Spinner } from '@/components/ui';
import { listAccessGroups, searchAccessSubjects } from '@/api/access';
import type { AccessPermission, AccessSubject, AccessSubjectType } from '@/types';

const TYPE_LABEL: Record<AccessSubjectType, string> = {
  user: '用户',
  team: '团队',
  group: '权限组',
};

export const PERMISSION_LABEL: Record<AccessPermission, string> = {
  view: '只读',
  manage: '修改',
};

export function AccessSubjectPicker({
  value,
  onChange,
  allowGroups = true,
  showPermission = false,
}: {
  value: AccessSubject[];
  onChange: (next: AccessSubject[]) => void;
  allowGroups?: boolean;
  showPermission?: boolean;
}) {
  const [type, setType] = useState<AccessSubjectType>('user');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const searchQ = useQuery({
    queryKey: ['access-subjects', type, debounced],
    queryFn: () => searchAccessSubjects(type as 'user' | 'team', debounced),
    enabled: type !== 'group' && debounced.length > 0,
    staleTime: 30_000,
  });

  const groupsQ = useQuery({
    queryKey: ['access-groups'],
    queryFn: listAccessGroups,
    enabled: allowGroups,
    staleTime: 30_000,
  });

  const results = useMemo(() => {
    const selected = new Set(value.map((v) => `${v.type}:${v.id}`));
    if (type === 'group') {
      const q = debounced.toLowerCase();
      return (groupsQ.data ?? [])
        .filter((g) => !q || g.name.toLowerCase().includes(q))
        .map((g) => ({ type: 'group' as const, id: g.id, name: g.name }))
        .filter((g) => !selected.has(`group:${g.id}`));
    }
    return (searchQ.data ?? []).filter((s) => !selected.has(`${s.type}:${s.id}`));
  }, [type, debounced, groupsQ.data, searchQ.data, value]);

  const loading = type === 'group' ? groupsQ.isLoading : searchQ.isFetching;

  function add(sub: AccessSubject) {
    if (value.some((v) => v.type === sub.type && v.id === sub.id)) return;
    onChange([...value, showPermission ? { ...sub, permission: 'view' } : sub]);
    setQuery('');
  }

  function setPermission(sub: AccessSubject, permission: AccessPermission) {
    onChange(
      value.map((v) =>
        v.type === sub.type && v.id === sub.id ? { ...v, permission } : v,
      ),
    );
  }

  function remove(sub: AccessSubject) {
    onChange(value.filter((v) => !(v.type === sub.type && v.id === sub.id)));
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((sub) => (
            <span
              key={`${sub.type}:${sub.id}`}
              className="inline-flex items-center gap-1 border border-rule bg-paper-2 px-2 py-1 text-2xs"
            >
              <span className="font-mono text-ink-3">{TYPE_LABEL[sub.type]}</span>
              <span className="text-ink">{sub.name}</span>
              {showPermission && (
                <select
                  value={sub.permission ?? 'view'}
                  onChange={(e) =>
                    setPermission(sub, e.target.value as AccessPermission)
                  }
                  className="h-5 bg-paper border border-rule text-2xs text-ink-2"
                  aria-label={`${sub.name} 的权限`}
                >
                  <option value="view">只读</option>
                  <option value="manage">修改</option>
                </select>
              )}
              <button
                type="button"
                onClick={() => remove(sub)}
                className="text-ink-3 hover:text-oxblood"
                aria-label={`移除 ${sub.name}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value as AccessSubjectType);
            setQuery('');
          }}
          className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
        >
          <option value="user">用户</option>
          <option value="team">团队</option>
          {allowGroups && <option value="group">权限组</option>}
        </select>
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={type === 'group' ? '筛选权限组' : '搜索用户名或团队名'}
            className="pl-7"
          />
        </div>
      </div>

      {(debounced.length > 0 || type === 'group') && (
        <div className="max-h-40 overflow-auto border border-rule bg-paper">
          {loading ? (
            <div className="flex justify-center py-4">
              <Spinner className="h-4 w-4 text-ink-3" />
            </div>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-2xs text-ink-3">
              {type === 'group' ? '没有匹配的权限组' : '输入关键字搜索'}
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {results.map((sub) => (
                <li key={`${sub.type}:${sub.id}`}>
                  <button
                    type="button"
                    onClick={() => add(sub)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-paper-2"
                  >
                    <span>
                      <span className="font-mono text-2xs text-ink-3">#{sub.id}</span>{' '}
                      {sub.name}
                    </span>
                    <Plus className="h-3.5 w-3.5 text-ink-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {type !== 'group' && debounced.length === 0 && (
        <p className="text-2xs text-ink-3">输入关键字后选择要添加的对象。</p>
      )}
      {type === 'group' && (
        <p className="text-2xs text-ink-3">
          权限组的成员在「权限组」页面维护；此处只引用组。
        </p>
      )}
    </div>
  );
}

export function AccessSubjectList({ subjects }: { subjects: AccessSubject[] }) {
  if (subjects.length === 0) {
    return <span className="text-2xs text-ink-3">无</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {subjects.map((s) => (
        <span
          key={`${s.type}:${s.id}`}
          className="inline-flex items-center gap-1 border border-rule bg-paper-2 px-1.5 py-0.5 text-2xs"
        >
          <span className="font-mono text-ink-3">{TYPE_LABEL[s.type]}</span>
          {s.name}
          {s.permission && (
            <span className="text-ink-3">· {PERMISSION_LABEL[s.permission]}</span>
          )}
        </span>
      ))}
    </span>
  );
}

export function AddSubjectButton({ onClick }: { onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onClick}>
      <Plus className="h-3.5 w-3.5" /> 添加
    </Button>
  );
}
