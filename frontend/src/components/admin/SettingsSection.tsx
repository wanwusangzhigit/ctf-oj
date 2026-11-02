import { Save } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * Form chrome shared by the /admin/settings tab screens.
 */
export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-rule pt-5">
      <h3 className="text-sm font-medium text-ink mb-3">{title}</h3>
      <div className="space-y-4 max-w-2xl">{children}</div>
    </section>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <span className="mt-0.5 inline-flex h-4 w-7 rounded-full border border-rule bg-paper-2 relative shrink-0 transition-colors group-hover:border-rule-strong">
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full transition-all ${
            checked ? 'left-3 bg-amber' : 'left-0.5 bg-ink-3'
          }`}
        />
      </span>
      <span className="flex-1">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-2xs text-ink-3 mt-0.5">{description}</span>
      </span>
    </label>
  );
}

/**
 * Each screen writes only the keys it owns, so the save action is per-screen.
 */
export function SaveBar({
  dirty,
  pending,
  onSave,
}: {
  dirty: boolean;
  pending: boolean;
  onSave: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-rule pt-4">
      <Button variant="primary" onClick={onSave} loading={pending} disabled={!dirty}>
        <Save className="h-3.5 w-3.5" />
        保存本页
      </Button>
      <span className="text-2xs text-ink-3">
        {dirty ? '有未保存的更改' : '所有更改已保存'}
      </span>
    </div>
  );
}
