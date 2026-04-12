// ============================================================================
// ENAVIA Panel — Memory mapper (internal)
// Wraps raw memory fixture/API response into the canonical MemoryEnvelope.
// ============================================================================

/**
 * @param {object|null} raw - raw memory object
 * @returns {{ memory: object|null, fetchedAt: string }}
 */
export function mapMemoryResponse(raw) {
  return {
    memory:    raw ?? null,
    fetchedAt: new Date().toISOString(),
  };
}
