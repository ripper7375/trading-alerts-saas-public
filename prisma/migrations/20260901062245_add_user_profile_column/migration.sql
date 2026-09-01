-- Backfills a real tracked migration for User.profile, which was applied
-- directly to at least one database via `prisma db push` (or manual SQL)
-- outside migration history: no prior migration file creates this column,
-- yet schema.prisma has declared it since the AI Token Metering &
-- Preferences feature (see schema.prisma's own comment on User.profile).
-- Confirmed missing in production via a live P2022 error
-- ("The column `User.profile` does not exist in the current database")
-- surfaced through NextAuth's OAuth callback (`getUserByAccount` ->
-- `prisma.account.findUnique` -> `include: { user: true }`), which is why
-- Google/Twitter sign-in was failing with error=Callback.
-- Additive and nullable: safe to apply to a database that already has it
-- (guarded) or one that doesn't (creates it).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'User' AND column_name = 'profile'
  ) THEN
    ALTER TABLE "User" ADD COLUMN "profile" JSONB;
  END IF;
END $$;
