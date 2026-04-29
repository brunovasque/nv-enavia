import test from "node:test";
import assert from "node:assert/strict";

import {
  createCloudflareCredentialsError,
  getCloudflareCredentialPresence,
  resolveCloudflareCredentials,
} from "../src/cloudflare-credentials.mjs";

test("resolveCloudflareCredentials aceita aliases obrigatórios", () => {
  const credentials = resolveCloudflareCredentials({
    CF_ACCOUNT: " account-from-alias ",
    CF_TOKEN: " token-from-alias ",
  });

  assert.equal(credentials.accountId, "account-from-alias");
  assert.equal(credentials.apiToken, "token-from-alias");
  assert.equal(credentials.accountIdAlias, "CF_ACCOUNT");
  assert.equal(credentials.apiTokenAlias, "CF_TOKEN");
});

test("resolveCloudflareCredentials prioriza aliases canônicos", () => {
  const credentials = resolveCloudflareCredentials({
    CF_ACCOUNT_ID: "primary-account",
    CLOUDFLARE_ACCOUNT_ID: "secondary-account",
    CF_API_TOKEN: "primary-token",
    CLOUDFLARE_API_TOKEN: "secondary-token",
  });

  assert.equal(credentials.accountId, "primary-account");
  assert.equal(credentials.apiToken, "primary-token");
  assert.equal(credentials.accountIdAlias, "CF_ACCOUNT_ID");
  assert.equal(credentials.apiTokenAlias, "CF_API_TOKEN");
});

test("getCloudflareCredentialPresence expõe apenas booleans", () => {
  const presence = getCloudflareCredentialPresence({
    CF_ACCOUNT_ID: "available-account",
    CF_API_TOKEN: "",
    CLOUDFLARE_API_TOKEN: "available-token",
  });

  assert.deepEqual(presence, {
    has_CF_ACCOUNT_ID: true,
    has_CLOUDFLARE_ACCOUNT_ID: false,
    has_CF_ACCOUNT: false,
    has_CLOUDFLARE_ACCOUNT: false,
    has_CF_API_TOKEN: false,
    has_CLOUDFLARE_API_TOKEN: true,
    has_CF_TOKEN: false,
  });
});

test("createCloudflareCredentialsError não vaza valores", () => {
  const error = createCloudflareCredentialsError(
    {
      CF_ACCOUNT_ID: "real-account-id",
      CF_API_TOKEN: "real-token",
    },
    "missing credentials",
  );

  assert.equal(error.message, "missing credentials");
  assert.deepEqual(error.details, {
    has_CF_ACCOUNT_ID: true,
    has_CLOUDFLARE_ACCOUNT_ID: false,
    has_CF_ACCOUNT: false,
    has_CLOUDFLARE_ACCOUNT: false,
    has_CF_API_TOKEN: true,
    has_CLOUDFLARE_API_TOKEN: false,
    has_CF_TOKEN: false,
  });
  assert.equal(JSON.stringify(error.details).includes("real-account-id"), false);
  assert.equal(JSON.stringify(error.details).includes("real-token"), false);
});
