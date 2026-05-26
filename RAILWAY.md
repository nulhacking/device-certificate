# Railway Deploy

**Production URL:** https://device-certificate-production.up.railway.app

Bitta Railway servisi: frontend + backend birgalikda ishlaydi.

## Railway Variables (tavsiya etilgan)

Railway dashboard → servis → **Variables**:

| Variable | Qiymat |
|----------|--------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | uzun random string |
| `DB_PATH` | `/data/app.db` |
| `RP_ID` | `device-certificate-production.up.railway.app` |
| `ORIGIN` | `https://device-certificate-production.up.railway.app` |
| `CORS_ORIGIN` | `https://device-certificate-production.up.railway.app` |
| `ADMIN_PASSWORD` | kuchli parol |

> Agar `ORIGIN` yoki `CORS_ORIGIN` da `localhost` qolsa, kod production da avtomatik to'g'ri domenni ishlatadi.

To'liq namuna: [`.env.railway.example`](./.env.railway.example)

## Volume (SQLite — muhim!)

Railway dashboard → servis → **Volumes** → mount path: `/data`

## Tekshirish

Deploy tugagach:

```bash
curl https://device-certificate-production.up.railway.app/health
```

Kutilgan javob:

```json
{
  "status": "ok",
  "auth": "webauthn",
  "origin": "https://device-certificate-production.up.railway.app",
  "rpID": "device-certificate-production.up.railway.app",
  "production": true
}
```

## Birinchi kirish

1. https://device-certificate-production.up.railway.app/login
2. Admin: `admin` / `ADMIN_PASSWORD`
3. `/enroll` da laptop bog'lash (Windows Hello)

## Laptop bog'lash

1. Admin bilan kiring
2. `/enroll?userId=2` oching
3. Windows Hello / PIN bilan laptopni userga bog'lang
4. Endi shu user faqat shu laptopdan login qila oladi

## Muammolar

| Muammo | Yechim |
|--------|--------|
| WebAuthn ishlamaydi | `/health` da `origin` va `rpID` domen bilan mos ekanini tekshiring |
| Ma'lumotlar yo'qoladi | Volume `/data` ulanganini tekshiring |
| 502 error | `/health` endpoint ishlayotganini tekshiring |
