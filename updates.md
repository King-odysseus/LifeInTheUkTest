# Cross-OS updates

## 2026-11-08 - Windows

- Changed: expanded handbook coverage, added current-context study content, excluded current context from handbook mock exams, added time-sensitive fact validation, and fixed local production static hosting.
- Key files: `src/data/facts/*.json`, `src/data/questions/*.json`, `src/data/lessons.ts`, `src/lib/questions.ts`, `scripts/validate-questions.ts`, `server/index.ts`.
- Other OS action: run `npm run build`.
- Done on Windows: `npm run typecheck`, `npm run questions:validate`, `npm run lessons:validate` and `npm run build` passed on 2026-11-08.
