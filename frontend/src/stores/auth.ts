import { create } from 'zustand';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  /** True once we've finished the initial session probe on boot. */
  hydrated: boolean;
  set: (user: User) => void;
  /** Apply a user (or null) and mark the store as hydrated. */
  setUser: (user: User | null) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrated: false,
  set: (user) => set({ user, hydrated: true }),
  setUser: (user) => set({ user, hydrated: true }),
  clear: () => set({ user: null, hydrated: true }),
}));
