export function canAccessGtmLab(user) {
  return Boolean(user?.email_verified && Number(user.admin_status) === 1)
}

