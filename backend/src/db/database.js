const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'announcements.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create table
db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    title         TEXT    NOT NULL,
    body          TEXT    NOT NULL,
    publication_date TEXT NOT NULL,
    last_update   TEXT    NOT NULL,
    categories    TEXT    NOT NULL,
    created_at    TEXT    NOT NULL
  );
`);

// Seed if empty
const count = db.prepare('SELECT COUNT(*) as c FROM announcements').get();
if (count.c === 0) {
  const insert = db.prepare(`
    INSERT INTO announcements (title, body, publication_date, last_update, categories, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const now = new Date();
  const seeds = [
    { title: 'Title 1',  body: 'Community update about city improvements and upcoming projects.', pub: '2023-08-11T04:38:00.000Z', upd: '2023-08-11T04:38:00.000Z', cats: ['City'] },
    { title: 'Title 2',  body: 'Notice about road closures in downtown area this weekend.', pub: '2023-08-11T04:36:00.000Z', upd: '2023-08-11T04:36:00.000Z', cats: ['City'] },
    { title: 'Title 3',  body: 'City hall will be closed for maintenance on Friday.', pub: '2023-08-11T04:35:00.000Z', upd: '2023-08-11T04:35:00.000Z', cats: ['City'] },
    { title: 'Title 4',  body: 'Spring community cleanup event scheduled for next month.', pub: '2023-04-19T05:14:00.000Z', upd: '2023-04-19T05:14:00.000Z', cats: ['City'] },
    { title: 'Title 5',  body: 'Discount programme for senior citizens extended until year end.', pub: '2023-04-19T05:11:00.000Z', upd: '2023-04-19T05:11:00.000Z', cats: ['City'] },
    { title: 'Title 6',  body: 'New park facilities opening ceremony on April 25th.', pub: '2023-04-19T05:11:00.000Z', upd: '2023-04-19T05:11:00.000Z', cats: ['City'] },
    { title: 'Title 7',  body: 'Free health screening available at the community center.', pub: '2023-03-24T07:27:00.000Z', upd: '2023-03-24T07:27:00.000Z', cats: ['City', 'Health'] },
    { title: 'Title 8',  body: 'Emergency preparedness workshop — register by end of week.', pub: '2023-03-24T07:26:00.000Z', upd: '2023-03-24T07:26:00.000Z', cats: ['City', 'Health'] },
    { title: 'Title 9',  body: 'Kids & Family summer programme registration now open.', pub: '2023-03-24T07:26:00.000Z', upd: '2023-03-24T07:26:00.000Z', cats: ['City', 'Health'] },
    { title: 'Title 10', body: 'Cultural festival returns this summer — call for volunteers.', pub: '2023-03-24T07:26:00.000Z', upd: '2023-03-24T07:26:00.000Z', cats: ['City', 'Health'] },
  ];

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      insert.run(r.title, r.body, r.pub, r.upd, JSON.stringify(r.cats), r.pub);
    }
  });
  insertMany(seeds);

  console.log('✅ Database seeded with 10 announcements.');
}

module.exports = db;
