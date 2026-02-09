// Migration script: Add new tariffs and hide old ones
// Usage: node scripts/migrate-tariffs.js <MONGO_URI>
// Example: node scripts/migrate-tariffs.js "mongodb://localhost:27017/telegram-bot"

const { MongoClient } = require('mongodb');

const MONGO_URI = process.argv[2];

if (!MONGO_URI) {
  console.error('Usage: node scripts/migrate-tariffs.js <MONGO_URI>');
  process.exit(1);
}

async function migrate() {
  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db();
    const tariffs = db.collection('tariffs');

    // Create new tariffs
    const newTariffs = [
      { name: 'DEMO', requestsLimit: 200, price: 0, isHidden: false },
      { name: 'BASIC', requestsLimit: 5000, price: 2500, isHidden: false },
      { name: 'NOLIMIT', requestsLimit: 100000000000, price: 5000, isHidden: false },
    ];

    for (const t of newTariffs) {
      const existing = await tariffs.findOne({ name: t.name });
      if (existing) {
        console.log(`Tariff ${t.name} already exists, updating...`);
        await tariffs.updateOne({ name: t.name }, { $set: t });
      } else {
        await tariffs.insertOne(t);
        console.log(`Created tariff: ${t.name}`);
      }
    }

    // Hide old tariffs
    const result = await tariffs.updateMany(
      { name: { $in: ['FREE', 'DEVELOPER', 'UNLIMITED', 'STUDENT'] } },
      { $set: { isHidden: true } },
    );
    console.log(`Hidden ${result.modifiedCount} old tariffs`);

    console.log('Migration complete!');
  } finally {
    await client.close();
  }
}

migrate().catch(console.error);
