import common from './common';
import nav from './nav';
import enums from './enums';
import auth from './auth';
import natural from './natural';
import type en from '../en';

/** Force the Chinese dictionary to mirror the English key structure exactly. */
type DeepString<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepString<T[K]>;
};

const zh: DeepString<typeof en> = { common: { ...common, nav, enums, auth, ...natural } };

export default zh;
