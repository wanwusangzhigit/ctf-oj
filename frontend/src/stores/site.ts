import { create } from 'zustand';
import type { SiteSettingsPublic } from '@/types';
import { getPublicSettings } from '@/api/settings';

interface SiteState {
  settings: SiteSettingsPublic | null;
  loading: boolean;
  error: string | null;
  /** Hydrate the store from /api/v1/settings. Safe to call multiple times. */
  load: () => Promise<void>;
}

/**
 * SiteSettingsStore — single source of truth for the public site settings.
 * Hydrated once on app bootstrap; consumed by the layout (title, tagline),
 * auth pages (registration gate), and various features (password reset,
 * email verification) so they react to admin updates without page reload.
 */
export const useSiteStore = create<SiteState>((set, get) => ({
  settings: null,
  loading: false,
  error: null,
  load: async () => {
    if (get().loading) return;
    set({ loading: true, error: null });
    try {
      const s = await getPublicSettings();
      set({ settings: s, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'failed to load settings';
      set({ loading: false, error: msg });
    }
  },
}));
