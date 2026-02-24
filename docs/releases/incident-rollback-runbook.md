# Incident Rollback Runbook

## Trigger conditions
- Crash loop or launch failure after auto-update.
- Signature/checksum mismatch in promoted artifacts.
- Severe regression impacting writing, sync, or data safety.

## Immediate containment
1. Freeze promotion jobs for affected channel.
2. Pin minimum allowed version to last known good in updater policy.
3. Move channel pointer back to previously signed release metadata.

## Recovery actions
1. Re-publish known-good checksums/signatures for rollback target.
2. Mark failed version as blocked in release metadata.
3. Validate launch fallback mode appears for impacted clients.
4. Ask users to restart; updater should remain on last good build.

## Verification
- CI verifies rollback artifacts and signatures.
- Desktop smoke test on macOS/Windows/Linux.
- Confirm in-app updater no longer offers the bad version.

## Post-incident
- Capture root cause and timeline in incident notes.
- Add regression test or CI check that would have prevented the issue.
- Update this runbook and release checklist with lessons learned.
