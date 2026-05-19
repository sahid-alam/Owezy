-- ============================================================
-- Migration 20260519000010: onboarding_completed flag
-- OnboardingInProgressGate checks this (not isProfileComplete) to decide
-- whether to show /onboarding. Phone-skip sets it true immediately.
-- Phone-verify advances to UPI; UPI done/skip sets it true.
-- This lets UPI render after phone OTP even though isProfileComplete is already true.
-- ============================================================

alter table profiles
  add column onboarding_completed boolean not null default false;
