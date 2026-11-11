const enums = {
  role: {
    user: '普通用户',
    challengeAdmin: '题目管理员',
    competitionAdmin: '比赛管理员',
    moderator: '内容版主',
    admin: '管理员',
  },
  phase: {
    upcoming: '即将开始',
    live: '进行中',
    ended: '已结束',
    unscheduled: '未排期',
  },
  copyGroup: {
    board: '社区文案',
    composer: '主题表单',
    reply: '回复表单',
    access: '权限与状态',
    history: '修改记录',
  },
} as const;

export default enums;
