-- Runs once on first container start (empty volume).
-- Creates the database used by the integration test-suite.
CREATE DATABASE vaynex_test OWNER vaynex;
\connect vaynex_test
CREATE EXTENSION IF NOT EXISTS postgis;
