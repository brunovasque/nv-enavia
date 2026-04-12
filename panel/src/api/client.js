// ============================================================================
// ENAVIA Panel — API Client (internal)
// Exported from index.js for transparency, but its direct use is RESTRICTED
// to the api/ layer. Pages and features must use the public endpoints instead.
//
// Responsibility: injects session header into every request and delegates
// to the transport selected by getTransport().
// ============================================================================

import { getTransport } from "./transport.js";
import { getSessionId } from "./session.js";

export const apiClient = {
  /**
   * @param {string} path
   * @param {object} [opts]
   * @returns {Promise<{ ok: boolean, data: unknown, durationMs: number }>}
   */
  request(path, opts = {}) {
    const transport = getTransport();
    const headers = {
      "X-Session-Id": getSessionId(),
      ...opts.headers,
    };
    return transport.request(path, { ...opts, headers });
  },
};
