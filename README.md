# codebase-fe

Template frontend berbasis **Next.js 16 (App Router)** dan **TanStack** (Query, Form, Store), pasangan dari backend [`codebase-go`](https://github.com/z-alamsyah/codebase-go). Login memakai **Zitadel** (OIDC), role per tenant (multi-tenant), dan semua panggilan ke backend lewat **BFF** sehingga token tidak pernah sampai ke browser.

Aturan codebase ada di [`docs/CODEBASE_RULES.md`](docs/CODEBASE_RULES.md). Panduan lengkap integrasi Zitadel (backend + frontend) ada di [`codebase-go/docs/ZITADEL_INTEGRATION.md`](https://github.com/z-alamsyah/codebase-go/blob/main/docs/ZITADEL_INTEGRATION.md).

## Daftar Isi

1. [Fitur](#1-fitur)
2. [Arsitektur](#2-arsitektur)
3. [Struktur Folder](#3-struktur-folder)
4. [Prasyarat](#4-prasyarat)
5. [Quick Start: dari Clone sampai Login](#5-quick-start-dari-clone-sampai-login)
6. [Konfigurasi (.env.local)](#6-konfigurasi-envlocal)
7. [Auth, Tenant, dan BFF](#7-auth-tenant-dan-bff)
8. [Memakai Endpoint Backend Baru](#8-memakai-endpoint-backend-baru)
9. [Membuat Halaman / Fitur Baru](#9-membuat-halaman--fitur-baru)
10. [State Management](#10-state-management)
11. [Testing](#11-testing)
12. [Docker dan CI](#12-docker-dan-ci)
13. [Perintah](#13-perintah)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Fitur

- **Login Zitadel** (OIDC Authorization Code + PKCE) lewat `@zitadel/next-auth`, dengan perbaikan yang terbukti perlu saat diuji: token hanya di server, refresh token aman terhadap rotasi Zitadel, dan URL callback memakai URL publik.
- **Multi-tenant:** tenant aktif ada di URL (`/[tenant]/...`), divalidasi terhadap role user, lalu dikirim ke backend sebagai `X-Tenant-ID`.
- **BFF** `/api/backend/*`: menambahkan access token, tenant, dan request id; memeriksa Origin (CSRF) dan allowlist path; satu baris log per request.
- **Client API bertipe** hasil generate dari Swagger backend (Hey API), termasuk `queryOptions` dan `mutationOptions` untuk TanStack Query.
- **Contoh fitur users:** detail user (prefetch di server + `useQuery`) dan form buat user (TanStack Form + zod, error per field dari backend).
- **Keamanan:** CSP, header keamanan, cookie session terenkripsi (`httpOnly`), validasi env saat build dan start.
- **Log server** terstruktur (pino) dengan redaction. Tracing dan metrics sengaja tidak dipasang di frontend (cukup di backend).
- **Test:** unit (Vitest + Testing Library + MSW) dan E2E (Playwright) terhadap stack asli.
- **Docker** (standalone, non-root) dan **CI** GitHub Actions.

### Stack

| Kebutuhan           | Library                                         | Versi                   |
| ------------------- | ----------------------------------------------- | ----------------------- |
| Runtime             | Node.js                                         | 24 (LTS)                |
| Framework           | Next.js (App Router, Cache Components)          | 16.4                    |
| Data dari server    | @tanstack/react-query                           | 5.104                   |
| Form                | @tanstack/react-form + zod                      | 1.33 / 4.6              |
| State global client | @tanstack/react-store                           | 0.11                    |
| Client API          | @hey-api/openapi-ts                             | 0.99                    |
| Auth                | @zitadel/next-auth + @auth/core + openid-client | 1.1 / 0.41 / 6.8        |
| UI                  | Tailwind CSS + shadcn/ui (Base UI)              | 4.3                     |
| Env                 | @t3-oss/env-nextjs                              | 0.13                    |
| Log                 | pino                                            | 10.4                    |
| Test                | Vitest + Testing Library + MSW + Playwright     | 5.0 / 16.3 / 3.0 / 1.64 |
| Package manager     | pnpm                                            | 12                      |

---

## 2. Arsitektur

### 2.1 Layer

| Layer            | Folder                            | Tanggung jawab                                                                         |
| ---------------- | --------------------------------- | -------------------------------------------------------------------------------------- |
| Routing          | `src/app`                         | Halaman, layout, `loading`/`error`, Route Handler. Hanya merangkai komponen fitur.     |
| Feature (UI)     | `src/features/<fitur>/components` | Komponen per fitur                                                                     |
| Feature (data)   | `src/features/<fitur>/api`        | Hook TanStack Query/Mutation di atas client hasil generate, plus prefetch untuk server |
| Feature (schema) | `src/features/<fitur>/schemas`    | Skema zod form dan mapping ke DTO API                                                  |
| API client       | `src/lib/api/generated`           | Hasil `pnpm gen:api`, jangan diedit manual                                             |
| BFF              | `src/app/api/backend/[...path]`   | Meneruskan request browser ke backend dengan token                                     |
| Platform         | `src/lib`                         | Auth, config env, logger, query client, error API                                      |
| Shared UI        | `src/components/ui`               | Komponen shadcn/ui                                                                     |

Arah import: `app` -> `features` -> `lib` / `components`. Fitur tidak saling import.

### 2.2 Alur data

```
Browser (Client Component)
   | useQuery / useMutation (hook fitur)
   v
client hasil generate --fetch /api/backend/...-->  BFF (Route Handler, server)
                                                      | + Authorization: Bearer <token dari session>
                                                      | + X-Tenant-ID, X-Request-Id
                                                      v
                                                 codebase-go (REST)

Server Component --(client hasil generate + token, langsung ke backend)--> codebase-go
   | prefetch dengan query key yang sama, dikirim ke browser lewat HydrationBoundary
```

### 2.3 Alur login

```
/login --POST--> /api/auth/signin/zitadel --> Zitadel Login UI --> /api/auth/callback/zitadel
   --> cookie session terenkripsi (berisi access, refresh, id token; hanya bisa dibaca server)
src/proxy.ts (setiap request): baca session, refresh token kalau hampir kedaluwarsa,
   redirect ke /login kalau belum login, pasang header CSP
```

---

## 3. Struktur Folder

```
.
├── docs/CODEBASE_RULES.md
├── e2e/                               # Playwright
├── openapi-ts.config.ts               # config generate client API
├── src/
│   ├── app/
│   │   ├── (app)/[tenant]/            # halaman yang butuh login, tenant di URL
│   │   │   ├── layout.tsx             # header + sidebar
│   │   │   └── users/{new,[id]}/      # contoh fitur users
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/    # endpoint Auth.js (login, callback, session)
│   │   │   ├── auth/logout/           # logout (local + Zitadel)
│   │   │   ├── backend/[...path]/     # BFF ke codebase-go
│   │   │   └── health/                # probe
│   │   ├── login/  forbidden/  page.tsx  layout.tsx  error.tsx  not-found.tsx
│   ├── components/{ui,layout}/
│   ├── features/users/{api,components,schemas}/
│   ├── lib/
│   │   ├── api/                       # generated/, client-config.ts, errors.ts
│   │   ├── auth/                      # index.ts (Auth.js), session.ts (data access layer)
│   │   ├── backend/                   # client backend untuk server
│   │   ├── config/env.ts              # validasi env
│   │   ├── logger/                    # pino + redaction
│   │   └── query/                     # QueryClient + provider
│   ├── stores/ui-store.ts             # TanStack Store
│   ├── test/                          # setup Vitest + MSW
│   ├── instrumentation.ts             # validasi env saat server start
│   └── proxy.ts                       # refresh session, redirect, CSP
├── Dockerfile
└── .github/workflows/ci.yml
```

---

## 4. Prasyarat

| Tool        | Versi | Keterangan                                                                                                         |
| ----------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| Node.js     | 24    | Lihat `.nvmrc` (`nvm use`)                                                                                         |
| pnpm        | 12    | Dikunci lewat field `packageManager`. Aktifkan dengan `corepack enable`, atau pnpm 10+ yang otomatis pindah versi. |
| codebase-go |       | Backend jalan dengan `AUTH_ENABLED=true`                                                                           |
| Zitadel     | v4    | Jalan dari compose `codebase-go` (lihat panduan Zitadel Bagian 3-4)                                                |

Taruh kedua repo bersebelahan, karena `pnpm gen:api` membaca `../codebase-go/gen/openapi/swagger.json`:

```
workspace/
├── codebase-go/
└── codebase-fe/
```

---

## 5. Quick Start: dari Clone sampai Login

**1. Backend + Zitadel** (di `codebase-go`). Target `infra-auth-up` dan `zitadel-bootstrap`, serta auth di backend, ada setelah [panduan Zitadel](https://github.com/z-alamsyah/codebase-go/blob/main/docs/ZITADEL_INTEGRATION.md) Bagian 3-5 diterapkan di `codebase-go`:

```bash
cd codebase-go
make infra-up && make migrate-up && make seed
make infra-auth-up         # Zitadel di http://localhost:8081
make zitadel-bootstrap     # project, role, app codebase-fe, tenant contoh
# .env: AUTH_ENABLED=true, ZITADEL_DOMAIN, ZITADEL_PROJECT_ID (dari output bootstrap)
make run
```

**2. Frontend:**

```bash
cd ../codebase-fe
nvm use                    # Node 24
corepack enable            # pnpm sesuai packageManager
pnpm install
cp .env.example .env.local # isi nilai dari output make zitadel-bootstrap + AUTH_SECRET
pnpm gen:api               # client API dari spec backend
pnpm dev
```

Isi minimal `.env.local`:

```bash
AUTH_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>
ZITADEL_DOMAIN=http://localhost:8081
ZITADEL_CLIENT_ID=<dari bootstrap>
ZITADEL_CLIENT_SECRET=<dari bootstrap>
ZITADEL_PROJECT_ID=<dari bootstrap>
BACKEND_URL=http://localhost:8080
```

**3. Coba:** buka http://localhost:3000, klik **Log in**, masuk dengan `alice@tenant-a.test` / `Password1!`. Pilih tenant, lalu **Create user**. Setelah tersimpan, halaman pindah ke detail user.

Log BFF di terminal (password dan token disensor otomatis):

```
[16:35:57] INFO: BFF POST /api/v1/users => 201 {"method":"POST","path":"/api/v1/users","status":201,"duration_ms":198,"request_id":"...","tenant_id":"..."}
```

---

## 6. Konfigurasi (.env.local)

Semua variabel hanya di server (tidak ada `NEXT_PUBLIC_*`) dan divalidasi di `src/lib/config/env.ts`, saat build (lewat `next.config.ts`) dan saat server start (lewat `src/instrumentation.ts`). Kalau ada yang salah, server berhenti dengan pesan jelas.

| Variable                                      | Default                 | Fungsi                                                                                        |
| --------------------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| `AUTH_URL`                                    | wajib                   | URL publik aplikasi. Dipakai untuk URL callback OIDC, cek Origin, dan cookie `Secure` (https) |
| `AUTH_SECRET`                                 | wajib (min 32 karakter) | Kunci enkripsi cookie session                                                                 |
| `ZITADEL_DOMAIN`                              | wajib                   | URL Zitadel                                                                                   |
| `ZITADEL_CLIENT_ID` / `ZITADEL_CLIENT_SECRET` | wajib                   | App OIDC `codebase-fe` di Zitadel                                                             |
| `ZITADEL_PROJECT_ID`                          | wajib                   | Dipakai di scope audience; backend memeriksa audience ini                                     |
| `BACKEND_URL`                                 | wajib                   | URL codebase-go (dari sisi server Next.js)                                                    |
| `LOG_LEVEL`                                   | `info`                  | `debug`, `info`, `warn`, `error`                                                              |
| `LOG_FORMAT`                                  | `pretty`                | `pretty` (lokal) atau `json` (server, log collector)                                          |
| `LOG_REDACT_KEYS`                             | `password,token,...`    | Key yang disensor di log, sampai object bertingkat                                            |
| `SKIP_ENV_VALIDATION`                         | kosong                  | `1` hanya untuk build tanpa secret (CI, tahap build Docker)                                   |

Karena tidak ada `NEXT_PUBLIC_*`, satu image Docker bisa dipakai di semua environment; nilainya dibaca saat runtime.

---

## 7. Auth, Tenant, dan BFF

- **Token tidak pernah sampai ke browser.** Cookie session (`authjs.session-token.*`) terenkripsi dan `httpOnly`. `GET /api/auth/session` hanya berisi nama, email, dan `tenants` (`{ "<org id>": ["admin"] }`).
- **Refresh token** hanya terjadi di `src/proxy.ts`, satu-satunya tempat yang bisa menulis cookie ke browser sekaligus ke request yang sama. Zitadel mematikan refresh token lama begitu dipakai, jadi request yang datang bersamaan berbagi satu hasil refresh (cache 30 detik di `src/lib/auth/index.ts`). Kalau aplikasi dijalankan lebih dari satu instance, pakai sticky session.
- **Data Access Layer** `src/lib/auth/session.ts`: `getOptionalUser()`, `getCurrentUser()` (redirect ke `/login`), `requireTenant(tenant)` (redirect ke `/forbidden`), `getServerAccessToken()`. Setiap halaman yang dilindungi memanggil salah satunya; `proxy.ts` hanya redirect awal.
- **Tenant aktif** = segment pertama URL. BFF menolak tenant yang bukan milik user (403), lalu backend memeriksa role lagi.
- **Role di UI** (`user.tenants[tenant]`) hanya untuk menampilkan atau menyembunyikan menu. Izin sebenarnya diputuskan backend.
- **Logout** memakai `fetch('/api/auth/logout')` lalu `window.location` ke Zitadel. Form POST yang redirect ke Zitadel lalu kembali diblok aturan CSP `form-action` di Chrome.

---

## 8. Memakai Endpoint Backend Baru

Contoh: backend menambah `PATCH /api/v1/users/{id}` dengan `@ID updateUserName` (lihat README codebase-go Bagian 9).

**Langkah 1 - Ambil spec terbaru** (setelah `make swagger` di backend):

```bash
pnpm gen:api
# atau dari backend yang sedang jalan:
OPENAPI_INPUT=http://localhost:8080/swagger/doc.json pnpm gen:api
```

Hasilnya di `src/lib/api/generated`: fungsi `updateUserName`, tipe `UpdateUserNameData`, dan `updateUserNameMutation`. Commit folder ini.

**Langkah 2 - Hook di fitur** (`src/features/users/api/queries.ts`):

```ts
import { updateUserNameMutation } from "@/lib/api/generated/@tanstack/react-query.gen";

export function useUpdateUserName(tenant: string) {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateUserNameMutation({ headers: tenantHeaders(tenant) }),
    onSuccess: (res) => {
      if (res.data) queryClient.setQueryData(userQueryOptions(tenant, res.data.id).queryKey, res);
    },
  });
}
```

**Langkah 3 - Pakai di komponen:** `const update = useUpdateUserName(tenant); await update.mutateAsync({ path: { id }, body: { name } })`. Tangani error dengan `ApiError.from(error)` (field error di `fieldErrors`, pesan aman di `userMessage()`).

**Langkah 4 - Test:** tambah handler MSW (`server.use(http.patch(...))`) di test hook atau komponen.

Path baru otomatis lewat BFF selama diawali `api/v1/` (lihat `ALLOWED_PREFIXES` di BFF).

---

## 9. Membuat Halaman / Fitur Baru

Contoh: fitur `orders`.

1. **Fitur:** buat `src/features/orders/{api,components,schemas}`. Hook query/mutation di `api/`, komponen client di `components/`, skema zod di `schemas/`.
2. **Halaman:** `src/app/(app)/[tenant]/orders/page.tsx`. Panggil `requireTenant(tenant)` di awal. Kalau perlu data awal, prefetch di server (contoh `src/features/users/api/prefetch.ts`) lalu bungkus dengan `HydrationBoundary`.
3. **Loading dan error:** tambah `loading.tsx` di segment baru. Dengan Cache Components, data yang bergantung pada request (session, `params`) harus dibaca di dalam `<Suspense>` atau segment dengan `loading.tsx`. Kalau `pnpm dev` menampilkan peringatan `blocking-prerender-dynamic`, tambahkan boundary tersebut.
4. **Navigasi:** tambah link di `src/components/layout/sidebar.tsx`.
5. **Test:** unit test untuk hook, skema, dan komponen; tambah langkah E2E untuk alur utama.

---

## 10. State Management

| Jenis state         | Alat                      | Di template ini                    |
| ------------------- | ------------------------- | ---------------------------------- |
| Data dari server    | TanStack Query            | `useUser`, `useCreateUser`         |
| State di URL        | `params` / `searchParams` | tenant aktif, id user              |
| State lokal         | `useState`                | pesan error form                   |
| Form                | TanStack Form + zod       | `CreateUserForm`                   |
| State global client | TanStack Store            | `src/stores/ui-store.ts` (sidebar) |

Data server tidak pernah disalin ke store. Query key memuat tenant, jadi cache antar tenant tidak tercampur. Retry otomatis hanya untuk error jaringan dan 5xx.

---

## 11. Testing

```bash
pnpm test          # unit test (Vitest + Testing Library + MSW), tanpa backend
pnpm test:e2e      # E2E (Playwright), butuh backend + Zitadel + user contoh
```

| Yang dites                                                                                               | Lokasi                                                    |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Redaction log                                                                                            | `src/lib/logger/redact.test.ts`                           |
| Mapping error backend                                                                                    | `src/lib/api/errors.test.ts`                              |
| Tenant dari token                                                                                        | `src/lib/auth/tenants.test.ts`                            |
| Skema form                                                                                               | `src/features/users/schemas/create-user.test.ts`          |
| Hook query (header tenant, error, cache key)                                                             | `src/features/users/api/queries.test.tsx`                 |
| Form (validasi client, error per field backend, conflict, sukses)                                        | `src/features/users/components/create-user-form.test.tsx` |
| E2E: login Zitadel, create, detail, conflict, 403, logout, tanpa token di browser, tanpa pelanggaran CSP | `e2e/auth-and-users.spec.ts`                              |

E2E sekali jalan:

```bash
pnpm exec playwright install chromium   # sekali saja
pnpm test:e2e                           # memakai server yang sudah jalan di :3000, atau menjalankan `pnpm dev`
E2E_USERNAME=... E2E_PASSWORD=... pnpm test:e2e
```

Jalankan E2E juga terhadap build standalone (lihat Bagian 12), karena masalah seperti URL internal dan CSP hanya muncul di sana.

---

## 12. Docker dan CI

```bash
docker build -t codebase-fe .
docker run --rm -p 3000:3000 --env-file .env.local codebase-fe
```

- Image memakai output `standalone`, jalan sebagai user non-root, dan punya `HEALTHCHECK` ke `/api/health`.
- Build di dalam Docker memakai `SKIP_ENV_VALIDATION=1`; env divalidasi saat container start.
- Di dalam container, `localhost` adalah container itu sendiri: isi `ZITADEL_DOMAIN` dan `BACKEND_URL` dengan alamat yang bisa dijangkau dari container.

CI (`.github/workflows/ci.yml`):

- `check`: lint, format, typecheck, unit test, build.
- `api-contract`: checkout `codebase-go`, jalankan `pnpm gen:api`, gagal kalau `src/lib/api/generated` berbeda dari yang di-commit. Dilewati kalau backend belum punya `gen/openapi/swagger.json`.

---

## 13. Perintah

| Perintah                            | Fungsi                                  |
| ----------------------------------- | --------------------------------------- |
| `pnpm dev`                          | Server development                      |
| `pnpm build` / `pnpm start`         | Build production / jalankan             |
| `pnpm lint`                         | ESLint (termasuk aturan TanStack Query) |
| `pnpm format` / `pnpm format:check` | Prettier                                |
| `pnpm typecheck`                    | `next typegen` + `tsc --noEmit`         |
| `pnpm test` / `pnpm test:watch`     | Unit test                               |
| `pnpm test:e2e`                     | E2E Playwright                          |
| `pnpm gen:api`                      | Generate client API dari spec backend   |

---

## 14. Troubleshooting

| Gejala                                                        | Penyebab                                 | Solusi                                                                                |
| ------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Server berhenti saat start: `Invalid environment variables`   | Env kurang atau salah                    | Lengkapi `.env.local` sesuai Bagian 6                                                 |
| `pnpm gen:api` gagal menemukan `swagger.json`                 | Repo backend tidak bersebelahan          | Taruh `codebase-go` di sebelah repo ini, atau pakai `OPENAPI_INPUT=<url>`             |
| Zitadel menolak login, redirect URI `http://0.0.0.0:3000/...` | `AUTH_URL` kosong atau salah             | Isi `AUTH_URL` dengan URL publik aplikasi                                             |
| Login ditolak `GrantRequired`                                 | User belum punya role di project         | Beri role di Zitadel (lihat panduan Zitadel)                                          |
| Setelah login muncul "You are not a member of any tenant"     | Token tidak berisi role                  | Pastikan app Zitadel memakai role assertion (script bootstrap sudah mengaturnya)      |
| BFF 401 `login required`                                      | Session habis atau refresh gagal         | Login ulang. Kalau sering terjadi dengan beberapa instance, pakai sticky session      |
| BFF 403 `not a member of this tenant`                         | Tenant di URL bukan milik user           | Pilih tenant dari halaman utama                                                       |
| Peringatan `blocking-prerender-dynamic` di `pnpm dev`         | Data request dibaca di luar `<Suspense>` | Tambah `loading.tsx` di segment, atau pindahkan pembacaan ke dalam `<Suspense>`       |
| Typecheck: `Cannot find name 'PageProps'`                     | Tipe route belum di-generate             | Jalankan `pnpm typecheck` (sudah termasuk `next typegen`)                             |
| `pnpm install` gagal: `Ignored build scripts`                 | pnpm 12 meminta persetujuan build script | `pnpm approve-builds <paket>` atau tambahkan di `allowBuilds` (`pnpm-workspace.yaml`) |
