/**
 * Database Adapter
 * Uses SQLite for local development, PostgreSQL for production (Railway)
 * Provides a unified query interface: db.query(sql, params)
 */

const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db;

if (process.env.DATABASE_URL) {
  // =========== POSTGRESQL ===========
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
  });

  pool.on('error', (err) => {
    console.error('PG pool error:', err);
  });

  db = {
    type: 'pg',
    query: async (text, params = []) => {
      const result = await pool.query(text, params);
      return { rows: result.rows };
    },
  };

} else {
  // =========== SQLITE (local dev only) ===========
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (e) {
    console.error('better-sqlite3 not available. Set DATABASE_URL to use PostgreSQL.');
    process.exit(1);
  }
  const dbPath = path.join(__dirname, '..', 'taskflow.db');
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');


  // Convert $1, $2... to ?
  function convertPlaceholders(sql) {
    return sql.replace(/\$\d+/g, '?');
  }

  // Adapt PG SQL to SQLite
  function adaptSQL(sql) {
    let s = sql;
    s = s.replace(/\bNOW\(\)/gi, "datetime('now')");
    s = s.replace(/\bCURRENT_DATE\b/g, "date('now')");
    // FILTER (WHERE ...) -> CASE/SUM
    s = s.replace(/COUNT\(\*\)\s+FILTER\s*\(WHERE\s+([^)]+)\)/gi, (_, cond) => {
      return `SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END)`;
    });
    return s;
  }

  function extractTableName(sql) {
    const m = sql.match(/INSERT\s+INTO\s+(\w+)/i);
    return m ? m[1] : null;
  }

  db = {
    type: 'sqlite',
    query: async (text, params = []) => {
      const sql = adaptSQL(convertPlaceholders(text));
      const trimmed = sql.trim();
      const upper = trimmed.toUpperCase();

      try {
        if (upper.startsWith('SELECT') || upper.startsWith('WITH')) {
          return { rows: sqlite.prepare(sql).all(...params) };
        }

        if (upper.startsWith('INSERT')) {
          const hasReturning = /RETURNING\s+/i.test(sql);
          const tableName = extractTableName(sql);

          // Generate UUID for the id column
          const id = uuidv4();

          if (hasReturning) {
            const baseSql = sql.replace(/\s*RETURNING\s+.*/i, '');
            // Inject ID into the INSERT
            const modifiedSql = baseSql.replace(
              /VALUES\s*\(/i,
              'VALUES (?,'
            );
            const modifiedParams = [id, ...params];

            // Also need to add id to column list
            const colMatch = baseSql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
            let finalSql, finalParams;

            if (colMatch) {
              finalSql = baseSql.replace(
                /\(([^)]+)\)\s*VALUES\s*\(/i,
                `(id, $1) VALUES (?,`
              );
              finalParams = [id, ...params];
            } else {
              finalSql = baseSql;
              finalParams = params;
            }

            sqlite.prepare(finalSql).run(...finalParams);

            // Fetch the inserted row
            if (tableName) {
              const row = sqlite.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
              return { rows: row ? [row] : [] };
            }
            return { rows: [{ id }] };
          } else {
            // No RETURNING - still add UUID
            const colMatch = sql.match(/INSERT\s+INTO\s+\w+\s*\(([^)]+)\)/i);
            if (colMatch) {
              const finalSql = sql.replace(
                /\(([^)]+)\)\s*VALUES\s*\(/i,
                `(id, $1) VALUES (?,`
              );
              sqlite.prepare(finalSql).run(id, ...params);
            } else {
              sqlite.prepare(sql).run(...params);
            }
            return { rows: [] };
          }
        }

        if (upper.startsWith('UPDATE')) {
          const hasReturning = /RETURNING\s+/i.test(sql);
          const baseSql = sql.replace(/\s*RETURNING\s+.*/i, '');
          const info = sqlite.prepare(baseSql).run(...params);

          if (hasReturning && info.changes > 0) {
            const tableName = sql.match(/UPDATE\s+(\w+)/i)?.[1];
            // Try to find the updated row by the last WHERE condition
            const whereMatch = baseSql.match(/WHERE\s+(.+)/i);
            if (tableName && whereMatch) {
              const selectSql = `SELECT * FROM ${tableName} WHERE ${convertPlaceholders(whereMatch[1])}`;
              // Extract the WHERE params (last params in the array)
              const whereParamCount = (whereMatch[1].match(/\?/g) || []).length;
              const whereParams = params.slice(params.length - whereParamCount);
              try {
                const rows = sqlite.prepare(selectSql).all(...whereParams);
                return { rows };
              } catch (e) {
                return { rows: [{ changes: info.changes }] };
              }
            }
          }
          return { rows: [], changes: info.changes };
        }

        if (upper.startsWith('DELETE')) {
          const hasReturning = /RETURNING\s+/i.test(sql);
          const baseSql = sql.replace(/\s*RETURNING\s+.*/i, '');

          if (hasReturning) {
            // Get the rows before deleting
            const tableName = sql.match(/DELETE\s+FROM\s+(\w+)/i)?.[1];
            const whereMatch = baseSql.match(/WHERE\s+(.+)/i);
            let existingRows = [];
            if (tableName && whereMatch) {
              const selectSql = `SELECT * FROM ${tableName} WHERE ${whereMatch[1]}`;
              try {
                existingRows = sqlite.prepare(selectSql).all(...params);
              } catch (e) { /* ignore */ }
            }
            sqlite.prepare(baseSql).run(...params);
            return { rows: existingRows };
          }

          const info = sqlite.prepare(baseSql || sql).run(...params);
          return { rows: [], changes: info.changes };
        }

        // DDL or other
        sqlite.exec(sql);
        return { rows: [] };
      } catch (err) {
        console.error('SQLite query error:', err.message, '\nSQL:', sql.substring(0, 200));
        throw err;
      }
    },
    sqlite,
  };
}

module.exports = db;
