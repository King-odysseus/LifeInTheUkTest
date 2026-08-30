import { describe, expect, it, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppUpdateNotice } from './AppUpdateNotice'
import * as appUpdate from '../lib/appUpdate'

const BUILD_ID_KEY = 'app-build-id'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('AppUpdateNotice', () => {
  it('stays hidden on a first-ever visit, with no previous build recorded', () => {
    render(<AppUpdateNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    // The current build is now recorded so a same-build reload does not show it either.
    expect(localStorage.getItem(BUILD_ID_KEY)).toBe(appUpdate.APP_BUILD_ID)
  })

  it('stays hidden when the recorded build matches the current one', () => {
    localStorage.setItem(BUILD_ID_KEY, appUpdate.APP_BUILD_ID)
    render(<AppUpdateNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows the notice when a returning browser has an older build recorded', () => {
    localStorage.setItem(BUILD_ID_KEY, 'older-build')
    render(<AppUpdateNotice />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText(/new version of the app is available/i)).toBeInTheDocument()
  })

  it('dismisses and does not reappear on remount', async () => {
    localStorage.setItem(BUILD_ID_KEY, 'older-build')
    const user = userEvent.setup()
    const { unmount } = render(<AppUpdateNotice />)
    await user.click(screen.getByRole('button', { name: /dismiss update notice/i }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    unmount()

    // The build id was already advanced, so a fresh mount (simulating a
    // subsequent reload) does not show the notice again.
    render(<AppUpdateNotice />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('refreshes safely without touching IndexedDB when "Refresh now" is clicked', async () => {
    localStorage.setItem(BUILD_ID_KEY, 'older-build')
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const cachesDelete = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['v1']), delete: cachesDelete })

    const user = userEvent.setup()
    render(<AppUpdateNotice />)
    await user.click(screen.getByRole('button', { name: /refresh now/i }))

    expect(cachesDelete).toHaveBeenCalledWith('v1')
    expect(reload).toHaveBeenCalled()
    expect(localStorage.getItem(BUILD_ID_KEY)).toBe(appUpdate.APP_BUILD_ID)
  })
})
