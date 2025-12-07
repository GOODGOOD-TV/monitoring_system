//mysql 풀
import mysql from 'mysql2/promise';

export const pool = await mysql.createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: +(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASS ?? 'abcd',
  database: process.env.DB_NAME ?? 'sentory',
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  timezone: 'Z',
});
