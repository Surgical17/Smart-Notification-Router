const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Clearing existing data...');

  // Delete in correct order to respect foreign key constraints
  await prisma.correlationState.deleteMany();
  await prisma.correlationRule.deleteMany();
  await prisma.webhookLog.deleteMany();
  await prisma.rule.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.notificationChannel.deleteMany();
  await prisma.serverState.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Database cleared');

  // Create test user
  console.log('👤 Creating test user...');

  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
    },
  });

  console.log('✅ Test user created');
  console.log('');
  console.log('📝 Test User Credentials:');
  console.log('   Email: test@example.com');
  console.log('   Password: password123');
  console.log('');
  console.log('🚀 You can now login at http://localhost:3000/login');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
