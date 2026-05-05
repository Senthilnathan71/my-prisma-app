export type ValidationResult = { valid: true } | { valid: false; reason: string };

// Keywords that must not appear anywhere in a script (as whole words, outside strings/comments)
const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'MERGE', 'UPSERT',
  'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'RENAME',
  'GRANT', 'REVOKE', 'COMMENT',
  'VACUUM', 'ANALYZE', 'CLUSTER', 'REINDEX', 'LOCK',
  'COPY', 'CALL', 'DO', 'EXECUTE', 'SECURITY',
  'LISTEN', 'NOTIFY', 'PREPARE', 'DEALLOCATE', 'DISCARD',
  'REFRESH', 'IMPORT', 'LOAD', 'RESET', 'SET', 'SHOW',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE',
  'INTO',
];

export function validateReadOnlySql(raw: string): ValidationResult {
  if (typeof raw !== 'string') {
    return { valid: false, reason: 'Script must be a string.' };
  }

  // 1. Strip string literals (single-quoted) — replace with ''
  //    and SQL comments: -- line comments and /* block comments */ (nested).
  const stripped = stripSqlLiteralsAndComments(raw).trim();

  if (stripped.length === 0) {
    return { valid: false, reason: 'Script must be a SELECT query (script is empty after removing comments).' };
  }

  // 2. Allow at most one trailing `;` — and nothing significant after it.
  const semiIdx = stripped.indexOf(';');
  if (semiIdx !== -1) {
    const after = stripped.slice(semiIdx + 1).trim();
    if (after.length > 0) {
      return { valid: false, reason: 'Only one statement allowed per script.' };
    }
  }
  const noSemi = semiIdx === -1 ? stripped : stripped.slice(0, semiIdx).trim();

  // 3. Must start with SELECT or WITH.
  if (!/^(SELECT|WITH)\b/i.test(noSemi)) {
    return { valid: false, reason: 'Script must be a SELECT query (must begin with SELECT or WITH).' };
  }

  // 4. Whole-word forbidden-keyword scan.
  const upper = ' ' + noSemi.toUpperCase() + ' ';
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`);
    if (re.test(upper)) {
      return { valid: false, reason: `Keyword '${kw}' is not allowed in exception-check scripts.` };
    }
  }

  return { valid: true };
}

/**
 * Remove single-quoted string literals, -- line comments, and block comments (nested).
 * Replaces each with a single space so tokenisation still works.
 */
function stripSqlLiteralsAndComments(input: string): string {
  let i = 0;
  const out: string[] = [];
  const n = input.length;

  while (i < n) {
    const ch = input[i];
    const next = input[i + 1];

    // Line comment --
    if (ch === '-' && next === '-') {
      while (i < n && input[i] !== '\n') i++;
      out.push(' ');
      continue;
    }

    // Block comment with nesting: /* ... */
    if (ch === '/' && next === '*') {
      let depth = 1;
      i += 2;
      while (i < n && depth > 0) {
        if (input[i] === '/' && input[i + 1] === '*') {
          depth++;
          i += 2;
        } else if (input[i] === '*' && input[i + 1] === '/') {
          depth--;
          i += 2;
        } else {
          i++;
        }
      }
      out.push(' ');
      continue;
    }

    // Single-quoted string literal (SQL escapes '' inside)
    if (ch === "'") {
      i++;
      while (i < n) {
        if (input[i] === "'" && input[i + 1] === "'") { i += 2; continue; }
        if (input[i] === "'") { i++; break; }
        i++;
      }
      out.push("''"); // placeholder empty literal
      continue;
    }

    // Double-quoted identifier — keep as-is (column/table names)
    if (ch === '"') {
      out.push(ch);
      i++;
      while (i < n && input[i] !== '"') {
        out.push(input[i]);
        i++;
      }
      if (i < n) { out.push(input[i]); i++; }
      continue;
    }

    out.push(ch);
    i++;
  }

  return out.join('');
}
