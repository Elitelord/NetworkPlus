-- AlterTable (IF NOT EXISTS: safe if you paste this once in Supabase SQL editor)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- One-time backfill: existing accounts skip onboarding. Run only once; re-running sets every user to onboarded.
UPDATE "User" SET "hasCompletedOnboarding" = true;
