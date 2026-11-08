const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) {
    return false
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return date.toISOString().slice(0, 10) === value
}
