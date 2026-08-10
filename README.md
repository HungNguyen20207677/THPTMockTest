# THPTMockTest

Personal web application for Vietnamese high-school Mathematics mock exams.
It currently includes authentication, account management, and ADMIN exam setup.

## Requirements

- Node.js 22.13+
- npm
- MongoDB
- Cloudinary account

## Local setup

Create `.env.local` using the variable names in `.env.example`, then run:

```bash
npm install
npm run dev
```

Create the first administrator once, using the interactive password prompt:

```bash
npm run admin:create
```

The command refuses to create another administrator when one already exists.

For exam PDFs, enable PDF/ZIP delivery in the Cloudinary product-environment
security settings. Uploads are proxied through the protected application API and
limited to 15 MB, so the deployment request-body limit should allow and cap that
size appropriately.

## Checks

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm audit
npm run build
```

## Architecture

Application features follow this dependency direction:

```text
UI -> API Client -> Route Handler -> Service -> DAO -> Mongoose Model -> MongoDB
```

Server-only integrations live under `src/lib`, while reusable UI components live
under `src/components`.
