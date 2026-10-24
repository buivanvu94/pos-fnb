-- Initialize secondary test database if it does not already exist
SELECT 'CREATE DATABASE pos_test_p01'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pos_test_p01')\gexec
