import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

async function run() {
  const url = process.env.MONGO_URL;
  if (!url) throw new Error('MONGO_URL env var is required');

  await mongoose.connect(url);

  const users = mongoose.connection.collection('users');
  const broken = await users
    .find({ $or: [{ token: { $exists: false } }, { token: null }, { token: '' }] })
    .toArray();

  for (const u of broken) {
    await users.updateOne({ _id: u._id }, { $set: { token: uuidv4() } });
    console.log(`fixed: ${u.username ?? u.userId ?? u._id}`);
  }

  console.log(`done: ${broken.length} users`);
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
