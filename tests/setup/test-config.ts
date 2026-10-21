/**
 * Shared test configuration constants and helpers.
 */
export const DEFAULT_TEST_DB_URL =
  "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p01";

export const TEST_JWT_SECRET =
  "test_jwt_secret_key_must_be_at_least_32_characters_long_for_tests";

export function getTestDbUrl(): string {
  return process.env.DATABASE_TEST_URL || DEFAULT_TEST_DB_URL;
}
