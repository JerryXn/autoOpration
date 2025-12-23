const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

/**
 * Load environment variables based on APP_ENV.
 * Defaults to 'dev' if not specified.
 */
function loadEnv() {
  const env = process.env.APP_ENV || 'dev';
  const rootDir = path.resolve(__dirname, '../../');
  
  // Try loading .env.{env} first
  const envFile = path.join(rootDir, `.env.${env}`);
  
  if (fs.existsSync(envFile)) {
    console.log(`[env] Loading configuration from .env.${env}`);
    const result = dotenv.config({ path: envFile });
    if (result.error) {
      console.error(`[env] Error loading .env.${env}:`, result.error);
    }
  } else {
    // Fallback to standard .env if specific one doesn't exist
    const defaultEnv = path.join(rootDir, '.env');
    if (fs.existsSync(defaultEnv)) {
      console.log(`[env] .env.${env} not found, falling back to .env`);
      dotenv.config({ path: defaultEnv });
    } else {
      console.warn(`[env] No .env file found for environment: ${env}`);
    }
  }
  
  // Print active DB config for verification (masking password)
  const dbHost = process.env.MYSQL_HOST || 'unknown';
  const dbName = process.env.MYSQL_DATABASE || 'unknown';
  console.log(`[env] Active Environment: ${env} | DB: ${dbHost}/${dbName}`);
}

module.exports = { loadEnv };
