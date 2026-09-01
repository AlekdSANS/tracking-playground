const GTM_CONTAINER_PATTERN = /^GTM-[A-Z0-9]{4,24}$/

export function isValidGtmContainerId(value) {
  return GTM_CONTAINER_PATTERN.test(value.trim().toUpperCase())
}
