import { Link, Outlet, useLocation, useOutletContext, useSearchParams } from 'react-router-dom';
import { Lock, Plus } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useCommunityCopy } from '@/hooks/useCommunityCopy';
import { useAuthStore } from '@/stores/auth';
import type { CommunityCopy } from '@/lib/communityCopy';
import { cn } from '@/lib/utils';
import type { CommunityMeta, CommunitySectionView } from '@/types';

export type CommunityOutletContext = {
  meta: CommunityMeta;
  copy: CommunityCopy;
  sections: CommunitySectionView[];
};

export function useCommunityOutlet() {
  return useOutletContext<CommunityOutletContext>();
}

// Boards are selected through ?section=, so react-router's own isActive never
// fires for them — NavLink compares paths only and ignores the query string.
function sectionIdParam(value: string | null): number {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export function CommunityLayout() {
  const { meta, copy, sections, isLoading, isError } = useCommunityCopy();
  const user = useAuthStore((s) => s.user);
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const activeSection = pathname === '/community' ? sectionIdParam(params.get('section')) : 0;
  const onIndex = pathname === '/community';

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (isError || !meta) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">社区暂不可用</h1>
          <p className="mt-2 text-ink-3">{copy.load_failed}</p>
        </div>
      </div>
    );
  }

  // A board grant is enough to get in: someone may hold manage on one board
  // while the station-wide policy still locks them out of the index.
  if (!meta.canView && !sections.some((section) => section.canView)) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="border-t-2 border-ink pt-6 mb-8">
          <p className="font-mono text-2xs text-ink-3 mb-3">$ community --index</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
            {copy.title}
          </h1>
        </header>
        <div className="border border-rule bg-paper-2/40 p-6">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="h-4 w-4 text-ink-3" />
            <h2 className="text-sm font-medium">{copy.restricted_title}</h2>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            {meta.visibility === 'members' ? copy.restricted_members : copy.restricted_granted}
          </p>
          {!user && (
            <Link to="/auth/login?redirect=%2Fcommunity" className="mt-4 inline-block text-sm text-amber">
              登录
            </Link>
          )}
        </div>
      </div>
    );
  }

  // A person granted a single board can post there without holding the
  // station-wide right, so the button keys off either path.
  const canPostAnywhere = meta.canPost || sections.some((section) => section.canPost);

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-1 px-2 text-sm rounded-sm transition-colors hover:no-underline',
      active
        ? 'bg-ink text-paper font-medium'
        : 'text-ink-3 hover:bg-paper-2 hover:text-ink',
    );

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <nav
        aria-label="社区导航"
        className="flex items-center gap-1 flex-wrap border-b border-rule pb-2 mb-6"
      >
        <Link to="/community" className={tabClass(onIndex && activeSection === 0)}>
          全部
        </Link>
        {sections.map((section) => (
          <Link
            key={section.id}
            to={`/community?section=${section.id}`}
            className={tabClass(onIndex && activeSection === section.id)}
          >
            {!section.canView && <Lock className="h-3 w-3" />}
            {section.name}
          </Link>
        ))}
        {canPostAnywhere && (
          <Link
            to={activeSection ? `/community/new?section=${activeSection}` : '/community/new'}
            className="ml-auto inline-flex h-8 items-center gap-1 px-2 text-sm text-ink-3 rounded-sm hover:bg-paper-2 hover:text-amber transition-colors hover:no-underline"
          >
            <Plus className="h-3.5 w-3.5" />
            {copy.new_topic}
          </Link>
        )}
      </nav>
      <Outlet context={{ meta, copy, sections }} />
    </div>
  );
}
