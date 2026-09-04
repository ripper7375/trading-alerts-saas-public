-- Changes the new-user default Theme Mode from Dark Trading Terminal to
-- Light Clean Mode (Davin's request, 2026-09-04 ad-hoc session -- see
-- davintrade-appearance-stack/theme-mode-fix-manifest-work-completion.md).
-- Metadata-only, zero data impact: every real insert into UserAppearance
-- goes through saveAppearanceAction's upsert, which always passes an
-- explicit `theme` value, so this column default is only ever consulted
-- if a row is ever created by something that omits it -- not the case in
-- any current code path. Existing rows are untouched either way.
ALTER TABLE "UserAppearance" ALTER COLUMN "theme" SET DEFAULT 'light';
