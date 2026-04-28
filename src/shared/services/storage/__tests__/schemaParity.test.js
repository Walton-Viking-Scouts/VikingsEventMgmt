/**
 * Static schema parity check.
 *
 * Parses every CREATE TABLE definition (in database.js and sqliteSchema.js)
 * and the migration registry, then asserts every column referenced by an
 * INSERT/REPLACE/DELETE/UPDATE in those same files exists in the table's
 * declared column set.
 *
 * Catches the inverse of today's bug: code referencing a column that the
 * schema (after migrations) never declares. Pure static analysis — no DB.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The schema is now defined by versioned migration files. Operations (INSERT,
 * DELETE, UPDATE, SELECT) live in database.js. Both must agree.
 *
 * sqliteSchema.js is intentionally NOT included — it's superseded by the
 * migrations folder and kept only as legacy.
 */
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations');
const migrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter(f => f.endsWith('.js') && f !== 'index.js')
  .map(f => path.join(MIGRATIONS_DIR, f));

const SOURCES = [
  path.resolve(__dirname, '../database.js'),
  ...migrationFiles,
];

const combinedSource = SOURCES.map(p => readFileSync(p, 'utf-8')).join('\n\n');

function splitTopLevelCommas(s) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

function stripSqlComments(s) {
  // Remove SQL line comments (-- to end of line) and block comments (/* ... */).
  return s
    .replace(/--[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function parseCreateTableColumns(columnsBlock) {
  const TABLE_LEVEL_KEYWORDS = ['PRIMARY', 'FOREIGN', 'UNIQUE', 'CHECK', 'CONSTRAINT'];
  const columns = [];
  // Strip comments first — inline ones like `col TEXT, -- with, commas` will
  // otherwise split mid-comment and produce phantom column names.
  const cleaned = stripSqlComments(columnsBlock);
  for (const part of splitTopLevelCommas(cleaned)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const firstWord = trimmed.split(/\s+/, 1)[0].replace(/^[`"']|[`"']$/g, '').toUpperCase();
    if (TABLE_LEVEL_KEYWORDS.includes(firstWord)) continue;
    const nameMatch = trimmed.match(/^[`"']?(\w+)[`"']?/);
    if (nameMatch) columns.push(nameMatch[1]);
  }
  return columns;
}

function extractCreateTables(text) {
  const tables = {};
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)\s*\(([\s\S]*?)\)\s*[;`]/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const name = m[1];
    const cols = parseCreateTableColumns(m[2]);
    if (!tables[name]) tables[name] = new Set();
    for (const c of cols) tables[name].add(c);
  }
  return tables;
}

function extractAlterAddColumns(text) {
  const adds = [];
  const regex = /ALTER\s+TABLE\s+(\w+)\s+ADD\s+COLUMN\s+(\w+)/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    adds.push({ table: m[1], column: m[2] });
  }
  return adds;
}

/**
 * Reads applySchemaMigrations()'s requiredColumns registry. The registry is
 * the source of truth for what columns must exist after migration; if a
 * column is referenced by an INSERT but listed only there (not in any
 * CREATE TABLE), the runtime will still ALTER it in.
 */
function extractMigrationRegistry(text) {
  const adds = [];
  const blockMatch = text.match(/requiredColumns\s*=\s*\{([\s\S]*?)\n\s*\};/);
  if (!blockMatch) return adds;
  const block = blockMatch[1];
  const tableRegex = /(\w+)\s*:\s*\{([\s\S]*?)\}/g;
  let tm;
  while ((tm = tableRegex.exec(block)) !== null) {
    const table = tm[1];
    const colsBlock = tm[2];
    const colMatches = colsBlock.matchAll(/(\w+)\s*:\s*['"`]/g);
    for (const cm of colMatches) {
      adds.push({ table, column: cm[1] });
    }
  }
  return adds;
}

function buildSchemaIndex(text) {
  const schemas = extractCreateTables(text);
  for (const m of extractAlterAddColumns(text)) {
    if (!schemas[m.table]) schemas[m.table] = new Set();
    schemas[m.table].add(m.column);
  }
  for (const m of extractMigrationRegistry(text)) {
    if (!schemas[m.table]) schemas[m.table] = new Set();
    schemas[m.table].add(m.column);
  }
  return schemas;
}

function extractInserts(text) {
  const inserts = [];
  const regex = /(?:INSERT\s+OR\s+REPLACE\s+INTO|INSERT\s+INTO|REPLACE\s+INTO)\s+(\w+)\s*\(([^)]+)\)/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const table = m[1];
    const cols = m[2]
      .split(',')
      .map(c => c.trim().replace(/^[`"']|[`"']$/g, ''))
      .filter(c => c && /^\w+$/.test(c));
    inserts.push({ table, columns: cols });
  }
  return inserts;
}

function extractDeleteWhereColumns(text) {
  const deletes = [];
  // Capture WHERE clause until a SQL terminator we can recognise inside template strings.
  const regex = /DELETE\s+FROM\s+(\w+)(?:\s+WHERE\s+([^`'"]+?)(?=`|'|"|;|$))?/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const table = m[1];
    const whereClause = (m[2] || '').trim();
    if (!whereClause) {
      deletes.push({ table, columns: [] });
      continue;
    }
    const cols = [...whereClause.matchAll(/\b(\w+)\s*(?:=|<|>|!=|<>|IS|IN|LIKE)/gi)]
      .map(mm => mm[1])
      .filter(c => !['AND', 'OR', 'NOT', 'IS', 'IN', 'LIKE'].includes(c.toUpperCase()));
    deletes.push({ table, columns: cols });
  }
  return deletes;
}

function extractUpdateSetColumns(text) {
  const updates = [];
  const regex = /UPDATE\s+(\w+)\s+SET\s+([\s\S]*?)(?:WHERE|`|'|"|;)/gi;
  let m;
  while ((m = regex.exec(text)) !== null) {
    const table = m[1];
    const setClause = m[2];
    const cols = [...setClause.matchAll(/\b(\w+)\s*=/g)].map(mm => mm[1]);
    updates.push({ table, columns: cols });
  }
  return updates;
}

describe('SQLite schema parity (static)', () => {
  const schemas = buildSchemaIndex(combinedSource);

  it('discovers a non-empty schema for the core tables', () => {
    for (const t of ['sections', 'events', 'attendance', 'members', 'sync_status']) {
      expect(schemas[t]).toBeDefined();
      expect(schemas[t].size).toBeGreaterThan(0);
    }
  });

  it('every column listed in an INSERT exists in the target table', () => {
    const violations = [];
    for (const { table, columns } of extractInserts(combinedSource)) {
      const declared = schemas[table];
      if (!declared) {
        violations.push(`INSERT into unknown table "${table}"`);
        continue;
      }
      for (const col of columns) {
        if (!declared.has(col)) {
          violations.push(
            `INSERT INTO ${table} references column "${col}" not declared in schema. ` +
            `Declared columns: [${[...declared].sort().join(', ')}]`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every column referenced in a DELETE WHERE clause exists in the target table', () => {
    const violations = [];
    for (const { table, columns } of extractDeleteWhereColumns(combinedSource)) {
      const declared = schemas[table];
      if (!declared) {
        violations.push(`DELETE from unknown table "${table}"`);
        continue;
      }
      for (const col of columns) {
        if (!declared.has(col)) {
          violations.push(
            `DELETE FROM ${table} references column "${col}" not declared in schema. ` +
            `Declared columns: [${[...declared].sort().join(', ')}]`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('every column referenced in an UPDATE SET clause exists in the target table', () => {
    const violations = [];
    for (const { table, columns } of extractUpdateSetColumns(combinedSource)) {
      const declared = schemas[table];
      if (!declared) {
        violations.push(`UPDATE on unknown table "${table}"`);
        continue;
      }
      for (const col of columns) {
        if (!declared.has(col)) {
          violations.push(
            `UPDATE ${table} SET references column "${col}" not declared in schema. ` +
            `Declared columns: [${[...declared].sort().join(', ')}]`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
