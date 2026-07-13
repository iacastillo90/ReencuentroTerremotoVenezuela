export const AUTH_VIEWS = ['search', 'feed', 'map', 'profile'] as const;

export type AuthView = typeof AUTH_VIEWS[number];