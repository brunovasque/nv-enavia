const ACCOUNT_ID_ALIASES = [
  "CF_ACCOUNT_ID",
  "CLOUDFLARE_ACCOUNT_ID",
  "CF_ACCOUNT",
  "CLOUDFLARE_ACCOUNT",
];

const API_TOKEN_ALIASES = [
  "CF_API_TOKEN",
  "CLOUDFLARE_API_TOKEN",
  "CF_TOKEN",
];

const ALL_ALIASES = [...ACCOUNT_ID_ALIASES, ...API_TOKEN_ALIASES];

function normalizeCredentialValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveFirstAlias(env, aliases) {
  for (const alias of aliases) {
    const value = normalizeCredentialValue(env?.[alias]);
    if (value) {
      return { alias, value };
    }
  }

  return { alias: null, value: null };
}

export function getCloudflareCredentialPresence(env = {}) {
  return Object.fromEntries(
    ALL_ALIASES.map((alias) => [
      `has_${alias}`,
      Boolean(normalizeCredentialValue(env?.[alias])),
    ]),
  );
}

export function resolveCloudflareCredentials(env = {}) {
  const account = resolveFirstAlias(env, ACCOUNT_ID_ALIASES);
  const apiToken = resolveFirstAlias(env, API_TOKEN_ALIASES);

  return {
    accountId: account.value,
    accountIdAlias: account.alias,
    apiToken: apiToken.value,
    apiTokenAlias: apiToken.alias,
    presence: getCloudflareCredentialPresence(env),
  };
}

export function createCloudflareCredentialsError(
  env = {},
  message = "CF_ACCOUNT_ID/CF_API_TOKEN ausentes no Executor.",
) {
  const error = new Error(message);
  error.code = "missing_cloudflare_credentials";
  error.details = getCloudflareCredentialPresence(env);
  return error;
}
