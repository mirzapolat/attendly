type RuntimeEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

export const getRuntimeEnv = (): RuntimeEnv => {
  if (typeof window === "undefined") {
    return {};
  }

  return window.__ENV ?? {};
};
