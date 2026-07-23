import mysql from 'mysql2/promise';

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  // DATE columns (birthday, daily_challenges.active_date) come back as plain
  // 'YYYY-MM-DD' strings instead of JS Date objects — the rest of the app
  // already treats them as strings (comparisons, string concatenation,
  // passing straight to <input type="date">), so a Date object silently
  // breaks those call sites instead of erroring. DATETIME/TIMESTAMP columns
  // are untouched.
  dateStrings: ['DATE'],
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

export default db;
