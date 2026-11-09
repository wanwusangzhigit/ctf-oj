const common = {
  app: {
    metaDescription: 'CTF-OJ — an online judge for CTF practice',
  },
  action: {
    cancel: 'Cancel',
    confirm: 'Confirm',
    close: 'Close',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    submit: 'Submit',
    back: 'Back',
    reset: 'Reset',
    search: 'Search',
    retry: 'Retry',
    viewAll: 'View all',
    more: 'More',
    yes: 'Yes',
    no: 'No',
  },
  a11y: {
    loading: 'Loading',
    close: 'Close',
  },
  state: {
    loading: 'Loading…',
    empty: 'Nothing here yet',
    error: 'Something went wrong',
  },
  units: {
    second: 's',
    minute: 'm',
    hour: 'h',
  },
} as const;

export default common;
