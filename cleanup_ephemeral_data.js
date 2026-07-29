#!/usr/bin/env node
// Runs periodically to delete finished RPS/Trivia rooms past their expires_at,
// and read notifications old enough that nobody's going back to them.
// Player rows cascade-delete automatically (fk_*_players_room ON DELETE CASCADE).
const mysql = require('/Users/toninichev/Applications/emmas-space/node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = '/Users/toninichev/Applications/emmas-space';

fs.readFileSync(path.join(ROOT_DIR, '.env.local'), 'utf8').split('\n').forEach(line => {
  const match = line.match(/^([^=#]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

async function cleanup() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });

  for (const table of ['rps_rooms', 'trivia_rooms']) {
    const [result] = await db.execute(
      `DELETE FROM ${table} WHERE expires_at IS NOT NULL AND expires_at <= NOW()`
    );
    console.log(`[Game rooms cleanup] Deleted ${result.affectedRows} expired rows from ${table}.`);
  }

  // Notifications are disposable alerts pointing at content that still lives
  // in its own table (messages, posts, etc.) — deleting one never loses data,
  // it just stops nagging about something already seen.
  const [notifResult] = await db.execute(
    'DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at <= DATE_SUB(NOW(), INTERVAL 90 DAY)'
  );
  console.log(`[Notifications cleanup] Deleted ${notifResult.affectedRows} old read notifications.`);

  await db.end();
}

cleanup().catch(e => { console.error(e); process.exit(1); });
