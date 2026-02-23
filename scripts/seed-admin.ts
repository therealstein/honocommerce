#!/usr/bin/env bun
/**
 * Admin User Seed Script
 * Creates the first admin user for Honocommerce
 * 
 * Usage:
 *   bun run scripts/seed-admin.ts
 * 
 * Or with custom credentials:
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepassword bun run scripts/seed-admin.ts
 */

import { db } from '../src/db';
import { user, account } from '../src/db/schema/better-auth';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';

// Configuration from environment or defaults
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@honocommerce.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme123';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Admin';

async function hashPassword(password: string): Promise<string> {
  // Simple hash for demo - better-auth handles proper hashing
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function seedAdmin() {
  console.log('🌱 Seeding admin user...');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`   Name: ${ADMIN_NAME}`);

  try {
    // Check if admin already exists
    const [existingUser] = await db
      .select()
      .from(user)
      .where(eq(user.email, ADMIN_EMAIL))
      .limit(1);

    if (existingUser) {
      console.log('⚠️  Admin user already exists');
      
      // Update role to admin if needed
      if (existingUser.role !== 'admin') {
        await db
          .update(user)
          .set({ role: 'admin', updatedAt: new Date() })
          .where(eq(user.id, existingUser.id));
        console.log('✅ Updated existing user to admin role');
      }
      
      return;
    }

    // Generate IDs
    const userId = crypto.randomUUID();
    const accountId = crypto.randomUUID();

    // Hash password (better-auth will handle proper hashing on first login)
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);

    // Create user
    await db.insert(user).values({
      id: userId,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      emailVerified: true,
      role: 'admin',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Create account (email/password)
    await db.insert(account).values({
      id: accountId,
      userId: userId,
      accountId: userId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('📋 Login credentials:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    console.log('');
    console.log('🔐 You can now sign in at: POST /api/auth/sign-in/email');
    console.log('   Body: { "email": "' + ADMIN_EMAIL + '", "password": "YOUR_PASSWORD" }');
    console.log('');
    console.log('⚠️  Please change the password after first login!');
    
  } catch (error) {
    console.error('❌ Failed to seed admin user:', error);
    process.exit(1);
  }

  process.exit(0);
}

seedAdmin();
