# THPTMockTest

Personal web application for Vietnamese high-school Mathematics mock exams.
It includes ADMIN exam/student management and the complete timed STUDENT attempt,
grading, result-history, and reporting flows.

## Requirements

- Node.js 22.x (22.13 or newer)
- npm
- MongoDB replica set or sharded cluster (required for transactions)
- Cloudinary account

## Local setup

Create `.env.local` using the placeholders in `.env.example`, then run:

```bash
npm ci
npm run dev
```

Create the first administrator once, using the interactive password prompt:

```bash
npm run admin:create
```

The command refuses to create another administrator when one already exists.
It also accepts environment variables inherited from the shell when `.env.local`
is absent, which is useful when bootstrapping a production database locally.

For exam PDFs, enable PDF/ZIP delivery in the Cloudinary product-environment
security settings. The ADMIN browser obtains short-lived signed parameters and
uploads PDFs directly to Cloudinary; no unsigned upload preset is required.

## Checks

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm audit
npm run build
```

## Deployment

For Vercel, use the repository defaults and configure these server-only variables
for Production and Preview as appropriate:

- `MONGODB_URI`
- `AUTH_SECRET` (at least 32 random characters)
- `AUTH_TRUST_HOST` (`true` only when the deployment host is trusted; Vercel is
  detected automatically by Auth.js)
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Generate `AUTH_SECRET` with a cryptographically secure password generator, never
from the example value. Run `npm run admin:create` once from an interactive local
terminal connected to the production MongoDB database.

Cloudinary must have PDF/ZIP delivery enabled. Exam PDFs use random public IDs but
ordinary Cloudinary `upload` delivery URLs remain shareable bearer URLs; use only
exam material suitable for that delivery model. No unsigned upload preset is
needed.

The application initializes declared MongoDB indexes on first access. Ensure the
production database user can create indexes and deploy new index/schema versions
during low traffic; do not run destructive `syncIndexes()` automatically.

### Practice mode persistence rollout

Exam attempts without `mode` are read as `MOCK`, and Exams without
`practiceEnabled` are read as `false`. Practice creation remains server-side only
and is blocked until the explicit migration verifies the database. The Mongoose
schema deliberately does not declare either attempt-number index, preventing
application startup from changing their production migration state.

Run the dry-run against the target database first:

```bash
npm run db:migrate:practice-attempts -- --dry-run
```

During a low-traffic deployment window, apply and then independently verify:

```bash
npm run db:migrate:practice-attempts -- --apply
npm run db:migrate:practice-attempts -- --verify
```

The idempotent apply command performs bounded backfills for missing attempt
`mode` and Exam `practiceEnabled`, checks mode and expiration invariants, rejects
duplicate target keys, verifies the unchanged cross-mode active-attempt index,
creates `unique_attempt_number_per_student_exam_mode`, verifies it, and only then
drops `unique_attempt_number_per_student_exam`. It never calls `syncIndexes()`.

Rollback is safe only before cross-mode attempt-number collisions exist. Disable
Practice creation first, then run:

```bash
npm run db:migrate:practice-attempts -- --rollback
```

The rollback refuses to proceed if Mock and Practice records share an attempt
number for the same student and Exam. In that case, retain the new index or first
remove or renumber Practice data through an audited data repair. Practice records
store `expiresAt: null`; Mock records must retain a finite expiration.

## Architecture

Application features follow this dependency direction:

```text
UI -> API Client -> Route Handler -> Service -> DAO -> Mongoose Model -> MongoDB
```

Server-only integrations live under `src/lib`, while reusable UI components live
under `src/components`.
