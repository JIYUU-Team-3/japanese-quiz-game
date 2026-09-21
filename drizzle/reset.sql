-- Drops all tables so migrations and seed can re-run cleanly on local/preview environments.
DROP TABLE IF EXISTS session_answers;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS choices;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS topics;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS d1_migrations;
