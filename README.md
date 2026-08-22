# MyBudget

Vue 3 + Vite admin shell for BillsSite, styled with the Admina Tailwind theme.

## Setup

```bash
npm install
npm run dev
```

Open http://localhost:5173 — the Vite proxy forwards `/api` to `https://budget.hawleywebdesign.com`.

## Auth

Login uses BillsSite endpoints (deploy these PHP files to the live server):

- `POST /api/auth/login.php`
- `POST /api/auth/logout.php`
- `GET /api/auth/me.php`

Tokens are stored in `localStorage` and sent as `Authorization: Bearer <token>`.

## Scripts

- `npm run dev` — local development
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

Production builds call `VITE_API_BASE_URL` from `.env.production` (`https://budget.hawleywebdesign.com`).
