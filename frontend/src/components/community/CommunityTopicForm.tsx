import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Field, Input, Spinner, useToast } from '@/components/ui';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import {
  createDiscussion,
  getDiscussionContent,
  updateDiscussionContent,
} from '@/api/discussion';
import { ApiClientError } from '@/api/client';
import type { CommunityCopy } from '@/lib/communityCopy';

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, '请输入主题标题')
    .max(160, '标题最长 160 字符'),
  contentMd: z
    .string()
    .trim()
    .min(1, '请输入正文')
    .max(5000, '正文最长 5000 字符'),
});

type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { title: '', contentMd: '' };

/**
 * CommunityTopicForm — shared body for /community/new and /community/:id/edit.
 *
 * create → POST then onCreated(id); edit → PATCH /discussions/:id/content
 * after loading the current content without inflating the view counter.
 * Navigation is left to the caller so the two routes can differ.
 */
export function CommunityTopicForm({
  mode,
  topicId,
  copy,
  onCreated,
  onSaved,
  onCancel,
}: {
  mode: 'create' | 'edit';
  topicId?: number;
  copy: CommunityCopy;
  onCreated?: (id: number) => void;
  onSaved?: () => void;
  onCancel?: () => void;
}) {
  const toast = useToast();
  const isEdit = mode === 'edit';

  const contentQ = useQuery({
    queryKey: ['discussion-content', topicId],
    queryFn: () => getDiscussionContent(topicId as number),
    enabled: isEdit && !!topicId,
    staleTime: 10_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  // The edit form must not flash empty fields while the topic loads.
  useEffect(() => {
    if (contentQ.data) {
      reset({
        title: contentQ.data.title ?? '',
        contentMd: contentQ.data.contentMd,
      });
    }
  }, [contentQ.data, reset]);

  const mut = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? updateDiscussionContent(topicId as number, values)
        : createDiscussion({ scope: 'community' }, values.contentMd, undefined, values.title),
    onSuccess: (d) => {
      toast.success(isEdit ? '修改已保存' : '主题已发布');
      if (isEdit) {
        onSaved?.();
        return;
      }
      reset(EMPTY);
      onCreated?.(d.id);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : isEdit ? '保存失败' : '发布失败'),
  });

  const onSubmit = handleSubmit((values) => mut.mutate(values));

  if (isEdit && contentQ.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (isEdit && (contentQ.isError || !contentQ.data)) {
    return (
      <div className="border border-rule bg-paper-2/40 p-6">
        <h2 className="text-sm font-medium text-ink">无法编辑该主题</h2>
        <p className="mt-2 text-sm text-ink-3">
          它可能已被删除，或者你既不是作者也没有社区管理权限。
        </p>
      </div>
    );
  }

  const content = watch('contentMd');

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="主题标题" htmlFor="topic-title" error={errors.title?.message}>
        <Input
          id="topic-title"
          maxLength={160}
          placeholder={copy.topic_title_placeholder}
          invalid={!!errors.title}
          {...register('title')}
        />
      </Field>
      <Field label="正文" htmlFor="topic-content" error={errors.contentMd?.message}>
        <MarkdownEditor
          id="topic-content"
          rows={12}
          value={content}
          onChange={(value) => setValue('contentMd', value)}
          placeholder={copy.topic_content_placeholder}
          invalid={!!errors.contentMd}
        />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-ink-3">{isEdit ? copy.edit_hint : copy.compose_hint}</span>
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            loading={mut.isPending}
            disabled={!content || !!errors.title || !!errors.contentMd}
          >
            {isEdit ? copy.edit_submit : copy.compose_submit}
          </Button>
        </div>
      </div>
    </form>
  );
}
