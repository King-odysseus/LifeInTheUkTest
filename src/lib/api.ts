import type { Attempt, SrsState, StudyProfile, User } from './types'

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new ApiError((body.error as string) ?? 'Something went wrong.', res.status)
  }
  return body as T
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) })

export const api = {
  health: () => request<{ ok: boolean; accounts: boolean }>('/health'),

  me: () => request<{ user: User | null }>('/auth/me'),

  signup: (identifier: string, password: string) =>
    post<{ user: User }>('/auth/signup', { identifier, password }),

  login: (identifier: string, password: string) =>
    post<{ user: User }>('/auth/login', { identifier, password }),

  logout: () => post<{ ok: true }>('/auth/logout'),

  recoveryOptions: (identifier: string) =>
    post<{ securityQuestion: string | null }>('/auth/recovery-options', { identifier }),

  reset: (data: {
    identifier: string
    newPassword: string
    recoveryCode?: string
    securityAnswer?: string
  }) => post<{ user: User }>('/auth/reset', data),

  newRecoveryCode: () => post<{ recoveryCode: string }>('/auth/recovery-code'),

  setSecurityQuestion: (question: string, answer: string) =>
    post<{ ok: true }>('/auth/security-question', { question, answer }),

  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ ok: true }>('/auth/password', { currentPassword, newPassword }),

  pushAttempts: (attempts: Attempt[]) => post<{ ok: true }>('/progress/attempts', { attempts }),

  merge: (attempts: Attempt[], srs: SrsState[], profile?: StudyProfile | null) =>
    post<{ ok: true }>('/progress/merge', { attempts, srs, profile }),

  pullAttempts: () => request<{ attempts: Attempt[] }>('/progress/attempts'),

  snapshot: () => request<{ attempts: Attempt[]; srs: SrsState[]; profile: StudyProfile | null }>('/progress/snapshot'),

  saveStudyProfile: (profile: StudyProfile) => request<{ profile: StudyProfile }>('/progress/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
  }),

  exportData: () => request<Record<string, unknown>>('/auth/export'),

  deleteAccount: (password: string) => request<{ ok: true }>('/auth/account', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  }),

  stats: () =>
    request<{
      mockAttempts: number
      mockPassed: number
      bestPercent: number | null
      perQuestion: { questionId: string; asked: number; right: number }[]
    }>('/progress/stats'),

  pushSrs: (srs: SrsState[]) => request<{ ok: true }>('/progress/srs', {
    method: 'PUT',
    body: JSON.stringify({ srs }),
  }),
}

export { ApiError }
