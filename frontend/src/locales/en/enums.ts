const enums = {
  role: {
    user: 'User',
    challengeAdmin: 'Challenge admin',
    competitionAdmin: 'Competition admin',
    moderator: 'Moderator',
    admin: 'Admin',
  },
  phase: {
    upcoming: 'Upcoming',
    live: 'Live',
    ended: 'Ended',
    unscheduled: 'Unscheduled',
  },
  copyGroup: {
    board: 'Board copy',
    composer: 'Topic form',
    reply: 'Reply form',
    access: 'Access & status',
    history: 'Revision history',
  },
} as const;

export default enums;
