# Codebase Rules - Frontend (Next.js + TanStack + Zustand)

Aturan baku untuk setup dan mengembangkan codebase frontend. Stack utamanya **Next.js (App Router)**, **TanStack** (Query untuk data dari server, Form, Table), dan **Zustand** untuk state global di sisi client. Dokumen ini pasangan dari `docs/CODEBASE_RULES.md` di repo backend (`codebase-go`), jadi istilah dan prinsipnya dibuat sejalan.

## 0. Cara Pakai Dokumen Ini

- **WAJIB**: harus ada. Kalau tidak dipenuhi, codebase dianggap belum selesai.
- **DISARANKAN**: sebaiknya ada. Boleh dilewati kalau alasannya ditulis di README.
- **OPSIONAL**: dipakai kalau dibutuhkan.

**Observability (tracing, metrics) sengaja tidak dipasang di frontend** supaya tidak berlebihan. Tracing dan metrics cukup di backend. Frontend hanya menulis log terstruktur di sisi server (Bagian 6) dan meneruskan `X-Request-Id`, sehingga satu request tetap bisa dilacak di log backend.

Versi di Lampiran A adalah versi stabil terbaru saat dokumen ini ditulis (Oktober 2026). Saat setup, selalu cek ulang versi terbaru dan catat di README.

---

## 1. Prinsip Umum

1. **WAJIB** - Manfaatkan framework. Pakai fitur bawaan Next.js (routing, layout, `loading.tsx`, `error.tsx`, Route Handler, `next/image`, `next/font`, `proxy.ts`) dan library TanStack, jangan tulis ulang dari nol.
2. **WAJIB** - TypeScript mode `strict`. Dilarang `any` kecuali ada komentar alasannya.
3. **WAJIB** - Kontrak API diambil dari spec OpenAPI/Swagger backend dan di-generate jadi client TypeScript. Dilarang menulis tipe response backend secara manual.
4. **WAJIB** - Semua perilaku yang beda antar environment diatur lewat environment variable yang divalidasi saat start.
5. **WAJIB** - Clone sampai running mulus: satu perintah install, satu perintah generate, satu perintah dev, semua tertulis di README.
6. **WAJIB** - Versi Node.js dan package manager dikunci (`.nvmrc` / `engines`, dan field `packageManager` di `package.json`).
7. **DISARANKAN** - Server Component sebagai default. `'use client'` hanya di komponen yang butuh interaksi, sedalam mungkin di pohon komponen.

---

## 2. Arsitektur Layer

### 2.1 Daftar Layer

| Layer                          | Folder                            | Tanggung jawab                                                                                 | Tidak boleh                                       |
| ------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Routing**                    | `src/app`                         | Halaman, layout, `loading`/`error`/`not-found`, Route Handler. Hanya merangkai komponen fitur. | Berisi logic bisnis atau panggil `fetch` langsung |
| **Feature (UI)**               | `src/features/<fitur>/components` | Komponen per fitur (form, tabel, detail)                                                       | Panggil API langsung tanpa hook                   |
| **Feature (data)**             | `src/features/<fitur>/api`        | Hook TanStack Query/Mutation per fitur, dibangun di atas client hasil generate                 | Menyimpan data server ke store global             |
| **Feature (schema)**           | `src/features/<fitur>/schemas`    | Skema validasi form (zod) dan mapping ke DTO API                                               | Duplikasi tipe response yang sudah di-generate    |
| **API client**                 | `src/lib/api/generated`           | Client, tipe, dan `queryOptions` hasil generate dari spec backend                              | Diedit manual                                     |
| **BFF (backend-for-frontend)** | `src/app/api/backend/[...path]`   | Meneruskan request browser ke backend sambil menambahkan access token dan tenant               | Berisi logic bisnis                               |
| **Shared UI**                  | `src/components/ui`               | Komponen desain bersama (button, input, dialog)                                                | Tahu soal fitur tertentu                          |
| **Platform**                   | `src/lib`                         | Auth, config env, logger, query client                                                         | Tahu soal fitur tertentu                          |

### 2.2 Aturan Dependency

