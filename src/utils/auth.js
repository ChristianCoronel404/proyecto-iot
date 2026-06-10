const COOKIE_NAME = 'auth_drako'

const clearAllCookies = () => {
  document.cookie.split(';').forEach(c => {
    const name = c.split('=')[0].trim()
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
}

export const setUserCookie = (user) => {
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000).toUTCString()
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(user))}; expires=${expires}; path=/; SameSite=Strict`
}

export const getUserCookie = () => {
  try {
    const match = document.cookie.split(';').find(c => c.trim().startsWith(`${COOKIE_NAME}=`))
    if (!match) return null
    const raw = match.split('=').slice(1).join('=')
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    return null
  }
}

// Llamar en login Y logout: limpia todo el dominio y luego opcionalmente guarda el nuevo user
export const loginCookies = (user) => {
  clearAllCookies()
  setUserCookie(user)
}

export const logoutCookies = () => {
  clearAllCookies()
}

export const getToken = () => {
  try {
    return getUserCookie()?.token ?? null
  } catch {
    return null
  }
}

export const authHeaders = (extra = {}) => {
  const token = getToken()
  return token
    ? { Authorization: `Bearer ${token}`, ...extra }
    : { ...extra }
}

export const authFetch = (url, options = {}) => {
  const { headers = {}, ...rest } = options
  return fetch(url, {
    ...rest,
    headers: { ...headers, ...authHeaders() },
  })
}
