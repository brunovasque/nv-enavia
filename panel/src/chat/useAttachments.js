// ============================================================================
// ENAVIA Panel — useAttachments
//
// Hook para gerenciar upload/leitura de arquivos como contexto textual.
// NÃO executa conteúdo. Apenas lê como texto e envia como context.attachments.
//
// Tipos aceitos: .txt .md .json .js .ts .tsx .jsx .css .html .csv
// Tipos bloqueados com mensagem: .pdf .xlsx (sem parser seguro nesta fase)
// Tamanho máximo: 32 KB por arquivo (truncado com aviso)
// ============================================================================

import { useState, useCallback } from "react";

export const ACCEPTED_EXTENSIONS = [
  ".txt", ".md", ".json", ".js", ".ts", ".tsx", ".jsx", ".css", ".html", ".csv",
];

export const BLOCKED_EXTENSIONS = [".pdf", ".xlsx", ".xls", ".docx", ".doc"];

const MAX_BYTES = 32 * 1024; // 32 KB per file

function _extension(filename) {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx).toLowerCase() : "";
}

function _readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
    reader.readAsText(file, "utf-8");
  });
}

export function useAttachments() {
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState(null);

  const addFiles = useCallback(async (fileList) => {
    setAttachError(null);
    const files = Array.from(fileList);
    const results = [];
    let blocked = [];

    for (const file of files) {
      const ext = _extension(file.name);

      if (BLOCKED_EXTENSIONS.includes(ext)) {
        blocked.push(file.name);
        continue;
      }

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        blocked.push(file.name);
        continue;
      }

      let text;
      try {
        text = await _readFileAsText(file);
      } catch {
        blocked.push(file.name);
        continue;
      }

      let truncated = false;
      if (new Blob([text]).size > MAX_BYTES) {
        // Truncate accurately by byte length using TextEncoder
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        const truncBytes = bytes.slice(0, MAX_BYTES);
        text = new TextDecoder("utf-8", { fatal: false }).decode(truncBytes) + "\n[... arquivo truncado por tamanho]";
        truncated = true;
      }

      results.push({
        id:        `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name:      file.name,
        ext,
        size:      file.size,
        truncated,
        content:   text,
      });
    }

    if (blocked.length > 0) {
      if (blocked.some((n) => BLOCKED_EXTENSIONS.includes(_extension(n)))) {
        setAttachError(
          `Arquivo(s) não suportado(s) nesta fase (PDF/XLSX requer parser dedicado): ${blocked.join(", ")}`,
        );
      } else {
        setAttachError(`Tipo não aceito: ${blocked.join(", ")}. Use: ${ACCEPTED_EXTENSIONS.join(" ")}`);
      }
    }

    if (results.length > 0) {
      setAttachments((prev) => [...prev, ...results]);
    }

    // Return added/blocked so callers can react (e.g. show chat notification)
    return {
      added:   results.map((r) => ({ name: r.name })),
      blocked,
    };
  }, []);

  const removeAttachment = useCallback((id) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
    setAttachError(null);
  }, []);

  const dismissAttachError = useCallback(() => setAttachError(null), []);

  // Build the context.attachments payload — filename/type/content_text/content_summary/truncated
  const buildAttachments = useCallback(() => {
    return attachments.map((a) => ({
      filename:        a.name,
      type:            a.ext,
      content_text:    a.content,
      content_summary: a.content.slice(0, 300).trimEnd() + (a.content.length > 300 ? "…" : ""),
      truncated:       a.truncated,
    }));
  }, [attachments]);

  return {
    attachments,
    attachError,
    addFiles,
    removeAttachment,
    clearAttachments,
    dismissAttachError,
    buildAttachments,
  };
}
