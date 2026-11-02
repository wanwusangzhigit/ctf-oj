import { CommunityCopyEditor } from '@/components/admin/CommunityCopyEditor';
import { useAdminSettings } from '@/hooks/useAdminSettings';

export function AdminSettingsCopyPage() {
  const { copyOverrides } = useAdminSettings();

  return (
    <div className="max-w-2xl space-y-4">
      <p className="text-2xs text-ink-3">
        覆盖社区板块显示的文本。留空即使用内置默认，无需重新构建前端。
      </p>
      <CommunityCopyEditor overrides={copyOverrides} />
    </div>
  );
}
