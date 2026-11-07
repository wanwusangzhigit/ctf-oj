import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, useToast } from '@/components/ui';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { updateSectionCopy } from '@/api/community';
import { ApiClientError } from '@/api/client';
import { useCommunityOutlet } from './CommunityLayout';

// Limits mirror service.normalizeSectionInput: a form that accepts more than the
// server will store only turns a 400 into a surprise.
const schema = z.object({
  name: z.string().trim().min(1, '请输入板块名').max(64, '板块名最长 64 字符'),
  blurb: z.string().trim().max(255, '简介最长 255 字符'),
  guidelinesMd: z.string().max(5000, '版规最长 5000 字符'),
});

type FormValues = z.infer<typeof schema>;

export function CommunitySectionEditPage() {
  const { id } = useParams<{ id: string }>();
  const sectionId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { sections } = useCommunityOutlet();
  const section = sections.find((s) => s.id === sectionId);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: section?.name ?? '',
      blurb: section?.blurb ?? '',
      guidelinesMd: section?.guidelinesMd ?? '',
    },
  });

  const mut = useMutation({
    mutationFn: (values: FormValues) => updateSectionCopy(sectionId, values),
    onSuccess: () => {
      toast.success('板块文案已保存');
      // The name and blurb feed the tab row, the list header and every row chip.
      qc.invalidateQueries({ queryKey: ['community-meta'] });
      qc.invalidateQueries({ queryKey: ['community-topics'] });
      qc.invalidateQueries({ queryKey: ['community-topic'] });
      navigate(`/community?section=${sectionId}`, { replace: true });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  const back = () => navigate(`/community?section=${sectionId}`);

  if (!Number.isInteger(sectionId) || sectionId <= 0) {
    return <Notice title="板块不存在" body="链接里的板块编号无效。" />;
  }
  if (!section) {
    return (
      <Notice
        title="无法编辑该板块"
        body="它可能已被删除，或者你既不是全站管理员也没有该板块的管理授权。"
      />
    );
  }
  if (!section.canManage) {
    return (
      <Notice
        title="无法编辑该板块"
        body="编辑板块文案需要该板块的管理授权。若确实需要，请联系社区管理员在「社区 › 板块」中授予「修改」。"
      />
    );
  }

  const guidelines = watch('guidelinesMd');

  return (
    <div className="max-w-3xl mx-auto">
      <header className="border-t-2 border-ink pt-6 mb-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --board {section.id} --edit</p>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15]">
          编辑「{section.name}」文案
        </h1>
        <p className="mt-2 text-sm text-ink-3">
          这里只改本板块的名称、简介与版规。新增或删除板块、板块策略与授权仍由全站管理员在社区设置中处理。
        </p>
      </header>

      <form
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit((values) => mut.mutate(values))}
      >
        <Field label="板块名" htmlFor="section-name" error={errors.name?.message}>
          <Input
            id="section-name"
            maxLength={64}
            invalid={!!errors.name}
            {...register('name')}
          />
        </Field>
        <Field
          label="简介"
          htmlFor="section-blurb"
          hint="显示在板块标题下方，最长 255 字符。"
          error={errors.blurb?.message}
        >
          <Input
            id="section-blurb"
            maxLength={255}
            placeholder="这个板块用来做什么"
            invalid={!!errors.blurb}
            {...register('blurb')}
          />
        </Field>
        <Field
          label="版规"
          htmlFor="section-guidelines"
          hint="Markdown，留空则沿用全站版规。"
          error={errors.guidelinesMd?.message}
        >
          <MarkdownEditor
            id="section-guidelines"
            rows={10}
            value={guidelines}
            onChange={(value) => setValue('guidelinesMd', value)}
            placeholder="本板块的发帖规则…"
            invalid={!!errors.guidelinesMd}
          />
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-2xs text-ink-3">保存后本板块的读者会立即看到新文案。</span>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={back}>
              取消
            </Button>
            <Button type="submit" size="sm" loading={mut.isPending}>
              保存
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="border-t-2 border-ink pt-6">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-ink-3">{body}</p>
      </div>
    </div>
  );
}
