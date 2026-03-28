-- V1__create_users.sql
-- ============================================================
-- Creates the core users table.
--
-- Every person who registers on SangamAI gets a row here.
-- This table is intentionally lean — it only holds identity
-- and authentication data. Profile-level extras can be added
-- in later migrations without touching this foundational table.
-- ============================================================

CREATE TABLE users (

    -- We use UUID as the primary key rather than a simple
    -- auto-incrementing integer. Why? Because UUIDs are globally
    -- unique across all tables and even across databases. This means
    -- if you ever shard your database or merge datasets, you'll never
    -- have ID collisions. gen_random_uuid() is a built-in PostgreSQL
    -- function that generates a UUID for us automatically on insert.
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The username is how members find and add each other.
    -- UNIQUE ensures no two people share a username.
    -- NOT NULL means you cannot create a user without one.
    username VARCHAR(50) NOT NULL UNIQUE,

    -- Standard email for login and communication.
    email VARCHAR(255) NOT NULL UNIQUE,

    -- We NEVER store plain-text passwords. Ever.
    -- This column stores the BCrypt hash of the password.
    -- BCrypt produces a fixed-length 60-character string,
    -- so VARCHAR(60) is the exact right size for this.
    password_hash VARCHAR(60) NOT NULL,

    -- A human-readable display name shown in the UI.
    -- Unlike username, this doesn't have to be unique —
    -- two people can both be called "Alex" in display terms.
    display_name VARCHAR(100) NOT NULL,

    -- Timestamps for auditing. These tell you when the record
    -- was created and last modified. TIMESTAMPTZ means
    -- "timestamp with time zone" — always store times in UTC.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes speed up queries that search by a specific column.
-- Without an index, PostgreSQL scans every row in the table
-- to find a match (slow). With an index, it jumps directly
-- to the matching rows (fast).
--
-- We index username and email because these are the columns
-- we'll search by most often: "find user by username" (when
-- a host adds a member) and "find user by email" (at login).
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);