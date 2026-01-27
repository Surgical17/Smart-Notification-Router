#!/usr/bin/env node

/**
 * Password Reset Script for SNR - Smart Notification Router
 *
 * Usage inside Docker container:
 *   docker exec -it <container_name> node scripts/reset-password.mjs <email> <new_password>
 *
 * Usage locally:
 *   node scripts/reset-password.mjs <email> <new_password>
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log('SNR - Password Reset Tool');
    console.log('');
    console.log('Usage: node scripts/reset-password.mjs <email> <new_password>');
    console.log('');

    // List existing users
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });

    if (users.length === 0) {
      console.log('No users found in the database.');
    } else {
      console.log('Existing users:');
      for (const user of users) {
        console.log(`  - ${user.email} (${user.name || 'no name'}) [${user.role}] created ${user.createdAt.toISOString()}`);
      }
    }

    process.exit(1);
  }

  const [email, newPassword] = args;

  if (newPassword.length < 6) {
    console.error('Error: Password must be at least 6 characters.');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.error(`Error: No user found with email "${email}".`);

    const users = await prisma.user.findMany({ select: { email: true } });
    if (users.length > 0) {
      console.log('Available users:');
      for (const u of users) {
        console.log(`  - ${u.email}`);
      }
    }

    process.exit(1);
  }

  const hashedPassword = await hash(newPassword, 12);

  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  console.log(`Password successfully reset for ${email}.`);
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
