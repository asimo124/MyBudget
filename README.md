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

## Production deploy

Build, then upload **including dotfiles** (`.htaccess` is required for deep links):

```bash
cd /Users/alexhawley/Documents/VueSites/MyBudget
npm run build

# IMPORTANT: use dist/. not dist/* — the glob skips .htaccess
scp -r dist/. USER@SERVER:/var/www/mybudget/
```

Or upload `.htaccess` explicitly after a normal upload:

```bash
scp dist/.htaccess USER@SERVER:/var/www/mybudget/.htaccess
```

Verify deep links return **200** (not Apache "Not Found"):

```bash
./scripts/deploy-check.sh
# or: curl -sI https://mybudget.hawleywebdesign.com/loan-countdown | head -1
```

### Apache vhost (Debian)

If `.htaccess` is uploaded but deep links still 404, the vhost likely has `AllowOverride None`.
Add this to the site config (see `deploy/apache-mybudget.conf.example`):

```apache
<Directory /var/www/mybudget>
    AllowOverride All
    Require all granted
    FallbackResource /index.html
</Directory>
```

Then reload Apache:

```bash
sudo a2enmod rewrite
sudo systemctl reload apache2
```

`FallbackResource /index.html` is the most reliable fix on Apache 2.4+.

Production builds call `VITE_API_BASE_URL` from `.env.production` (`https://budget.hawleywebdesign.com`).
