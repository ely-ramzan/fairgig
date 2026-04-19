# Seed test accounts (local Auth service :8001)

Run with Auth running and `DATABASE_URL` set in `d:\fairgig\.env`.

Replace `CITY_ZONE_ID` with a real UUID from `GET http://localhost:8001/api/auth/city-zones` (required for `worker`).

## Worker

```http
POST http://localhost:8001/api/auth/register
Content-Type: application/json

{
  "email": "worker@fairgig.test",
  "password": "Test1234!",
  "display_name": "Test Worker",
  "role": "worker",
  "city_zone_id": "CITY_ZONE_ID"
}
```

## Verifier

```http
POST http://localhost:8001/api/auth/register
Content-Type: application/json

{
  "email": "verifier@fairgig.test",
  "password": "Test1234!",
  "display_name": "Test Verifier",
  "role": "verifier"
}
```

## Advocate

```http
POST http://localhost:8001/api/auth/register
Content-Type: application/json

{
  "email": "advocate@fairgig.test",
  "password": "Test1234!",
  "display_name": "Test Advocate",
  "role": "advocate"
}
```

## Grievance service Prisma client

From `services/grievance`:

```bash
npm install
npm run prisma:generate
```

Use the local CLI (`npm run prisma:generate`), not `npx prisma@latest generate`, so Prisma 6 matches `package.json`.
