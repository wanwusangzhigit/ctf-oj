import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import { Button, Field, Spinner, useToast } from '@/components/ui';
import { AccessGrantEditor } from '@/components/admin/ChallengeAccessEditor';
import {
  getCommunityAdmin,
  setCommunityGrants,
  updateCommunityPolicy,
} from '@/api/community';
import { ApiClientError } from '@/api/client';
import { hasPermission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import type { AccessSubject, CommunityPosting, CommunityVisibility } from '@/types';

const SELECT_CLASS =
  'w-full h-9 px-3 bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber';

export function AdminCommunityPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({
    queryKey: ['admin-community'],
    queryFn: getCommunityAdmin,
    staleTime: 30_000,
  });

  const [visibility, setVisibility] = useState<CommunityVisibility>('public');
  const [posting, setPosting] = useState<CommunityPosting>('members');
  const [grants, setGrants] = useState<AccessSubject[]>([]);

  useEffect(() => {
    if (!q.data) return;
    setVisibility(q.data.visibility);
    setPosting(q.data.posting);
    setGrants(q.data.grants);
  }, [q.data]);

  const saveMut = useMutation({
    mutationFn: async () => {
      await updateCommunityPolicy({ visibility, posting });
      await setCommunityGrants(grants);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-community'] });
      qc.invalidateQueries({ queryKey: ['community-meta'] });
      toast.success('已保存');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  if (q.isLoading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return <p className="text-sm text-ink-3">加载社区配置失败。</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h2 className="text-xl font-semibold tracking-tight text-ink">社区权限</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          控制社区讨论的可见范围与发帖资格。访问授权仅影响社区，不改变题目或赛事权限。
        </p>
      </header>

      <section className="border border-rule bg-paper-2/40 p-4 space-y-4">
        <Field label="可见范围" hint="公开：所有人可读；成员：登录用户可读；授权：仅授权对象可读。">
          <select
            className={SELECT_CLASS}
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as CommunityVisibility)}
          >
            <option value="public">公开可见</option>
            <option value="members">仅登录成员可见</option>
            <option value="restricted">仅授权对象可见</option>
          </select>
        </Field>
        <Field label="发帖权限" hint="成员：所有登录用户可发帖；授权：仅社区 manage 授权对象可发帖。">
          <select
            className={SELECT_CLASS}
            value={posting}
            onChange={(e) => setPosting(e.target.value as CommunityPosting)}
          >
            <option value="members">登录成员可发帖</option>
            <option value="restricted">仅授权对象可发帖</option>
          </select>
        </Field>
      </section>

      <AccessGrantEditor
        title="社区访问与管理授权"
        description="只读：受限社区对授权对象可见；管理：允许发帖、置顶、锁定与删除讨论。管理授权隐含只读。"
        grants={grants}
        onChange={setGrants}
        groupsLink="/admin/access-groups"
      />

      <CommunityCopyMovedLink />

      <div className="flex justify-end">
        <Button type="button" variant="primary" loading={saveMut.isPending} onClick={() => saveMut.mutate()}>
          <Save className="h-3.5 w-3.5" />
          保存
        </Button>
      </div>
    </div>
  );
}

/**
 * Copy overrides now live with the other site settings; pointing there is only
 * useful for someone who can save them.
 */
function CommunityCopyMovedLink() {
  const user = useAuthStore((s) => s.user);
  if (!hasPermission(user, 'settings.manage')) return null;
  return (
    <p className="text-2xs">
      <Link to="/admin/settings/copy">社区文案的编辑入口已移至「站点 › 社区文案」。</Link>
    </p>
  );
}
