import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10);

  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
    },
  });

  console.log('✅ Test user created/updated');
  console.log('');
  console.log('📝 Test User Credentials:');
  console.log('   Email: test@example.com');
  console.log('   Password: password123');
  console.log('');

  // Optionally create some sample data
  console.log('📦 Creating sample webhook...');

  const webhook = await prisma.webhook.create({
    data: {
      name: 'Sample Webhook',
      description: 'A sample webhook for testing',
      userId: user.id,
      enabled: true,
      matchMode: 'first_match',
    },
  });

  console.log(`✅ Sample webhook created: /api/webhook/${webhook.uniqueUrl}`);
  console.log('');
  console.log('🚀 Setup complete! Login at http://localhost:3000/login');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
