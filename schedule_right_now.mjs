// Runs at midnight daily via PM2 cron.
// Picks a random time between 10am–8pm and schedules a Right Now session for today.
import { createPool } from 'mysql2/promise';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url).pathname, 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const db = createPool({
  host: env.DB_HOST || 'localhost',
  user: env.DB_USER || 'root',
  password: env.DB_PASSWORD,
  database: env.DB_DATABASE || 'emma_tony',
});

// Pick a random minute between 10:00am and 8:00pm
const startMinute = 10 * 60;       // 10:00am in minutes
const endMinute   = 20 * 60;       // 8:00pm in minutes
const randomMinute = startMinute + Math.floor(Math.random() * (endMinute - startMinute));

const scheduledFor = new Date();
scheduledFor.setHours(Math.floor(randomMinute / 60), randomMinute % 60, 0, 0);

// Only schedule if it's in the future
if (scheduledFor > new Date()) {
  await db.execute('INSERT INTO right_now_sessions (scheduled_for) VALUES (?)', [scheduledFor]);
  console.log(`[Right Now] Scheduled for ${scheduledFor.toLocaleTimeString()}`);
} else {
  // Already past — schedule for tomorrow same random time
  scheduledFor.setDate(scheduledFor.getDate() + 1);
  await db.execute('INSERT INTO right_now_sessions (scheduled_for) VALUES (?)', [scheduledFor]);
  console.log(`[Right Now] Scheduled for tomorrow at ${scheduledFor.toLocaleTimeString()}`);
}

await db.end();
