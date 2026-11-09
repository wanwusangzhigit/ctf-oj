import i18n from '@/locales/i18n';
import { Link } from 'react-router-dom';
import { AccessSubjectPicker } from './AccessSubjectPicker';
import type { AccessSubject } from '@/types';

export function AccessGrantEditor({
  title,
  description,
  grants,
  onChange,
  allowGroups = true,
  groupsLink,
}: {
  title: string;
  description: string;
  grants: AccessSubject[];
  onChange: (next: AccessSubject[]) => void;
  allowGroups?: boolean;
  groupsLink?: string;
}) {
  return (
    <section className="border border-rule bg-paper-2/40 p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-ink">{title}</h3>
          <p className="mt-0.5 text-2xs text-ink-3 max-w-prose">{description}</p>
        </div>
        {groupsLink && (
          <Link
            to={groupsLink}
            className="text-2xs text-amber hover:underline"
          >
            {i18n.t('管理权限组')}
          </Link>
        )}
      </div>
      <AccessSubjectPicker
        value={grants}
        onChange={onChange}
        allowGroups={allowGroups}
        showPermission
      />
    </section>
  );
}

export function ChallengeAccessEditor({
  grants,
  onChange,
}: {
  grants: AccessSubject[];
  onChange: (next: AccessSubject[]) => void;
}) {
  return (
    <AccessGrantEditor
      title={i18n.t('访问与修改授权')}
      description={i18n.t('只读：隐藏题目对授权对象可见；修改：允许授权对象编辑题目内容、附件、提示与容器源。已发布题目的只读授权不改变公开可见性。')}
      grants={grants}
      onChange={onChange}
      groupsLink="/admin/access-groups"
    />
  );
}
