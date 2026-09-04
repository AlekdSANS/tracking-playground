export function canAccessGtmLab(user) {
  return Boolean(user?.email_verified && Number(user.admin_status) === 1)
}

export function getLocalDevUser() {
  if (
    !import.meta.env.DEV
    || import.meta.env.MODE === 'test'
    || import.meta.env.VITE_LOCAL_DEV_ADMIN !== 'true'
  ) {
    return null
  }

  const login = import.meta.env.VITE_LOCAL_DEV_LOGIN
  const name = import.meta.env.VITE_LOCAL_DEV_NAME
  const email = import.meta.env.VITE_LOCAL_DEV_EMAIL

  if (!login || !name || !email) return null

  return {
    user_id: `local-dev:${login}`,
    login,
    name,
    email,
    email_verified: true,
    admin_status: 1,
  }
}