1. **WAJIB** - Arah import satu arah: `app` -> `features` -> `lib` / `components/ui`. Fitur tidak boleh import dari fitur lain. Kalau butuh, pindahkan bagian yang dipakai bersama ke `lib` atau `components/ui`.
2. **WAJIB** - Komponen tidak memanggil `fetch` atau client API langsung. Semua lewat hook di `features/<fitur>/api`.
3. **WAJIB** - Logic bisnis tetap di backend. Frontend hanya memvalidasi input untuk pengalaman pengguna (UX); backend tetap memvalidasi ulang.
4. **WAJIB** - Error dari backend dipetakan di satu tempat (lihat Bagian 8).

### 2.3 Gambaran Alur

```
Browser (Client Component)
   | useQuery / useMutation (hook fitur)
   v
generated client  --(fetch /api/backend/...)-->  BFF Route Handler (server Next.js)
                                                    | + Authorization: Bearer <access token dari session>
                                                    | + X-Tenant-ID, X-Request-Id
                                                    v
                                               Backend Go (REST)

Server Component  --(panggil generated client langsung di server, + token)--> Backend Go
   | prefetch, lalu kirim hasilnya ke client lewat HydrationBoundary
```

### 2.4 Struktur Folder

```
src/
├── app/
│   ├── (public)/                   # halaman tanpa login
│   ├── (app)/[tenant]/             # halaman yang butuh login, tenant aktif di URL
│   ├── api/
│   │   ├── auth/[...nextauth]/     # endpoint auth (login, callback, logout)
│   │   ├── backend/[...path]/      # BFF ke backend
│   │   └── health/                 # healthcheck
│   ├── layout.tsx, providers.tsx, error.tsx, not-found.tsx
├── features/<fitur>/{components,api,schemas,utils}/
├── components/ui/
├── lib/{api,auth,backend,config,logger,query}/
├── stores/                         # Zustand (state global sisi client, minimal)
└── proxy.ts                        # redirect awal (bukan pengaman utama)
```

---

## 3. State Management

| Jenis state              | Alat                                | Contoh                               |
| ------------------------ | ----------------------------------- | ------------------------------------ |
| Data dari server         | **TanStack Query**                  | Detail user, daftar order            |
| State di URL             | `searchParams` (boleh pakai `nuqs`) | Filter, halaman, sort, tab aktif     |
| State lokal komponen     | `useState` / `useReducer`           | Dialog terbuka, input sementara      |
| State form               | **TanStack Form** + zod             | Form create/edit                     |
| State global sisi client | **Zustand**                         | Tema, sidebar, wizard lintas halaman |

1. **WAJIB** - Data dari server hanya disimpan di cache TanStack Query. Dilarang menyalinnya ke store global atau `useState`.
2. **WAJIB** - Filter, pagination, dan pencarian disimpan di URL supaya bisa di-share dan tombol back browser bekerja.
3. **WAJIB** - Query key dan `queryOptions` diambil dari hasil generate client. Setelah mutation sukses, invalidate query yang terkait.
4. **WAJIB** - `QueryClient` dibuat baru per request di server, dan satu instance di browser. Default `staleTime` di atas 0 (contoh 60 detik) supaya data hasil prefetch server tidak langsung di-fetch ulang.
5. **WAJIB** - Jangan retry otomatis untuk error 4xx. Retry hanya untuk error jaringan atau 5xx.
6. **WAJIB** - Zustand dipakai seminimal mungkin, hanya untuk state UI yang dipakai lintas komponen atau halaman.
7. **DISARANKAN** - Data penting untuk halaman pertama di-prefetch di Server Component lalu dikirim lewat `HydrationBoundary`, supaya tidak ada loading kosong. Query key hasil prefetch harus sama persis dengan yang dipakai browser.
8. **WAJIB** - Next.js 16 mengaktifkan Cache Components secara default. Data yang bergantung pada request (cookie/session, `headers()`, `params` dinamis) dibaca di dalam `<Suspense>` atau di route segment yang punya `loading.tsx`. Jangan `await` data seperti itu di level atas layout. Peringatan `blocking-prerender-dynamic` di `pnpm dev` harus diperbaiki, bukan diabaikan.
9. **WAJIB** - Store Zustand **tidak boleh** jadi variabel global level modul. Server Next.js merender banyak request sekaligus, jadi store global bisa membagi state antar user. Buat store dengan `createStore` (`zustand/vanilla`) di dalam Provider (sekali per request/page load), lalu baca lewat hook dengan selector (contoh `useUiStore((s) => s.sidebarOpen)`). Server Component tidak membaca atau menulis store.

---

## 4. Kontrak API dan Data Fetching

1. **WAJIB** - Client API di-generate dari spec backend (`swagger.json`) memakai Hey API (`@hey-api/openapi-ts`), dengan plugin client Next.js dan plugin TanStack Query. Hasilnya di-commit ke `src/lib/api/generated`.
2. **WAJIB** - Ada perintah `gen:api` (sumber spec: URL backend lokal atau file). CI gagal kalau hasil generate berbeda dari yang di-commit.
3. **WAJIB** - Browser tidak pernah memanggil backend langsung. Semua request dari browser lewat BFF `/api/backend/*`, yang:
   - Mengambil access token dari session di server, lalu menambahkan header `Authorization`.
   - Meneruskan `X-Tenant-ID` (tenant aktif) dan `X-Request-Id`.
   - Hanya meneruskan path yang diizinkan (allowlist prefix, contoh `/api/v1/`).
4. **WAJIB** - Server Component memanggil backend langsung dari server (tanpa lewat BFF), dengan token dari session.
5. **WAJIB** - Format response backend (`{ data, meta }` / `{ error, meta }`) diurai di satu tempat. Hook fitur menerima `data` yang sudah bertipe, dan error yang sudah dipetakan (Bagian 8).
6. **DISARANKAN** - Mutation memakai TanStack Query (`useMutation`) lewat BFF. Server Actions boleh dipakai untuk kasus khusus, tapi jangan campur dua cara untuk fitur yang sama.

---

## 5. Autentikasi dan Otorisasi

Detail langkah integrasi ada di `codebase-go/docs/ZITADEL_INTEGRATION.md`.

1. **WAJIB** - Login memakai OIDC Authorization Code + PKCE ke identity provider (Zitadel). Library mengikuti contoh resmi Zitadel untuk Next.js.
2. **WAJIB** - Access token, refresh token, dan ID token hanya disimpan di server (session cookie yang terenkripsi, `httpOnly`, `secure`, `sameSite=lax`). Dilarang menyimpan token di `localStorage`, `sessionStorage`, atau state JavaScript di browser. Object session yang bisa dibaca browser (contoh `GET /api/auth/session`) juga **tidak boleh** berisi token; token dibaca di server (contoh `getToken()`).
3. **WAJIB** - Refresh token dilakukan otomatis di server sebelum access token kedaluwarsa, **hanya di satu tempat yang bisa menyimpan cookie** (`proxy.ts`). Zitadel merotasi refresh token (token lama langsung tidak berlaku), jadi request yang datang bersamaan harus memakai satu hasil refresh yang sama. Kalau refresh gagal, user diarahkan login ulang.
4. **WAJIB** - Pengecekan session dilakukan di setiap tempat yang mengakses data: page/layout yang dilindungi, Route Handler, dan Server Action. `proxy.ts` hanya untuk redirect awal, **tidak boleh** jadi satu-satunya pengaman.
5. **WAJIB** - Role di frontend hanya untuk tampilan (menyembunyikan tombol atau menu). Keputusan izin yang sebenarnya selalu di backend.
6. **WAJIB** - Multi-tenant: tenant aktif ada di URL (`/[tenant]/...`), divalidasi terhadap daftar tenant user dari session, lalu dikirim ke backend sebagai `X-Tenant-ID` oleh BFF.
7. **WAJIB** - Logout menghapus session lokal dan session di identity provider (end session endpoint).
8. **WAJIB** - URL callback OIDC dan pengecekan `Origin` (CSRF) memakai URL publik aplikasi dari env (contoh `AUTH_URL`), bukan URL request. Di server standalone atau di belakang reverse proxy, URL request adalah URL internal (contoh `http://0.0.0.0:3000`).
9. **WAJIB** - Session dibaca lewat satu Data Access Layer (contoh `src/lib/auth/session.ts`) yang mengembalikan data sempit (nama, email, tenant + role), bukan object session mentah.

---

## 6. Logging

1. **WAJIB** - Log di server Next.js (Route Handler, BFF, Server Component) memakai logger terstruktur, contoh `pino`. Format `pretty` untuk lokal dan `json` untuk server, diatur lewat `LOG_FORMAT`. Level diatur lewat `LOG_LEVEL`.
2. **WAJIB** - BFF menulis satu baris log per request: method, path, status, durasi, request id, dan tenant.
3. **WAJIB** - Redaction: key sensitif (`password`, `token`, `access_token`, `refresh_token`, `authorization`, `cookie`, `secret`, `otp`, `pin`) disensor sampai ke object bertingkat. Daftar key bisa ditambah lewat env, sama seperti backend.
4. **WAJIB** - Request ID dibuat (atau diteruskan dari header) di BFF dan dikirim ke backend sebagai `X-Request-Id`, supaya log frontend dan backend bisa disambungkan.
5. **WAJIB** - Di browser, jangan `console.log` data user. Error tak terduga dilaporkan ke server lewat endpoint log atau tool error tracking.

---

## 7. Konfigurasi

1. **WAJIB** - Semua env divalidasi saat build dan start (contoh `@t3-oss/env-nextjs` + zod, dipanggil dari `next.config.ts` dan `instrumentation.ts`). Kalau tidak valid, aplikasi gagal start dengan pesan jelas. Build di CI/Docker tanpa secret boleh melewati validasi (`SKIP_ENV_VALIDATION=1`); kode yang jalan saat modul di-load tidak boleh bergantung pada nilai default env.
2. **WAJIB** - Variabel rahasia (secret session, client secret, URL backend internal) **tidak boleh** diawali `NEXT_PUBLIC_`.
3. **WAJIB** - Nilai `NEXT_PUBLIC_*` ditanam saat build. Supaya satu image bisa dipakai di banyak environment, nilai yang beda per environment dibaca di server saat runtime, bukan lewat `NEXT_PUBLIC_*`.
4. **WAJIB** - `.env.example` berisi semua variabel lengkap dengan komentar. `.env*` (kecuali `.env.example`) masuk `.gitignore`.
5. **DISARANKAN** - Fitur opsional punya flag env (feature flag) bila perlu.

---

## 8. Error Handling dan UX State

1. **WAJIB** - Mapping error backend ke UI di satu tempat:

| Kode backend (`error.code`) | HTTP | Perilaku UI                                                            |
| --------------------------- | ---- | ---------------------------------------------------------------------- |
| `INVALID_INPUT`             | 400  | Tampilkan `error.details` sebagai error per field di form              |
| `UNAUTHORIZED`              | 401  | Coba refresh session, kalau gagal arahkan ke login                     |
| `FORBIDDEN`                 | 403  | Halaman atau pesan "tidak punya akses"                                 |
| `NOT_FOUND`                 | 404  | `notFound()` / halaman not found                                       |
| `CONFLICT`                  | 409  | Pesan di field atau toast, contoh "email sudah terdaftar"              |
| `INTERNAL` / jaringan       | 5xx  | Toast umum + tombol coba lagi, tampilkan `request_id` untuk dilaporkan |

2. **WAJIB** - Setiap segment route punya `loading.tsx` dan `error.tsx` yang sesuai. Ada `not-found.tsx` dan `global-error.tsx` di root.
3. **WAJIB** - Setiap komponen yang menampilkan data menangani 4 keadaan: loading, error, kosong, dan ada data.
4. **WAJIB** - Pesan error untuk user tidak menampilkan detail teknis. Detail teknis hanya di log.

---

## 9. Form dan Validasi

1. **WAJIB** - Form memakai TanStack Form dengan validasi skema zod (lewat Standard Schema).
2. **WAJIB** - Aturan validasi di frontend mengikuti batasan di spec backend (`required`, `minLength`, `maxLength`, format). Validasi backend tetap yang menentukan.
3. **WAJIB** - Error validasi dari backend (`error.details`) ditampilkan di field yang sesuai.
4. **WAJIB** - Tombol submit dinonaktifkan saat request berjalan, untuk mencegah submit ganda.

