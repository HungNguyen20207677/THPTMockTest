# THPTMockTest

Personal web application for Vietnamese high-school Mathematics mock exams.
This repository currently contains the project foundation only.

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

## Checks

```bash
npm run format:check
npm run lint
npm run type-check
npm test
npm run build
```

## Architecture

Application features follow this dependency direction:

```text
UI -> API Client -> Route Handler -> Service -> DAO -> Mongoose Model -> MongoDB
```

Server-only integrations live under `src/lib`, while reusable UI components live
under `src/components`.
