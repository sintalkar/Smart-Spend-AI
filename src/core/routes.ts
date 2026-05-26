export const appRoutes = {
  dashboard: '/',
  transactions: '/transactions',
  add: '/add',
  sms: '/sms',
  aiAdvisor: '/ai-advisor',
  insights: '/insights',
  score: '/score',
  budget: '/budget',
  recurring: '/recurring',
  goals: '/goals',
  installGuide: '/install-guide',
  privacy: '/privacy',
  landing: '/landing',
} as const;

export type AddEntryMode = 'manual' | 'voice' | 'receipt';

export function getAddEntryPath(mode: AddEntryMode = 'manual') {
  const params = new URLSearchParams({ mode });
  return `${appRoutes.add}?${params.toString()}`;
}
