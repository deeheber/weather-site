export function sanitizeAssetHashes(obj: unknown): unknown {
  if (typeof obj === 'string' && /^[a-f0-9]{64}\.zip$/.test(obj)) {
    return '[ASSET_HASH].zip'
  }
  if (Array.isArray(obj)) return obj.map(sanitizeAssetHashes)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, sanitizeAssetHashes(v)]),
    )
  }
  return obj
}
