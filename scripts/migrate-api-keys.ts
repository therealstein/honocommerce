#!/usr/bin/env bun
/**
 * Migrate API Keys to Hashed Format
 * 
 * This script migrates existing plaintext API keys to secure hashed format.
 * Run this once after deploying the new security implementation.
 * 
 * Usage:
 *   bun run scripts/migrate-api-keys.ts
 */

import { db } from '../src/db';
import { apiKeys } from '../src/db/schema/api-keys';
import { eq, isNotNull, and } from 'drizzle-orm';
import { hashApiKeyPair, getKeyPrefix } from '../src/lib/api-key-crypto';

async function migrateApiKeys() {
  console.log('🔄 Starting API key migration to hashed format...\n');

  try {
    // Find all keys that have plaintext but no hashes
    const keysToMigrate = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          isNotNull(apiKeys.consumerKey),
          isNotNull(apiKeys.consumerSecret),
          eq(apiKeys.isDeleted, false)
        )
      );

    console.log(`📋 Found ${keysToMigrate.length} keys to migrate\n`);

    if (keysToMigrate.length === 0) {
      console.log('✅ No keys need migration. All keys are already hashed.\n');
      return;
    }

    let migrated = 0;
    let failed = 0;

    for (const key of keysToMigrate) {
      // Skip if already has hashes
      if (key.keyHash && key.secretHash) {
        console.log(`⏭️  Key ${key.id} already has hashes, skipping`);
        continue;
      }

      if (!key.consumerKey || !key.consumerSecret) {
        console.log(`⚠️  Key ${key.id} missing plaintext values, skipping`);
        failed++;
        continue;
      }

      try {
        // Hash the plaintext credentials
        const hashed = await hashApiKeyPair(key.consumerKey, key.consumerSecret);

        // Update the database
        await db
          .update(apiKeys)
          .set({
            keyPrefix: hashed.keyPrefix,
            keyHash: hashed.keyHash,
            secretHash: hashed.secretHash,
            updatedAt: new Date(),
          })
          .where(eq(apiKeys.id, key.id));

        console.log(`✅ Migrated key ${key.id}: ${hashed.keyPrefix}...`);
        migrated++;
      } catch (error) {
        console.error(`❌ Failed to migrate key ${key.id}:`, error);
        failed++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total found: ${keysToMigrate.length}`);
    console.log(`   Migrated: ${migrated}`);
    console.log(`   Failed: ${failed}`);
    console.log('\n✅ Migration complete!\n');

    if (migrated > 0) {
      console.log('⚠️  IMPORTANT: After verifying the migration worked correctly,');
      console.log('   you can remove the plaintext columns by running:');
      console.log('   ALTER TABLE api_keys DROP COLUMN consumer_key;');
      console.log('   ALTER TABLE api_keys DROP COLUMN consumer_secret;\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateApiKeys();
