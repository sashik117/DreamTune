export function buildFilterWhere(filters, params) {
  return filters.map(([key, value]) => {
    params.push(value);
    return `${key} = $${params.length}`;
  });
}

export async function insertRow(pool, table, payload) {
  const columns = Object.keys(payload);
  const values = Object.values(payload);
  const placeholders = values.map((_, index) => `$${index + 1}`);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
  const { rows } = await pool.query(sql, values);
  return rows[0] || null;
}

export async function updateRow(pool, table, id, payload, whereSql = '', whereValues = []) {
  const columns = Object.keys(payload);
  if (!columns.length) return null;
  const values = Object.values(payload);
  const setSql = columns.map((column, index) => `${column} = $${index + 1}`).join(', ');
  const idIndex = values.length + 1;
  const suffix = whereSql ? ` AND ${whereSql(idIndex + 1)}` : '';
  const sql = `UPDATE ${table} SET ${setSql} WHERE id = $${idIndex}${suffix} RETURNING *`;
  const { rows } = await pool.query(sql, [...values, id, ...whereValues]);
  return rows[0] || null;
}

export function createNotFound(message = 'Not found') {
  const error = new Error(message);
  error.status = 404;
  return error;
}
