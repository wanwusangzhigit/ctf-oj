import i18n from '@/locales/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  Modal,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  createAccessGroup,
  deleteAccessGroup,
  listAccessGroups,
  updateAccessGroup,
} from '@/api/access';
import { AccessSubjectList, AccessSubjectPicker } from '@/components/admin/AccessSubjectPicker';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type { AccessGroup, AccessSubject } from '@/types';

export function AdminAccessGroupsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<AccessGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const q = useQuery({
    queryKey: ['access-groups'],
    queryFn: listAccessGroups,
    staleTime: 15_000,
  });

  const deleteMut = useMutation({
    mutationFn: deleteAccessGroup,
    onSuccess: () => {
      toast.success(i18n.t('已删除权限组'));
      qc.invalidateQueries({ queryKey: ['access-groups'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('删除失败')),
  });

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-ink pt-6">
        <div>
          <p className="mb-3 font-mono text-2xs text-ink-3">$ sudo admin --access-groups</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{i18n.t('权限组')}</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-3">
            {i18n.t('把用户与团队归入可复用的组，隐藏题目可直接授权给整组。')}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus className="h-3.5 w-3.5" /> {i18n.t('新建权限组')}
        </Button>
      </header>

      {q.isLoading ? (
        <div className="flex justify-center py-10">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : (q.data?.length ?? 0) === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          {i18n.t('尚未创建权限组。')}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {q.data!.map((g) => (
            <Card key={g.id}>
              <CardHeader className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-medium text-ink">{g.name}</h3>
                  <p className="mt-0.5 text-2xs text-ink-3">
                    <Users className="mr-1 inline h-3 w-3" />{i18n.t('{{v0}} 个对象 · 更新于 {{v1}}', { v0: g.members.length, v1: formatTime(g.updatedAt) })}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setEditing(g)} aria-label={i18n.t('编辑')}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deleteMut.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: i18n.t('删除权限组'),
                        description: i18n.t('权限组「{{v0}}」将被删除，引用该组的题目授权也会同时移除。', { v0: g.name }),
                        confirmText: i18n.t('删除'),
                      });
                      if (ok) deleteMut.mutate(g.id);
                    }}
                    aria-label={i18n.t('删除')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="space-y-3">
                {g.description && <p className="text-sm text-ink-2">{g.description}</p>}
                <div>
                  <p className="mb-1 text-2xs uppercase text-muted">{i18n.t('成员')}</p>
                  <AccessSubjectList subjects={g.members} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <AccessGroupModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

const FORM_ID = 'access-group-form';

function AccessGroupModal({
  initial,
  onClose,
}: {
  initial: AccessGroup | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [members, setMembers] = useState<AccessSubject[]>(initial?.members ?? []);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(i18n.t('请填写名称'));
      return;
    }
    setPending(true);
    try {
      if (initial) {
        await updateAccessGroup(initial.id, { name, description, members });
        toast.success(i18n.t('已保存'));
      } else {
        await createAccessGroup({ name, description, members });
        toast.success(i18n.t('已创建'));
      }
      qc.invalidateQueries({ queryKey: ['access-groups'] });
      onClose();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('保存失败'));
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? i18n.t('编辑权限组') : i18n.t('新建权限组')}
      subtitle={i18n.t('组内可包含用户与团队')}
      width="max-w-xl"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {i18n.t('取消')}
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" loading={pending}>
            {initial ? i18n.t('保存') : i18n.t('创建')}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        <Field label={i18n.t('名称')} htmlFor="group-name">
          <Input
            id="group-name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={i18n.t('说明')} htmlFor="group-desc">
          <Textarea
            id="group-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <Field label={i18n.t('成员')}>
          <AccessSubjectPicker
            value={members}
            onChange={setMembers}
            allowGroups={false}
          />
        </Field>
      </form>
    </Modal>
  );
}
