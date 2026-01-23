const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('📊 Checking database state...\n');

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  console.log(`Found ${users.length} user(s):\n`);
  users.forEach((user, index) => {
    console.log(`User ${index + 1}:`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.name}`);
    console.log(`  Created: ${user.createdAt}`);
    console.log('');
  });

  const webhooks = await prisma.webhook.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
    },
  });

  console.log(`Found ${webhooks.length} webhook(s):\n`);
  webhooks.forEach((webhook, index) => {
    console.log(`Webhook ${index + 1}:`);
    console.log(`  ID: ${webhook.id}`);
    console.log(`  Name: ${webhook.name}`);
    console.log(`  User ID: ${webhook.userId}`);
    console.log('');
  });

  const channels = await prisma.notificationChannel.findMany({
    select: {
      id: true,
      name: true,
      userId: true,
    },
  });

  console.log(`Found ${channels.length} channel(s):\n`);
  channels.forEach((channel, index) => {
    console.log(`Channel ${index + 1}:`);
    console.log(`  ID: ${channel.id}`);
    console.log(`  Name: ${channel.name}`);
    console.log(`  User ID: ${channel.userId}`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
