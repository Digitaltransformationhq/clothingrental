# Almirah

**The wardrobe, shared.** A peer-to-peer fashion rental marketplace: people list clothes they
already own, other people rent them for the occasions that need something, and the platform holds
the money and the trust in between.

An _almirah_ is the cupboard an Indian household keeps its good clothes in. Most of what is in one
is worn once or twice a year. This is a marketplace for the rest of the time.

---

## Contents

- [Running it](#running-it)
- [What is here](#what-is-here)
- [Architecture](#architecture)
- [The database](#the-database)
- [The domain layer](#the-domain-layer)
- [Photography](#photography)
- [Environment](#environment)
- [Testing](#testing)
- [Deployment](#deployment)
- [Decisions worth knowing about](#decisions-worth-knowing-about)

---

## Running it

```bash
npm install
cp .env.example .env      # then set BETTER_AUTH_SECRET
npm run db:seed           # creates and fills the bundled database
npm run dev
```

Open <http://localhost:3000>.

**No database server is required.** With `DATABASE_URL` unset, the application runs against
PostgreSQL compiled to WebAssembly (PGlite), stored in `.pglite/`. It is not a mock or a fixture
layer — it is PostgreSQL, running the same migrations, the same SQL and the same constraints as
production.

### Signing in

Every seeded account uses the password `almirah-demo-2026`.

| Who                         | Email                     | What they show you                       |
| --------------------------- | ------------------------- | ---------------------------------------- |
| Owner with a busy wardrobe  | `ananya@almirah.example`  | Pending requests, live rentals, earnings |
| Renter with active rentals  | `ishaan@almirah.example`  | Upcoming rentals, saved pieces, messages |
| Wardrobe of inherited saris | `meher@almirah.example`   | A wardrobe built on handloom             |
| Administrator               | `nandini@almirah.example` | Moderation queue, members, payouts       |

### One process at a time

The bundled database permits a single writer. Stop the dev server before running `npm run db:seed`,
`npm run db:reset`, or the database-backed tests — the application will tell you which process is
holding it rather than corrupting the files. This restriction does not exist when `DATABASE_URL`
points at a real server.

---

## What is here

**For renters** — browse and filter a catalogue, search, choose rental dates against live
availability, see the whole price before paying, check out, track a rental through its lifecycle,
message the owner, review afterwards.

**For owners** — an eight-step listing wizard with live preview and image upload, a requests queue,
per-garment availability calendar, earnings split into settled, pending and available, and payouts.

**For the marketplace** — moderation of every listing before publication, member suspension,
rentals and payouts oversight, reports and disputes, and an append-only audit log of every
privileged action.

---

## Architecture

```
   UI  (server components by default; client only where interaction demands it)
    │
    ▼
   Server actions / route handlers      ← validate input, identify the caller
    │
    ▼
   Domain services                      ← booking, payments, listings, messaging
    │
    ▼
   Pure domain                          ← money, dates, availability, pricing, state machine
    │
    ▼
   Prisma → PostgreSQL                  ← constraints and triggers as the last line
```

```
src/
  domain/          Pure business logic. No I/O, no framework, fully tested.
    money.ts       Integer minor units; never floating point.
    dates.ts       Calendar dates; timezone-safe; half-open ranges.
    rental/        Availability, pricing, and the booking state machine.
    catalog/       Shop filter contract, shared by the URL and the query.
    listing/       The listing draft schema the wizard and the server both use.
  server/
    db/            Prisma client, dual runtime, migrations, single-writer lock.
    auth/          Sessions and authorisation helpers.
    services/      Booking, payments, listings, messaging, admin, account.
    actions/       Server actions — the only write surface the browser can reach.
    payments/      The payment port and its Razorpay, Stripe and sandbox drivers.
    storage/       Object storage port; local and S3-compatible drivers.
    email/         Transactional email port; console and Resend drivers.
    seed/          The catalogue: people, garments, taxonomy.
  components/      Organised by domain — listing/, rental/, shop/, checkout/, …
  app/             Routes.
```

The rule the layering exists to enforce: **business logic never lives in a component, and I/O never
lives in the domain.** `quoteRental` and `checkAvailability` are pure functions with no imports
beyond other domain modules, which is why the browser and the server can both run them and get the
same answer.

---

## The database

41 tables. PostgreSQL only, and only core features — no extensions — so the schema runs unchanged on
the bundled database, on any managed PostgreSQL, and in CI.

```bash
npm run db:seed        # reset and fill (development)
npm run db:studio      # browse the data
npm run db:migrate     # create a migration after a schema change
npm run db:deploy      # apply migrations (production)
```

### Invariants enforced in the database

Application code checks these too. The database is what makes them true.

| Constraint                            | What it prevents                                                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Rental_total_is_sum_of_parts`        | A total that does not equal its line items — the check that makes a client-supplied total impossible to persist |
| `RentalItem_split_reconciles`         | Paying out more than was collected                                                                              |
| `RentalItem_reject_overlap`           | Two live bookings of one garment over overlapping dates, turnaround included                                    |
| `RentalItem_reject_self_rental`       | An owner renting from themselves to manufacture reviews                                                         |
| `Listing_published_requires_approval` | Publishing a listing that moderation has not approved                                                           |
| `*_money_non_negative`                | A negative amount anywhere in the ledger                                                                        |
| `Review_rating_range`                 | A rating outside 1–5                                                                                            |

Double-booking is prevented at two independent levels: the booking service serialises writes per
listing with a PostgreSQL transaction advisory lock and re-checks availability inside it, and the
trigger refuses an overlap even if that code is bypassed entirely. Both are tested.

---

## The domain layer

**Money** is an integer in the currency's minor unit — paise. Floating point never touches it. The
commission split is computed so that `commission + earnings === subtotal` by construction, which the
database then verifies.

**Dates** are `YYYY-MM-DD` strings with no time and no zone. Ranges are half-open `[start, end)`, so
two rentals can touch at a boundary without overlapping. `Date` objects appear only at the database
edge.

**Availability** accounts for the owner's minimum and maximum rental length, notice period, and the
turnaround days reserved after each rental — and it is the same function in the browser and on the
server, so the calendar cannot promise a range the server will refuse.

**Pricing** quotes a base period plus a per-day extension (`₹850 / 3 days`, then `₹200` a day),
because that is how this market actually prices. Fees, GST and the refundable deposit are itemised;
tax is never applied to the deposit.

**The booking state machine** declares every permitted transition and who may make it, once, as
data. Every status change in the application passes through `assertTransition`.

---

## Photography

The catalogue ships with generated photography: tonal drapery studies derived deterministically from
each garment's own colour. They read as a deliberate treatment rather than as missing assets, and
regenerate identically.

```bash
npm run media:generate    # ~6 minutes for 171 frames
```

**Replacing them with real photography changes no code.** Images are stored as opaque keys and
resolved to URLs at render time by `src/lib/media.ts`. Point `NEXT_PUBLIC_MEDIA_BASE_URL` at your
bucket or CDN and upload under the same keys — or let members upload through the listing wizard,
which writes new keys as they go.

---

## Environment

Every variable is documented in [`.env.example`](.env.example) and validated at start-up by
`src/env.ts`, which fails loudly rather than letting a missing key surface at the first payment.

Only `BETTER_AUTH_SECRET` is required in development. Everything else has a working default:

| Variable            | Default                                                                                                                                                                                             | Effect                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`      | A real PostgreSQL server. `POSTGRES_PRISMA_URL` and `POSTGRES_URL` are accepted too, so attaching a database in a hosting dashboard is enough. The bundled database is for development and CI only. |
| `PAYMENT_PROVIDER`  | `sandbox`                                                                                                                                                                                           | Deterministic in-process provider; contacts nobody |
| `STORAGE_DRIVER`    | `local`                                                                                                                                                                                             | Uploads to `public/uploads`                        |
| `EMAIL_DRIVER`      | `console`                                                                                                                                                                                           | Prints emails to the log; sends nothing            |
| `SEARCH_DRIVER`     | `postgres`                                                                                                                                                                                          | PostgreSQL full-text search                        |
| `RATE_LIMIT_DRIVER` | `memory`                                                                                                                                                                                            | In-process; use `redis` on more than one node      |

The sandbox payment provider is a full implementation of the payment port — idempotency, capture
limits, partial refunds, HMAC-signed webhooks — not a stub that returns success. Amounts ending in
`.13` are declined, so the failure paths are reachable.

---

## Testing

```bash
npm test           # unit and integration (112 tests)
npm run test:e2e   # end-to-end, in a real browser
npm run typecheck
npm run lint
```

Unit tests cover the domain layer exhaustively: money arithmetic and its reconciliation identity,
timezone-safe dates, availability including turnaround collisions, pricing including the GST and
deposit rules, and the state machine's reachability and authorisation.

`tests/unit/booking-concurrency.test.ts` runs against a real database and asserts the guarantee the
marketplace rests on: ten simultaneous requests for the same garment on the same dates produce
exactly one booking, and the database refuses an overlap even when the service is bypassed.

End-to-end tests walk the renter's journey through payment to a confirmation, the owner's queue and
earnings, and the authorisation boundaries — including that `/admin` leaks nothing to a member and
that an unsigned payment webhook is rejected.

---

## Deployment

### Vercel

Every push to `main` deploys. `vercel.json` points the build at `npm run vercel-build`, which runs
`prisma migrate deploy` before `next build` — the ordinary `build` script deliberately does not, so
that compiling the project on a laptop still needs no database.

Configure these in the project's environment variables before the first deploy. The application
validates them at boot and refuses to start if any are wrong, so a missing one is a 500 on every
route rather than a subtle failure later:

| Variable                      | Notes                                                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | A real PostgreSQL server. The bundled database is for development and CI only.                                         |
| `BETTER_AUTH_SECRET`          | 32+ characters. `openssl rand -base64 32`.                                                                             |
| `NEXT_PUBLIC_APP_URL`         | The canonical origin, e.g. `https://example.vercel.app`.                                                               |
| `BETTER_AUTH_URL`             | The same origin.                                                                                                       |
| `PAYMENT_PROVIDER`            | `razorpay` or `stripe`, with that provider's keys.                                                                     |
| `ALLOW_SANDBOX_PAYMENTS`      | `true` only for a demonstration instance that takes no money. Without it, a sandbox provider is refused in production. |
| `STORAGE_DRIVER`              | `s3`, with the bucket credentials. The filesystem is read-only on Vercel.                                              |
| `NEXT_PUBLIC_UPLOAD_BASE_URL` | The bucket's public URL. Without it, uploaded images 404.                                                              |
| `EMAIL_DRIVER`                | `resend`, with its key.                                                                                                |

Then create an administrator against the production database, with a password of your own:

```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=… npm run admin:create
```

Point the payment provider's webhook at `/api/webhooks/payments`.

### Anywhere else

```bash
npm run db:deploy    # apply migrations
npm run build
npm start
```

Point the payment provider's webhook at `/api/webhooks/payments`. `/api/health` queries the database
and is suitable for a load balancer.

Security headers, including a content security policy, are set in `next.config.ts`.

---

## Decisions worth knowing about

**PostgreSQL in WebAssembly for local development.** The alternative was a fixture layer that
diverges from production, or requiring Docker. This runs the real migrations and the real
constraints, so a bug in a trigger is found on a laptop rather than in production.

**Prices are recomputed on the server, never accepted.** Checkout sends a listing id and two dates.
Everything else is derived inside the booking transaction from freshly-read listing state.

**A payment is confirmed against the provider, never against the browser.** A redirect saying
"success" is a hint. `settlePayment` asks the provider what actually happened, and the webhook is
the authoritative record — so the flow completes correctly even if the member closes the tab.

**Deposits are held, not earned.** They are tracked separately from rental revenue, excluded from
the marketplace's own reported takings, and always displayed apart from the cost of a rental.

**Every listing is moderated before publication.** Enforced by a check constraint, not only by
application code.

**Roles are for the platform; ownership is for resources.** "Owner" is not a role — any member may
list — so authorisation on a listing or a rental is always checked against the record, never
against a role or a hidden navigation link.
