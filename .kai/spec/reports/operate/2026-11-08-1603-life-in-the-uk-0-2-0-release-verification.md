# Life in the UK 0.2.0 release verification

## Version

- Version: 0.2.0, a minor release because it adds study content and validation behavior without a breaking interface change.
- Version files: `package.json` and `package-lock.json`.
- Release notes: `CHANGELOG.md`.

## Included notes

### Added

- 15 handbook-aligned and current-context questions in `src/data/questions/chapter3.json` and `src/data/questions/chapter5.json`.
- Five study lessons in `src/data/lessons.ts`.
- A dated current-fact validation gate in `scripts/validate-questions.ts`.

### Changed

- Current-context questions are excluded from handbook mock exams in `src/lib/questions.ts`.
- Question-bank documentation now records 1,611 questions in `README.md`.

### Fixed

- The bundled server serves the built app without requiring `NODE_ENV` in `server/index.ts`.

### Not included

- No confidential official question bank.
- No package publication, deployment configuration change or remote version tag.
- No stylesheet changes.

## Verification

- `npm run questions:validate`: passed, 1,611 questions, 0 errors, 0 warnings.
- `npm run lessons:validate`: passed, 15 lessons and 31 links.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Artifact: `C:\Users\Mega-Mind\AppData\Local\Temp\life-in-the-uk-0.2.0.zip`
- Size: 380,766 bytes.
- SHA-256: `DAD5E43390437467D2B814F069FD8575A7710F7830DD1C39C121776921A1DB7C`.

## Approved branch command

- `git push origin main` was explicitly approved by the user and will be run after the release commit.

## Publish commands left unrun

- `git tag -a v0.2.0 -m "Release 0.2.0"`
- `git push origin v0.2.0`
- No package registry publish command exists in `package.json`.

## Rollback

- Before any later tag or deployment, revert the release commit with `git revert <release-commit>` and push the revert to `main`.
