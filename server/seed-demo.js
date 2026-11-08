require('dotenv').config();

const path = require('path');
const fs = require('fs');
const db = require('./src/db/pool');

const demos = [
  {
    title: 'NEON AFTER HOURS',
    file: 'demo-neon.mp4',
    category: 'Aesthetic',
    price: 80,
    description: 'Neon-inspired visual edit.',
  },
  {
    title: 'MIDNIGHT RUN',
    file: 'demo-cinematic.mp4',
    category: 'Cinematic',
    price: 120,
    description: 'A cinematic motion preview.',
  },
  {
    title: 'ANIME ENERGY',
    file: 'demo-anime.mp4',
    category: 'Anime',
    price: 100,
    description: 'An anime-inspired visual demo.',
  },
  {
    title: 'AFTER THE RAIN',
    file: 'demo-aesthetic.mp4',
    category: 'Aesthetic',
    price: 60,
    description: 'A soft aesthetic visual demo.',
  },
  {
    title: 'NATURE FLOW',
    file: 'demo-nature.mp4',
    category: 'Other',
    price: 70,
    description: 'A nature-inspired visual demo.',
  },
  {
    title: 'VELOCITY',
    file: 'demo-velocity.mp4',
    category: 'Cinematic',
    price: 90,
    description: 'A fast-paced motion demo.',
  },
];

async function main() {
  const { rows: users } = await db.query(
    `SELECT id FROM users ORDER BY created_at ASC LIMIT 1`
  );

  if (!users.length) {
    throw new Error(
      'No user exists. Create an account on EditVault first.'
    );
  }

  const creatorId = users[0].id;

  for (const demo of demos) {
    const filePath = path.resolve('uploads', demo.file);

    if (!fs.existsSync(filePath)) {
      console.log(`SKIPPED: ${demo.file} not found`);
      continue;
    }

    const result = await db.query(
      `
      INSERT INTO edits (
        creator_id,
        title,
        description,
        category,
        price_points,
        original_path,
        preview_path,
        original_filename,
        status
      )
      SELECT $1, $2, $3, $4, $5, $6, $6, $7, 'published'
      WHERE NOT EXISTS (
        SELECT 1
        FROM edits
        WHERE creator_id = $1
          AND title = $2
      )
      RETURNING id, title
      `,
      [
        creatorId,
        demo.title,
        demo.description,
        demo.category,
        demo.price,
        filePath,
        demo.file,
      ]
    );

    if (result.rows.length) {
      console.log(`ADDED: ${result.rows[0].title}`);
    } else {
      console.log(`ALREADY EXISTS: ${demo.title}`);
    }
  }
}

main()
  .catch((error) => {
    console.error('Demo seeding failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });