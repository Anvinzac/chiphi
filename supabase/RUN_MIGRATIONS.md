# Supabase Migrations — Where & How Lovable should run them

**Project:** `xmijxukmucuufocblxuz` (see `supabase/config.toml`)
**Local migrations dir:** `supabase/migrations/` (SQL, ordered by timestamp prefix)

## Status: APPLIED (2026-08-23)

All pending migrations below have been applied to remote via the Lovable migration tool, plus
`20260821120000_order_item_money_amount.sql` (order_mode/money_amount columns) and the
`update_shared_order_extras` function from `20260821150000_order_shipping_deduction.sql`.
Verified: `get_shared_order` returns 200, `add_shared_order_alternate` / `update_shared_order_extras`
return 400 (function exists, token rejected) instead of 404 PGRST202.

## What was pending on remote (2026-08-23)

Remote PostgREST schema cache currently missing:

1. `supabase/migrations/20260821160000_order_identity.sql`
   - Adds `orders.customer_name TEXT`, `orders.day_seq INTEGER NOT NULL DEFAULT 1`, `orders.mgmt_id TEXT`
   - Creates trigger `assign_order_identity()` and backfills existing rows
   - Failure symptom: `could not find 'customer_name' column of 'orders' in schema cache` (OrderDetail `select("*")` / `customer_name` insert)

2. `supabase/migrations/20260821170000_order_item_alternate.sql`
   - Adds `order_items.is_alternate BOOLEAN`
   - Creates `public.add_shared_order_alternate(TEXT,TEXT,NUMERIC,TEXT)`, `update_shared_order_alternate`, `delete_shared_order_alternate` (SECURITY DEFINER, anon/authenticated GRANT)
   - Failure symptom: `PGRST202 Could not find the function public.add_shared_order_alternate(p_name,p_quantity,p_token,p_unit)` in vendor view `addAlternate`/`update`/`delete`

Both files are already committed locally — remote just needs them applied.

## How Lovable should run them (pick one)

### A. Supabase CLI (preferred, keeps `supabase_migrations` history)
```bash
# From repo root (where supabase/config.toml lives)
npx supabase link --project-ref xmijxukmucuufocblxuz
# Will prompt for DB password (from Dashboard → Database → Connection string) or use SUPABASE_ACCESS_TOKEN env
npx supabase db push
# This pushes all local files in supabase/migrations/ that are not yet on remote, in order.
```

### B. Dashboard SQL Editor (quick fix, no CLI)
1. Open https://supabase.com/dashboard/project/xmijxukmucuufocblxuz/sql
2. New query → paste **full contents** of `supabase/migrations/20260821160000_order_identity.sql` → Run
3. New query → paste **full contents** of `supabase/migrations/20260821170000_order_item_alternate.sql` → Run
4. New query → run `SELECT pg_notify('pgrst','reload schema');` to refresh PostgREST cache (otherwise new columns/functions stay invisible until cache TTL).

### C. Verify
```bash
curl -s -X POST https://xmijxukmucuufocblxuz.supabase.co/rest/v1/rpc/get_shared_order \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"p_token":"test"}' -i | head
# expect 200 (not 404)

curl -s -X POST https://xmijxukmucuufocblxuz.supabase.co/rest/v1/rpc/add_shared_order_alternate \
  -H "apikey: $VITE_SUPABASE_PUBLISHABLE_KEY" -H "Content-Type: application/json" \
  -d '{"p_token":"test","p_name":"test","p_quantity":1,"p_unit":"kg"}' -i | head
# expect NOT 404 PGRST202; 400/500 with "order not found" is fine (means function exists)

# Check columns exist:
# Dashboard → Table Editor → orders → verify customer_name, day_seq, mgmt_id visible
```

## Code resilience (already in repo)

`src/pages/OrderDetail.tsx` now falls back if columns missing:
- `loadExisting` tries `select("*")`, on `customer_name` error retries `select("id,title,status,share_token,created_at")`
- `ensurePersisted` tries insert with `customer_name`/`day_seq`/`mgmt_id`, on `customer_name` error retries without it
- After migrations are applied, the fallback is unused and full `customer_name`/`day_seq`/`mgmt_id` flow resumes.

**Do not delete** `supabase/migrations/20260821160000*` and `20260821170000*` — they are the source of truth.

## Lovable auto-deploy

Lovable watches `origin/main`. After pushing, it should either:
- Run `supabase db push` as part of its deploy (if it has `SUPABASE_ACCESS_TOKEN`/`SUPABASE_DB_PASSWORD`), or
- At minimum surface this file in its TODO so an operator knows to run option B.

If Lovable has a `supabase` integration, set:
- `SUPABASE_PROJECT_REF=xmijxukmucuufocblxuz`
- `SUPABASE_ACCESS_TOKEN` (from https://supabase.com/dashboard/account/tokens)
and enable “Run migrations on deploy”.

---
Generated 2026-08-23 for Lovable.