---

## 10. UI, Aksesibilitas, dan Performa

1. **DISARANKAN** - Styling memakai Tailwind CSS, komponen dasar dari shadcn/ui (kode komponen disalin ke `src/components/ui`, jadi bisa diubah bebas).
2. **WAJIB** - Elemen interaktif bisa dipakai lewat keyboard, punya label yang jelas, dan kontras warna memenuhi WCAG AA.
3. **WAJIB** - Gambar memakai `next/image`, font memakai `next/font`.
4. **WAJIB** - Tabel data besar memakai TanStack Table dengan pagination dari server, bukan memuat semua data ke browser.
5. **DISARANKAN** - Cek ukuran bundle (bundle analyzer) dan skor Lighthouse sebelum rilis besar.

---

## 11. Keamanan

1. **WAJIB** - Header keamanan diset di `next.config.ts`: `Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`, dan `frame-ancestors`/`X-Frame-Options`.
2. **WAJIB** - Route Handler dan BFF yang mengubah data hanya menerima request dari origin sendiri (cek header `Origin`), sebagai tambahan cookie `sameSite`.
3. **WAJIB** - Input dari URL dan form divalidasi di server sebelum diteruskan.
4. **WAJIB** - Jangan render HTML mentah dari input user (`dangerouslySetInnerHTML`) tanpa sanitasi.
5. **WAJIB** - Audit dependency berkala (`pnpm audit` atau Dependabot/Renovate).

---

## 12. Testing

1. **WAJIB** - Unit test untuk hook fitur, util, skema validasi, mapping error, dan komponen client yang punya logic (Vitest + Testing Library).
2. **WAJIB** - Request ke backend di unit test di-mock memakai MSW, dengan tipe dari client hasil generate.
3. **WAJIB** - Test E2E (Playwright) untuk alur utama: login, satu alur create, satu alur baca data, dan akses ditolak (403).
4. **WAJIB** - Async Server Component diuji lewat E2E, bukan unit test.
5. **DISARANKAN** - Coverage untuk `features/*/api`, `features/*/schemas`, dan `lib` minimal 80%.

---

## 13. Environment Lokal

1. **WAJIB** - Frontend berjalan di host (`pnpm dev`) dan terhubung ke backend serta Zitadel yang jalan dari docker compose milik repo backend.
2. **WAJIB** - Ada endpoint `GET /api/health` untuk probe.
3. **WAJIB** - Dockerfile multi-stage dengan `output: 'standalone'`, berjalan sebagai user non-root. Test E2E juga dijalankan terhadap build standalone, karena beberapa masalah (URL internal, CSP) hanya muncul di sana.
4. **DISARANKAN** - Mode mock (MSW di browser) untuk mengembangkan UI tanpa backend.

---

## 14. Contoh Fitur Wajib (Users)

Pasangan dari contoh fitur di backend, supaya setiap layer punya contoh nyata:

1. **WAJIB** - Halaman detail user `/[tenant]/users/[id]`: prefetch di Server Component, `useQuery` di client, plus state loading/error/not found.
2. **WAJIB** - Form buat user `/[tenant]/users/new`: TanStack Form + zod, `useMutation` lewat BFF, error per field dari backend, lalu redirect ke halaman detail.
3. **WAJIB** - Halaman login/logout dan halaman 403.
4. **WAJIB** - Unit test hook dan skema, plus E2E alur create user.

---

## 15. Developer Tooling

1. **WAJIB** - Package manager pnpm. Script minimal di `package.json`: `dev`, `build`, `start`, `lint`, `format`, `typecheck`, `test`, `test:e2e`, `gen:api`.
2. **WAJIB** - Lint memakai ESLint CLI dengan `eslint-config-next` dan `@tanstack/eslint-plugin-query` (Next.js 16 sudah tidak punya perintah `next lint`). Format memakai Prettier. Biome boleh jadi pengganti kalau dicatat di README.
3. **WAJIB** - `pnpm typecheck` (`next typegen && tsc --noEmit`, supaya tipe `PageProps`/`LayoutProps`/`RouteContext` tersedia) dijalankan di CI.
4. **DISARANKAN** - Pre-commit hook (lefthook atau husky) untuk lint dan format file yang berubah.
5. **DISARANKAN** - Pipeline CI: install, `gen:api` lalu cek tidak ada perubahan, lint, typecheck, unit test, build, E2E.

