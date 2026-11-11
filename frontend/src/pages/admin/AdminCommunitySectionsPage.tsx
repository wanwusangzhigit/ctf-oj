import i18n from '@/locales/i18n';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  Input,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@/components/ui';
import { AccessGrantEditor } from '@/components/admin/ChallengeAccessEditor';
import {
  adminListSections,
  createSection,
  deleteSection,
  listSectionGrants,
  setSectionGrants,
  updateSection,
} from '@/api/community';
import { ApiClientError } from '@/api/client';
import type { AccessSubject, CommunitySectionAdmin } from '@/types';

const SELECT_CLASS =
  'w-full h-9 px-3 bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber';

// Limits mirror service.normalizeSectionInput. Empty policy strings mean
// "inherit the station-wide setting", which is the common case.
const schema = z.object({
  name: z.string().trim().min(1, i18n.t('请输入板块名')).max(64, i18n.t('板块名最长 64 字符')),
  blurb: z.string().trim().max(255, i18n.t('简介最长 255 字符')),
  guidelinesMd: z.string().max(5000, i18n.t('版规最长 5000 字符')),
  visibility: z.enum(['', 'public', 'members', 'restricted']),
  posting: z.enum(['', 'members', 'restricted']),
  sortOrder: z.coerce.number().int().min(0),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = {
  name: '',
  blurb: '',
  guidelinesMd: '',
  visibility: '',
  posting: '',
  sortOrder: 0,
};

export function AdminCommunitySectionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<CommunitySectionAdmin | null>(null);
  const [grants, setGrants] = useState<AccessSubject[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const list = useQuery({
    queryKey: ['admin-community-sections'],
    queryFn: adminListSections,
    staleTime: 30_000,
  });

  const editingId = editing?.id ?? 0;
  const grantsQ = useQuery({
    queryKey: ['admin-community-section-grants', editingId],
    queryFn: () => listSectionGrants(editingId),
    enabled: editingId > 0,
  });

  useEffect(() => {
    if (grantsQ.data) setGrants(grantsQ.data);
  }, [grantsQ.data]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['admin-community-sections'] });
    // The tab row, the list header and every row chip read from here.
    qc.invalidateQueries({ queryKey: ['community-meta'] });
    qc.invalidateQueries({ queryKey: ['community-topics'] });
  };

  const saveMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (editing) {
        const section = await updateSection(editing.id, values);
        // Two endpoints, two screens' worth of intent: the row first, then its
        // grant list, the way the station page already does it.
        await setSectionGrants(editing.id, grants);
        return section;
      }
      return createSection(values);
    },
    onSuccess: () => {
      toast.success(editing ? i18n.t('板块已更新') : i18n.t('板块已创建'));
      invalidate();
      cancelEdit();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('保存失败')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteSection(id),
    onSuccess: (_data, id) => {
      toast.success(i18n.t('板块已删除'));
      invalidate();
      if (editing?.id === id) cancelEdit();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('删除失败')),
  });

  function startEdit(section: CommunitySectionAdmin) {
    setEditing(section);
    setGrants([]);
    reset({
      name: section.name,
      blurb: section.blurb,
      guidelinesMd: section.guidelinesMd,
      visibility: section.visibility,
      posting: section.posting,
      sortOrder: section.sortOrder,
    });
  }

  function cancelEdit() {
    setEditing(null);
    setGrants([]);
    reset(EMPTY);
  }

  if (list.isLoading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (list.isError || !list.data) {
    return <p className="text-sm text-ink-3">{i18n.t('加载板块失败。')}</p>;
  }

  const sections = list.data;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] items-start">
      <section className="border border-rule bg-paper-2/40 p-4 space-y-4">
        <div>
          <h3 className="text-sm font-medium text-ink">
            {editing ? i18n.t('编辑「{{v0}}」', { v0: editing.name }) : i18n.t('新建板块')}
          </h3>
          <p className="mt-0.5 text-2xs text-ink-3">
            {i18n.t('发帖时必须选择板块。策略留空即沿用全站设置；板块文案也可以由板块管理员在公开侧修改。')}
          </p>
        </div>
        <form
          className="space-y-4"
          noValidate
          onSubmit={handleSubmit((values) => saveMut.mutate(values))}
        >
          <Field label={i18n.t('板块名')} htmlFor="section-name" error={errors.name?.message}>
            <Input
              id="section-name"
              maxLength={64}
              placeholder={i18n.t('灌水版')}
              invalid={!!errors.name}
              {...register('name')}
            />
          </Field>
          <Field label={i18n.t('简介')} htmlFor="section-blurb" error={errors.blurb?.message}>
            <Input
              id="section-blurb"
              maxLength={255}
              placeholder={i18n.t('一句话说明这个板块用来做什么')}
              invalid={!!errors.blurb}
              {...register('blurb')}
            />
          </Field>
          <Field
            label={i18n.t('版规')}
            htmlFor="section-guidelines"
            hint={i18n.t('Markdown，留空则沿用全站版规。')}
            error={errors.guidelinesMd?.message}
          >
            <Textarea
              id="section-guidelines"
              rows={4}
              {...register('guidelinesMd')}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label={i18n.t('可见范围')} htmlFor="section-visibility">
              <select id="section-visibility" className={SELECT_CLASS} {...register('visibility')}>
                <option value="">{i18n.t('沿用全站')}</option>
                <option value="public">{i18n.t('公开可见')}</option>
                <option value="members">{i18n.t('仅登录成员可见')}</option>
                <option value="restricted">{i18n.t('仅授权对象可见')}</option>
              </select>
            </Field>
            <Field label={i18n.t('发帖权限')} htmlFor="section-posting">
              <select id="section-posting" className={SELECT_CLASS} {...register('posting')}>
                <option value="">{i18n.t('沿用全站')}</option>
                <option value="members">{i18n.t('登录成员可发帖')}</option>
                <option value="restricted">{i18n.t('仅授权对象可发帖')}</option>
              </select>
            </Field>
          </div>
          <Field label={i18n.t('排序权重')} htmlFor="section-sort" hint={i18n.t('数值小的板块排在前面。')} error={errors.sortOrder?.message}>
            <Input id="section-sort" type="number" {...register('sortOrder')} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={saveMut.isPending} className="flex-1">
              {editing ? <Save className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editing ? i18n.t('保存板块') : i18n.t('创建板块')}
            </Button>
            {editing && (
              <Button type="button" size="sm" variant="outline" onClick={cancelEdit}>
                {i18n.t('取消')}
              </Button>
            )}
          </div>
        </form>

        {editing && (
          <AccessGrantEditor
            title={i18n.t('「{{v0}}」的管理授权', { v0: editing.name })}
            description={i18n.t('只读：该板块对授权对象可见；管理：允许编辑本板块文案并 moderation 本板块帖子。板块授权不包含新增、删除、排序与策略修改。')}
            grants={grants}
            onChange={setGrants}
            groupsLink="/admin/access-groups"
          />
        )}
        {editing && grantsQ.isLoading && (
          <p className="text-2xs text-ink-3">{i18n.t('正在读取该板块的授权…')}</p>
        )}
      </section>

      <section className="border border-rule">
        <header className="px-4 py-3 border-b border-rule flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-medium text-ink">{i18n.t('已有板块（{{v0}}）', { v0: sections.length })}</h3>
          <span className="font-mono text-2xs text-ink-3">{i18n.t('排序权重 · 主题数')}</span>
        </header>
        {sections.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-3">
            {i18n.t('还没有板块，使用左侧表单创建第一个。发帖需要先有板块。')}
          </p>
        ) : (
          <ul className="divide-y divide-rule">
            {sections.map((section) => (
              <li key={section.id} className="px-4 py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{section.name}</span>
                    <Badge tone={section.visibility === 'restricted' ? 'warning' : 'neutral'}>
                      {section.visibility || i18n.t('沿用全站')}
                    </Badge>
                    <Badge tone={section.posting === 'restricted' ? 'warning' : 'neutral'}>
                      {section.posting || i18n.t('沿用全站')}
                    </Badge>
                    <span className="font-mono text-2xs text-ink-3">{i18n.t('#{{v0}} · {{v1}} 主题', { v0: section.sortOrder, v1: section.topicCount })}</span>
                  </div>
                  {section.blurb && (
                    <p className="mt-1 text-2xs text-ink-3 line-clamp-2">{section.blurb}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={i18n.t('编辑{{v0}}', { v0: section.name })}
                    onClick={() => startEdit(section)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={i18n.t('删除{{v0}}', { v0: section.name })}
                    onClick={async () => {
                      const ok = await confirm({
                        title: i18n.t('删除板块'),
                        description: i18n.t('删除板块「{{v0}}」？板块下仍有主题时删除会被拒绝。', { v0: section.name }),
                        confirmText: i18n.t('删除'),
                      });
                      if (!ok) return;
                      deleteMut.mutate(section.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
