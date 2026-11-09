import common from './common';
import nav from './nav';
import enums from './enums';
import auth from './auth';
import natural from './natural';

const en = { common: { ...common, nav, enums, auth, ...natural } } as const;

export default en;
