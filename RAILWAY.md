# Railway Deploy

Bitta Railway servisi: frontend + backend birgalikda ishlaydi.

## 1. GitHub ga push qiling

```bash
git init
git add .
git commit -m "Railway deploy"
git remote add origin <your-repo>
git push -u origin main
```

## 2. Railway da loyiha yarating

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
2. Repongizni tanlang
3. Root directory: loyiha root (`devive-certificate/`)

## 3. Volume qo'shing (SQLite uchun — muhim!)

Railway dashboard → servis → **Volumes** → **Add Volume**

| Sozlama | Qiymat |
|---------|--------|
| Mount path | `/data` |

Bu SQLite ma'lumotlarini redeploy da saqlab qoladi.

## 4. Environment Variables

Railway → servis → **Variables**:

| Variable | Qiymat | Izoh |
|----------|--------|------|
| `JWT_SECRET` | `uzun-random-string` | **Majburiy** — o'zgartiring |
| `NODE_ENV` | `production` | |
| `DB_PATH` | `/data/app.db` | Volume bilan |
| `ADMIN_PASSWORD` | `kuchli-parol` | Production da o'zgartiring |
| `DEMO_PASSWORD` | `kuchli-parol` | Ixtiyoriy |

**WebAuthn** (Railway avtomatik beradi, qo'lda ham bo'ladi):

| Variable | Qiymat |
|----------|--------|
| `RAILWAY_PUBLIC_DOMAIN` | Railway avtomatik qo'shadi |
| `RP_ID` | `your-app.up.railway.app` (custom domain bo'lsa shu domain) |
| `ORIGIN` | `https://your-app.up.railway.app` |

> `RAILWAY_PUBLIC_DOMAIN` o'rnatilsa `RP_ID` va `ORIGIN` avtomatik hisoblanadi.

Custom domain ishlatsangiz:
```
RP_ID=app.sizning-domen.uz
ORIGIN=https://app.sizning-domen.uz
```

## 5. Deploy

Railway avtomatik build qiladi:

```
npm run build  → frontend + backend
npm start      → server ishga tushadi
```

Health check: `GET /health`

## 6. Birinchi kirish

Deploy tugagach:

- URL: `https://your-app.up.railway.app`
- Admin: `admin` / siz belgilagan `ADMIN_PASSWORD` (default: `admin123`)
- Demo user: `user1` / `user123`

**Muhim:** Production da `ADMIN_PASSWORD` ni albatta o'zgartiring!

## 7. Laptop bog'lash

1. `https://your-app.up.railway.app` da admin bilan kiring
2. `/enroll` sahifasida user tanlang
3. Windows Hello bilan laptop bog'lang

WebAuthn HTTPS da ishlaydi — Railway buni avtomatik ta'minlaydi.

## Muammolar

| Muammo | Yechim |
|--------|--------|
| Ma'lumotlar yo'qoladi | Volume `/data` ga ulanganini tekshiring |
| WebAuthn ishlamaydi | `RP_ID` va `ORIGIN` domen bilan mos kelishini tekshiring |
| Build xato | Node 20+ kerak (engines package.json da) |
| 502 error | `/health` endpoint ishlayotganini tekshiring |
