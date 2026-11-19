import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

const byId = (id) => document.getElementById(id)
const workspaceTable = 'tasklane_workspaces'

export function createSync({ get, enterOwner, enterDemo }) {
  const db = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { flowType: 'pkce', storageKey: 'tasklane-auth' },
  })
  const account = byId('account')
  const login = byId('login')
  const signIn = byId('github-login')
  const loginStatus = byId('login-status')
  const setup = byId('setup')
  const signOut = byId('setup-sign-out')
  const syncStatus = byId('sync-status')
  const retry = byId('retry-sync')
  let userId = null
  let checking = false
  let sessionVersion = 0
  let owner = false
  let revision = 0
  let dirty = false
  let timer
  let request = null
  let conflict = false

  function showSync(message, action = '') {
    syncStatus.textContent = message
    retry.textContent = action
    retry.hidden = !action
  }

  async function read() {
    const { data, error } = await db.from(workspaceTable).select('state,revision').maybeSingle()
    if (error) throw error
    return data
  }

  function schedule() {
    clearTimeout(timer)
    if (owner && dirty && !conflict) timer = setTimeout(save, 350)
  }

  function save() {
    clearTimeout(timer)
    if (request) return request
    if (!owner || !dirty || conflict) return
    const nextState = JSON.stringify(get())
    if (new TextEncoder().encode(nextState).length > 900_000) {
      showSync('Workspace is full. Remove some cards or whiteboard marks to save.')
      return
    }
    dirty = false
    const session = sessionVersion
    const expected = revision
    showSync('Saving…')
    request = (async () => {
      let saved = false
      try {
        const { data, error } = await db.rpc('tasklane_save_workspace', {
          next_state: JSON.parse(nextState), expected_revision: expected,
        })
        if (session !== sessionVersion) return
        if (error) throw error
        revision = data
        saved = true
        showSync('Saved')
      } catch (error) {
        if (session !== sessionVersion) return
        dirty = true
        conflict = error.code === '40001'
        if (conflict) showSync('This board changed on another device. Your edits are still here.', 'Load saved board')
        else showSync('Changes could not be saved.', 'Retry save')
      } finally {
        if (session === sessionVersion) {
          request = null
          if (saved && dirty) schedule()
        }
      }
    })()
    return request
  }

  function reset() {
    clearTimeout(timer)
    owner = false
    request = null
    revision = 0
    dirty = false
    conflict = false
    showSync('')
    enterDemo()
  }

  async function loadOwner(version) {
    const record = await read()
    if (version !== sessionVersion) return
    owner = true
    revision = record?.revision ?? 0
    dirty = false
    conflict = false
    account.textContent = 'Sign out'
    showSync(record ? 'Saved' : '')
    enterOwner(record?.state)
  }

  function handleAuth(event, session) {
    const nextUser = session?.user.id ?? null
    if (event === 'SIGNED_IN' && nextUser && nextUser === userId && (owner || checking)) return
    const version = ++sessionVersion
    if (owner && nextUser !== userId) reset()
    userId = nextUser
    checking = Boolean(nextUser)
    setup.hidden = true
    loginStatus.textContent = ''
    account.disabled = Boolean(nextUser)
    account.textContent = nextUser ? 'Checking login…' : 'Dymon login'
    signOut.hidden = !nextUser
    signIn.hidden = Boolean(nextUser)
    signIn.disabled = false
    if (!nextUser) return
    setTimeout(async () => {
      try {
        const { data: allowed, error } = await db.rpc('tiershelf_is_owner')
        if (version !== sessionVersion) return
        if (error) throw error
        if (!allowed) {
          loginStatus.textContent = 'Dymon mode is reserved for the Dymon18 GitHub account.'
          account.textContent = 'Account'
          return
        }
        await loadOwner(version)
        if (version === sessionVersion && login.open) login.close()
      } catch (error) {
        if (version !== sessionVersion) return
        const needsSetup = ['42P01', 'PGRST205'].includes(error.code)
        setup.hidden = !needsSetup
        loginStatus.textContent = needsSetup ? 'Cloud storage needs the TaskLane table.'
          : 'Could not open your saved workspace. Refresh to try again.'
        account.textContent = needsSetup ? 'Finish Dymon setup' : 'Account'
        showSync(loginStatus.textContent)
      } finally {
        if (version === sessionVersion) {
          account.disabled = false
          checking = false
        }
      }
    }, 0)
  }

  async function logout() {
    const version = sessionVersion
    if (request) await request
    while (owner && dirty && !conflict) {
      const pending = save()
      if (!pending) break
      await pending
      if (retry.textContent === 'Retry save') break
    }
    if (version !== sessionVersion) return
    if (owner && dirty && !window.confirm('Some TaskLane changes are unsaved. Sign out anyway?')) return
    const { error } = await db.auth.signOut({ scope: 'local' })
    if (error) {
      if (owner) showSync('Could not sign out. Try again.')
      else loginStatus.textContent = 'Could not sign out. Try again.'
    }
  }

  account.addEventListener('click', () => {
    if (!owner) login.showModal()
    else logout()
  })
  signOut.addEventListener('click', async () => {
    await logout()
    if (!userId && login.open) login.close()
  })
  signIn.addEventListener('click', async () => {
    signIn.disabled = true
    loginStatus.textContent = ''
    const redirectTo = new URL('./', location.href).href
    const { error } = await db.auth.signInWithOAuth({ provider: 'github', options: { redirectTo } })
    if (error) {
      signIn.disabled = false
      loginStatus.textContent = 'Could not open GitHub sign-in. Try again.'
    }
  })
  retry.addEventListener('click', async () => {
    if (!owner) return
    if (!conflict) {
      save()
      return
    }
    if (!window.confirm('Load the cloud board and discard your unsaved edits?')) return
    const version = sessionVersion
    retry.disabled = true
    // Keep edits made while the cloud read is in progress.
    const before = JSON.stringify(get())
    try {
      const record = await read()
      if (version !== sessionVersion) return
      if (before !== JSON.stringify(get())) {
        showSync('You made more edits while the board was loading.', 'Load saved board')
        return
      }
      revision = record?.revision ?? 0
      dirty = false
      conflict = false
      enterOwner(record?.state)
      showSync('Loaded saved board')
    } catch {
      if (version === sessionVersion) showSync('Could not load the saved board.', 'Load saved board')
    } finally {
      retry.disabled = false
    }
  })
  window.addEventListener('beforeunload', (event) => {
    if (owner && (dirty || request)) event.preventDefault()
  })
  db.auth.onAuthStateChange(handleAuth)

  return {
    changed() {
      if (!owner) return
      dirty = true
      schedule()
    },
  }
}
