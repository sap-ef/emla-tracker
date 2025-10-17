#!/usr/bin/env node

/**
 * Fix HDI Deploy Script
 *
 * Removes the problematic parameter `try_fast_table_migration=true` from the
 * generated gen/db/package.json file that causes deployment errors on some
 * HANA versions.
 */

const fs = require('fs');
const path = require('path');

const packageJsonPath = path.join(__dirname, 'gen', 'db', 'package.json');

if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  if (packageJson.scripts && packageJson.scripts.start) {
    // Remove the problematic parameter
    const originalStart = packageJson.scripts.start;
    packageJson.scripts.start = originalStart.replace(
      / --parameter com\.sap\.hana\.di\.table\/try_fast_table_migration=true/g,
      ''
    );

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('[fix-hdi-deploy] Removed try_fast_table_migration parameter from gen/db/package.json');
  }
} else {
  console.log('[fix-hdi-deploy] gen/db/package.json not found, skipping fix');
}