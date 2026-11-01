export const COPY_PREFIX = 'community.copy.';

export type CopyKey =
  | 'title'
  | 'subtitle'
  | 'new_topic'
  | 'visibility_public'
  | 'visibility_members'
  | 'visibility_restricted'
  | 'posting_members'
  | 'posting_restricted'
  | 'guidelines_title'
  | 'guidelines_body'
  | 'policy_title'
  | 'search_placeholder'
  | 'empty_filtered'
  | 'empty_board'
  | 'load_failed'
  | 'topic_title_placeholder'
  | 'topic_content_placeholder'
  | 'compose_hint'
  | 'compose_submit'
  | 'edit_submit'
  | 'edit_hint'
  | 'reply_placeholder'
  | 'reply_hint'
  | 'reply_submit'
  | 'locked_notice'
  | 'reply_denied_member'
  | 'reply_denied_guest'
  | 'no_replies'
  | 'restricted_title'
  | 'restricted_members'
  | 'restricted_granted'
  | 'history_title'
  | 'history_denied'
  | 'topic_fallback_title';

export type CopyGroup = 'board' | 'composer' | 'reply' | 'access' | 'history';

export type CopyKind = 'text' | 'textarea' | 'markdown';

export type CommunityCopyEntry = {
  key: CopyKey;
  label: string;
  group: CopyGroup;
  kind: CopyKind;
  def: string;
};

export const COPY_GROUP_LABEL: Record<CopyGroup, string> = {
  board: '板块文案',
  composer: '主题表单',
  reply: '回复表单',
  access: '权限与状态',
  history: '修改记录',
};

