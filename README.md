# Device-Cheklangan Login (WebAuthn)

Login/parol + **WebAuthn/FIDO2** (Windows Hello, TPM) orqali ayrim foydalanuvchilarni faqat ruxsat etilgan laptop(lar)dan kirishga cheklash.

Browser fingerprint emas — **kriptografik qurilma kaliti** ishlatiladi. Private key faqat laptopning TPM/Secure Enclave da saqlanadi va **nusxalanmaydi**.

## Ishga tushirish

### Backend

```bash
cd backend
npm install
npm run seed
npm run dev    # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev    # http://localhost:5173
```

## Demo hisoblar

| Login | Parol | Device cheklovi |
|-------|-------|-----------------|
| admin | admin123 | Yo'q |
| user1 | user123 | Ha (laptop WebAuthn bilan bog'langan bo'lishi kerak) |

## Workflow

1. Admin `/admin` da foydalanuvchi yaratadi (`deviceRestricted = true`)
2. Admin berilgan laptopda `/enroll?userId=2` ochadi
3. **Windows Hello / PIN** bilan laptop kaliti ro'yxatdan o'tkaziladi
4. User login qilganda: parol + Windows Hello tasdiqlashi talab qilinadi
5. Boshqa kompyuterdan kirish mumkin emas — private key shu laptopda

## Nima uchun fingerprint emas?

| Browser fingerprint | WebAuthn (hozirgi yechim) |
|--------------------|---------------------------|
| Header nusxalash mumkin | Private key TPM da, nusxalanmaydi |
| Brauzer yangilansa o'zgarishi mumkin | Hardware-bound, barqaror |
| Kriptografik emas | FIDO2/W3C standart, imzo tekshiruvi |

## API

| Method | Endpoint | Tavsif |
|--------|----------|--------|
| POST | `/auth/login` | Login (cheklangan user uchun `requiresWebAuthn: true`) |
| POST | `/auth/webauthn/options` | Windows Hello authentication options |
| POST | `/auth/webauthn/verify` | WebAuthn tasdiqlash → JWT |
| POST | `/webauthn/register/options` | Laptop enrollment (admin) |
| POST | `/webauthn/register/verify` | Laptop kalitini saqlash |
| GET | `/admin/users/:id/devices` | Bog'langan laptoplar |

## Production

**Live:** https://device-certificate-production.up.railway.app

WebAuthn sozlamalari:

```
RP_ID=device-certificate-production.up.railway.app
ORIGIN=https://device-certificate-production.up.railway.app
JWT_SECRET=long-random-secret
```

WebAuthn HTTPS yoki `localhost` da ishlaydi.

## Railway Deploy

Batafsil qo'llanma: [RAILWAY.md](./RAILWAY.md)

Qisqacha:
1. GitHub repo → Railway ga ulang
2. Volume mount: `/data` (SQLite uchun)
3. `JWT_SECRET` va `ADMIN_PASSWORD` ni o'zgartiring
4. Deploy — bitta URL da frontend + backend ishlaydi
