#!/usr/bin/env node
// Runs periodically to delete expired stories and their media files.
const mysql = require('/Users/toninichev/Applications/emmas-space/node_modules/mysql2/promise');
const fs = require('fs');
const path = require('path');

const ROOT_DIR = '/Users/toninichev/Applications/emmas-space';
const UPLOADS_DIR = path.join(ROOT_DIR, 'public/uploads');

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

  // Fetch expired story media URLs before deleting
  const [expired] = await db.execute(
    'SELECT id, media_url FROM stories WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
  );

  if (expired.length === 0) {
    console.log('[Stories cleanup] Nothing to clean up.');
    await db.end();
    return;
  }

  // Delete media files from disk
  for (const story of expired) {
    try {
      const filename = path.basename(story.media_url);
      const filepath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[Stories cleanup] Deleted file: ${filename}`);
      }
    } catch (e) {
      console.error(`[Stories cleanup] Failed to delete file for story ${story.id}:`, e.message);
    }
  }

  // Delete from DB (story_views cascade deletes automatically)
  const [result] = await db.execute(
    'DELETE FROM stories WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
  );
  console.log(`[Stories cleanup] Deleted ${result.affectedRows} expired stories from DB.`);

  await db.end();
}

cleanup().catch(e => { console.error(e); process.exit(1); });
