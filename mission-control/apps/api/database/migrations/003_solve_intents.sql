-- solve() Demand Probe Migration
-- Migration: 003_solve_intents
-- Created: 2026-05-29
-- Description: Creates the solve_intents table backing POST /api/v1/intent
--              (the /demo demand probe). Anonymous, best-effort intent capture
--              used to validate demand for natural-language optimization routing
--              before the router is built.
--
-- Run with: psql -d your_database -f 003_solve_intents.sql
-- Or via Supabase Dashboard SQL Editor

-- ============================================================================
-- SOLVE INTENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS solve_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  email TEXT,
  source TEXT,
  guessed_class TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns (waitlist follow-up, demand analytics)
CREATE INDEX IF NOT EXISTS idx_solve_intents_created_at ON solve_intents(created_at);
CREATE INDEX IF NOT EXISTS idx_solve_intents_guessed_class ON solve_intents(guessed_class);
CREATE INDEX IF NOT EXISTS idx_solve_intents_email ON solve_intents(email) WHERE email IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- This is an anonymous, server-only capture table (no user_id, no auth on the
-- public endpoint). Enable RLS with no permissive policy so it is unreadable
-- by the anon/authenticated client roles; only the service role (which bypasses
-- RLS) inserts and reads it.

ALTER TABLE solve_intents ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
