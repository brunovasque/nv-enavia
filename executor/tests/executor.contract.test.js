// ============================================================================
// executor/tests/executor.contract.test.js
//
// Smoke test mínimo de contrato do enavia-executor.
// Testa apenas as invariantes documentadas no CONTRACT.md,
// sem depender de produção, sem mocks de KV, sem OpenAI.
//
// Run: node executor/tests/executor.contract.test.js
// ============================================================================

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ============================================================================
// Helpers
// ============================================================================

function readSourceFile(relPath) {
  return readFileSync(resolve(__dirname, "..", relPath), "utf8");
}

// ============================================================================
// Group 1 — Estrutura de arquivos obrigatória
// ============================================================================
console.log("\nGroup 1 — Estrutura de arquivos obrigatória");

let srcContent = null;
let contractContent = null;
let readmeContent = null;
let wranglerContent = null;

try {
  srcContent = readSourceFile("src/index.js");
  assert(srcContent.length > 0, "src/index.js existe e não está vazio");
} catch {
  assert(false, "src/index.js existe e não está vazio");
}

try {
  contractContent = readSourceFile("CONTRACT.md");
  assert(contractContent.length > 0, "CONTRACT.md existe e não está vazio");
} catch {
  assert(false, "CONTRACT.md existe e não está vazio");
}

try {
  readmeContent = readSourceFile("README.md");
  assert(readmeContent.length > 0, "README.md existe e não está vazio");
} catch {
  assert(false, "README.md existe e não está vazio");
}

try {
  wranglerContent = readSourceFile("wrangler.toml");
  assert(wranglerContent.length > 0, "wrangler.toml existe e não está vazio");
} catch {
  assert(false, "wrangler.toml existe e não está vazio");
}

// ============================================================================
// Group 2 — Invariantes do src/index.js (sem executar código)
// ============================================================================
console.log("\nGroup 2 — Invariantes do src/index.js (análise estática)");

if (srcContent) {
  assert(
    srcContent.includes("GET") && srcContent.includes("/health"),
    "src/index.js contém rota GET /health"
  );

  assert(
    srcContent.includes("/audit"),
    "src/index.js contém rota /audit"
  );

  assert(
    srcContent.includes("/engineer"),
    "src/index.js contém rota /engineer"
  );

  assert(
    srcContent.includes("/propose"),
    "src/index.js contém rota /propose"
  );

  assert(
    srcContent.includes("/boundary"),
    "src/index.js contém rota /boundary"
  );

  assert(
    srcContent.includes("EXECUTOR_BOUNDARY"),
    "src/index.js define EXECUTOR_BOUNDARY (contrato canônico)"
  );

  assert(
    srcContent.includes("enavia-executor") || srcContent.includes("SYSTEM_NAME"),
    "src/index.js referencia identidade do executor"
  );

  assert(
    !srcContent.includes("eval(") && !srcContent.includes("new Function("),
    "src/index.js não usa eval() nem new Function() (Workers-safe)"
  );
}

// ============================================================================
// Group 3 — Invariantes do CONTRACT.md
// ============================================================================
console.log("\nGroup 3 — Invariantes do CONTRACT.md");

if (contractContent) {
  assert(
    contractContent.includes("env.EXECUTOR"),
    "CONTRACT.md documenta compatibilidade com env.EXECUTOR.fetch(...)"
  );

  assert(
    contractContent.includes("/health"),
    "CONTRACT.md documenta rota /health"
  );

  assert(
    contractContent.includes("/engineer"),
    "CONTRACT.md documenta rota /engineer"
  );

  assert(
    contractContent.includes("/audit"),
    "CONTRACT.md documenta rota /audit"
  );

  assert(
    contractContent.includes("deploy-worker"),
    "CONTRACT.md documenta fronteira com deploy-worker"
  );
}

// ============================================================================
// Group 4 — Invariantes do README.md
// ============================================================================
console.log("\nGroup 4 — Invariantes do README.md");

if (readmeContent) {
  assert(
    readmeContent.includes("brunovasque/enavia-executor"),
    "README.md referencia o repo externo de origem"
  );

  assert(
    readmeContent.includes("Service Binding") || readmeContent.includes("service binding"),
    "README.md explica Service Binding"
  );

  assert(
    readmeContent.includes("deploy"),
    "README.md menciona que deploy continua no repo externo"
  );
}

// ============================================================================
// Group 5 — Invariantes do wrangler.toml
// ============================================================================
console.log("\nGroup 5 — Invariantes do wrangler.toml");

if (wranglerContent) {
  assert(
    wranglerContent.includes('name = "enavia-executor"'),
    "wrangler.toml tem name = enavia-executor"
  );

  assert(
    wranglerContent.includes("ENAVIA_BRAIN"),
    "wrangler.toml referencia binding ENAVIA_BRAIN"
  );

  assert(
    !wranglerContent.includes("722835b730dd44c79f6ff1f0cdc314a9"),
    "wrangler.toml não contém IDs reais de produção (sanitizado)"
  );
}

// ============================================================================
// Resultado final
// ============================================================================
console.log(`\n--- Resultado: ${passed} passou, ${failed} falhou ---`);
if (failed > 0) {
  process.exit(1);
}
