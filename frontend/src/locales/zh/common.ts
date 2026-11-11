const common = {
  app: {
    metaDescription: 'CTF-OJ — 面向 CTF 练习的在线评测平台',
  },
  action: {
    cancel: '取消',
    confirm: '确认',
    close: '关闭',
    save: '保存',
    delete: '删除',
    edit: '编辑',
    create: '创建',
    submit: '提交',
    back: '返回',
    reset: '重置',
    search: '搜索',
    retry: '重试',
    viewAll: '查看全部',
    more: '更多',
    yes: '是',
    no: '否',
  },
  a11y: {
    loading: '加载中',
    close: '关闭',
  },
  state: {
    loading: '加载中…',
    empty: '暂无内容',
    error: '出错了',
  },
  units: {
    second: '秒',
    minute: '分',
    hour: '时',
  },
} as const;

export default common;