// The value of every entry here is the fallback the UI renders when the admin
// has not overridden that key, so a fresh database still reads as a finished
// board. Adding an entry means adding the matching key to the backend
// allowlist in internal/service/community.go.
export const COMMUNITY_COPY: CommunityCopyEntry[] = [
  {
    key: 'title',
    label: '板块标题',
    group: 'board',
    kind: 'text',
    def: '社区',
  },
  {
    key: 'subtitle',
    label: '板块副标题',
    group: 'board',
    kind: 'textarea',
    def: '技术讨论、Writeup 思路与赛事交流。主题与回复均使用 Markdown。',
  },
  { key: 'new_topic', label: '发起讨论按钮', group: 'board', kind: 'text', def: '发起讨论' },
  { key: 'guidelines_title', label: '须知标题', group: 'board', kind: 'text', def: '发帖须知' },
  {
    key: 'guidelines_body',
    label: '须知正文',
    group: 'board',
    kind: 'markdown',
    def: '讨论技术问题、Writeup 思路与赛事交流。请勿直接张贴 flag 或完整答案，引用他人内容时注明来源。',
  },
  { key: 'policy_title', label: '策略标题', group: 'board', kind: 'text', def: '当前策略' },
  { key: 'search_placeholder', label: '搜索框占位', group: 'board', kind: 'text', def: '搜索标题或内容' },
  { key: 'empty_filtered', label: '筛选空结果', group: 'board', kind: 'text', def: '没有匹配的主题。' },
  {
    key: 'empty_board',
    label: '板块空状态',
    group: 'board',
    kind: 'text',
    def: '还没有主题。发布第一个话题吧。',
  },
  { key: 'load_failed', label: '加载失败', group: 'board', kind: 'text', def: '无法加载社区主题。' },
  { key: 'topic_title_placeholder', label: '主题标题占位', group: 'composer', kind: 'text', def: '主题标题' },
  {
    key: 'topic_content_placeholder',
    label: '主题正文占位',
    group: 'composer',
    kind: 'textarea',
    def: '描述你的问题、思路或发现。支持 Markdown。',
  },
  {
    key: 'compose_hint',
    label: '发帖提示',
    group: 'composer',
    kind: 'text',
    def: '标题必填；正文最长 5000 字符。',
  },
  { key: 'compose_submit', label: '发帖按钮', group: 'composer', kind: 'text', def: '发布主题' },
  { key: 'edit_submit', label: '保存按钮', group: 'composer', kind: 'text', def: '保存修改' },
  {
    key: 'edit_hint',
    label: '编辑提示',
    group: 'composer',
    kind: 'textarea',
    def: '保存会留下一条修改记录，仅作者与管理员可见。',
  },
  {
    key: 'reply_placeholder',
    label: '回复占位',
    group: 'reply',
    kind: 'textarea',
    def: '写下你的回复。支持 Markdown。',
  },
  { key: 'reply_hint', label: '回复提示', group: 'reply', kind: 'text', def: '回复将以楼层形式追加。' },
  { key: 'reply_submit', label: '回复按钮', group: 'reply', kind: 'text', def: '发布回复' },
  { key: 'visibility_public', label: '公开可见标签', group: 'access', kind: 'text', def: '公开可见' },
  { key: 'visibility_members', label: '成员可见标签', group: 'access', kind: 'text', def: '成员可见' },
  { key: 'visibility_restricted', label: '授权可见标签', group: 'access', kind: 'text', def: '授权可见' },
  { key: 'posting_members', label: '成员可发帖标签', group: 'access', kind: 'text', def: '成员可发帖' },
  { key: 'posting_restricted', label: '授权可发帖标签', group: 'access', kind: 'text', def: '授权可发帖' },
  { key: 'locked_notice', label: '锁定提示', group: 'access', kind: 'text', def: '主题已锁定，暂时无法回复。' },
  {
    key: 'reply_denied_member',
    label: '无权回复（已登录）',
    group: 'access',
    kind: 'text',
    def: '当前仅授权成员可回复。',
  },
  { key: 'reply_denied_guest', label: '无权回复（未登录）', group: 'access', kind: 'text', def: '登录后即可回复。' },
  { key: 'no_replies', label: '无回复提示', group: 'access', kind: 'text', def: '还没有回复。' },
  {
    key: 'restricted_title',
    label: '不可见标题',
    group: 'access',
    kind: 'text',
    def: '社区讨论仅对指定成员开放',
  },
  { key: 'restricted_members', label: '不可见（成员可见）', group: 'access', kind: 'text', def: '登录后即可查看和参与讨论。' },
  {
    key: 'restricted_granted',
    label: '不可见（授权可见）',
    group: 'access',
    kind: 'text',
    def: '需要社区访问授权。请联系管理员。',
  },
  { key: 'topic_fallback_title', label: '无标题主题回退', group: 'access', kind: 'text', def: '社区主题' },
  { key: 'history_title', label: '历史标题', group: 'history', kind: 'text', def: '修改记录' },
  {
    key: 'history_denied',
    label: '历史无权提示',
    group: 'history',
    kind: 'text',
    def: '只有作者和管理员可以查看修改记录。',
  },
];

export type CommunityCopy = Record<CopyKey, string>;

export function settingKey(key: CopyKey): string {
  return COPY_PREFIX + key;
}

// Overrides arrive keyed by full setting name and only carry non-empty values,
// so anything missing falls back to the registry default above.
export function resolveCopy(overrides?: Record<string, string> | null): CommunityCopy {
  const out = {} as CommunityCopy;
  for (const entry of COMMUNITY_COPY) {
    const raw = overrides?.[settingKey(entry.key)];
    const value = typeof raw === 'string' ? raw.trim() : '';
    out[entry.key] = value || entry.def;
  }
  return out;
}

export function visibilityLabel(copy: CommunityCopy, value: string): string {
  switch (value) {
    case 'members':
      return copy.visibility_members;
    case 'restricted':
      return copy.visibility_restricted;
    default:
      return copy.visibility_public;
  }
}

export function postingLabel(copy: CommunityCopy, value: string): string {
  return value === 'restricted' ? copy.posting_restricted : copy.posting_members;
}