---

## 16. README

**WAJIB** berisi:

1. Ringkasan aplikasi dan stack (salin dari Lampiran A).
2. Arsitektur layer dan alur data (Bagian 2).
3. Prasyarat (Node, pnpm, backend + Zitadel lokal).
4. **Quick start**: dari clone sampai bisa login dan membuka halaman contoh.
5. Tabel semua env.
6. **Langkah memakai endpoint backend baru**: update spec di backend, `pnpm gen:api`, buat hook fitur, pakai di komponen.
7. **Langkah membuat halaman/fitur baru**: route, komponen, hook, loading/error, test.
8. Auth dan tenant: cara kerja login, BFF, dan pemilihan tenant.
9. Testing (unit, E2E) dan troubleshooting.

---

## 17. Definition of Done

- [ ] `pnpm install && pnpm gen:api && pnpm dev` jalan dari clone bersih.
- [ ] Lint, typecheck, dan unit test lulus.
- [ ] Login lewat Zitadel berhasil, token tidak terlihat di browser (cek DevTools: tidak ada di storage atau response JS).
- [ ] Contoh fitur users jalan: detail (dengan prefetch) dan create (dengan error per field).
- [ ] Request ke backend membawa `Authorization`, `X-Tenant-ID`, dan `X-Request-Id`; 401/403 ditangani sesuai Bagian 8.
- [ ] Image Docker `standalone` jalan sebagai non-root dan `/api/health` sehat.
- [ ] README lengkap sesuai Bagian 16.

---

## Lampiran A - Tabel Stack

Versi stabil saat dokumen ditulis (Oktober 2026). Cek ulang saat setup.

| Kebutuhan           | Pilihan                                         | Versi            | Catatan                                                                                   |
| ------------------- | ----------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------- |
| Runtime             | Node.js                                         | 24 (LTS)         | Next.js 16 butuh minimal 20.9                                                             |
| Framework           | Next.js (App Router)                            | 16.4             | `proxy.ts` (dulu `middleware`), Cache Components aktif secara default                     |
| UI library          | React                                           | 19.3             |                                                                                           |
| Data dari server    | @tanstack/react-query                           | 5.104            | + `@tanstack/react-query-devtools`                                                        |
| Form                | @tanstack/react-form                            | 1.33             | + zod                                                                                     |
| Tabel               | @tanstack/react-table                           | 9.2              |                                                                                           |
| State global client | zustand                                         | 5.0              | Store per request lewat Provider, bukan global                                            |
| Validasi            | zod                                             | 4.6              |                                                                                           |
| Generate client API | @hey-api/openapi-ts                             | 0.99             | Masih 0.x; mendukung Swagger 2.0 dari swag. Pin versi persis.                             |
| Auth                | @zitadel/next-auth + @auth/core + openid-client | 1.1 / 0.41 / 6.8 | Berbasis contoh resmi Zitadel untuk Next.js, dengan perbaikan di `ZITADEL_INTEGRATION.md` |
| Env                 | @t3-oss/env-nextjs                              | 0.13             |                                                                                           |
| Logger server       | pino                                            | 10.4             |                                                                                           |
| Styling             | Tailwind CSS + shadcn/ui                        | 4.3 / CLI 4.21   | Disarankan. shadcn preset default `base-nova` (Base UI)                                   |
| Unit test           | Vitest + Testing Library + MSW                  | 5.0 / 16.3 / 3.0 |                                                                                           |
| E2E                 | Playwright                                      | 1.64             |                                                                                           |
| Lint / format       | ESLint + eslint-config-next + Prettier          | 9 / 16.4 / 3     | ESLint 9 sesuai scaffold `create-next-app` 16.4. Atau Biome 2.5                           |
| Package manager     | pnpm                                            | 12               | Dikunci lewat `packageManager`. Build script dependency disetujui di `allowBuilds`        |
| Bahasa              | TypeScript                                      | 5.9              | Mengikuti scaffold `create-next-app` 16.4                                                 |
