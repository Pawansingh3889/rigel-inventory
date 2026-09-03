# Schema drift: migrations vs live database

Measured 2026-09-03 against Supabase project `rkqgxrwnvyccxumiwfip`.

## Method

The 227 files in `supabase/migrations/` were replayed in timestamp order onto a clean
PostgreSQL 16 container, with a small shim providing the objects Supabase supplies for
free (the `anon` / `authenticated` / `service_role` roles, an `auth` schema, and an
`auth.users` stand-in). The rebuilt schema was then compared against the live schema as
reported by PostgREST's OpenAPI document.

Reproduce with `scripts/replay-migrations.sh` (see below).

## Headline

**The migration history cannot rebuild this database.** It gets to roughly 73% of it.

| measure | result |
| --- | --- |
| migrations that apply cleanly | 182 of 227 |
| migrations that fail | 45 |
| live relations exposed by the API | 56 |
| relations the migrations rebuild | 41 |
| live relations never created by any migration | 16 |
| relations created by migrations but absent live | 1 |
| shared tables whose columns differ | 11 of 40 |

## Why the 45 fail

| cause | count | meaning |
| --- | --- | --- |
| object already exists | 23 | the same policy, table, trigger or column is created twice |
| references a missing object | 9 | depends on something no earlier migration creates |
| blocked by dependent objects | 6 | a drop is refused because other objects still need it |
| SQL syntax error | 3 | never executed anywhere, in any environment |
| constraint problem | 2 | missing unique constraint, or an FK violated by existing rows |
| other | 2 | function signature changes, RLS on a non-table |

The three syntax errors are the clearest evidence that this history is not a record of
what was actually run:

- `20250827165234_0918245b-9b5d-4bb8-9b8b-34f70af79075.sql`
- `20250827225400_e2ee913b-a5e1-4387-bfb6-7e8d2b37e182.sql`
- `20250827225439_26cac640-d9c7-4006-b9a0-ce6a17222ee2.sql`

## Live tables no migration creates (16)

`ai_conversation_history`, `backorder_items`, `business_registration_requests`,
`company_users_safe`, `current_stock_with_aging`, `customers_safe`, `debit_note_items`,
`debit_notes`, `document_format_configs`, `password_history`, `payment_transactions`,
`security_settings`, `supplier_credit_note_items`, `supplier_credit_notes`,
`suppliers_safe`, `user_roles`

`*_safe` entries are views. The rest are real tables holding real data, including
`user_roles` (15 rows) and `document_format_configs` (17 rows).

## Created by migrations but not live (1)

`user_company_access` is dead code. It was superseded by `company_users`.

## Column drift on shared tables (11 of 40)

Almost all of it is one-directional: the live database has columns the migrations never
add. That is the signature of schema edits made directly in the dashboard or by an agent
writing to the database without recording a migration.

| table | live only | migrations only |
| --- | --- | --- |
| `auth_rate_limits` | `hashed_email` | `email` |
| `companies` | 17 columns: banking (`account_holder_name`, `account_number`, `account_type`, `bank_name`, `branch_name`, `ifsc_code`, `swift_code`, `upi_id`), subscription (`subscription_plan`, `subscription_status`, `subscription_start_date`, `subscription_end_date`, `next_payment_due`, `last_payment_date`, `payment_reminder_sent`), branding (`logo_url`, `tagline`) | |
| `company_users` | `designation` | |
| `products` | `expiry_date`, `mfg_date`, `shelf_life_days` | |
| `profiles` | | `otp_code`, `otp_expires_at`, `role` |
| `purchase_orders` | `bin_id`, `delivery_place_of_supply`, `warehouse_id` | |
| `return_order_header` | `invoice_ids`, `invoice_numbers`, `place_of_supply` | |
| `return_order_lines` | `source_invoice_id` | |
| `sales_order_items` | `updated_at` | |
| `sales_orders` | 12 columns, all despatch and e-way-bill: `awb_no`, `carrier_transporter`, `delivery_postal_code`, `destination`, `dispatch_date`, `eta`, `eway_bill_date`, `eway_bill_no`, `item_count`, `place_of_supply`, `pod_document_url`, `tracking_status` | |
| `security_audit_log` | `severity` | |

`auth_rate_limits` and `profiles` are the two that matter most. `auth_rate_limits`
renamed `email` to `hashed_email` live, and `profiles` lost `otp_code`, `otp_expires_at`
and `role` live while the migrations still declare them. Both sit directly on the signup
and signin path.

## What this means

Do not try to repair the 227 files. The correct fix is to dump the live schema and adopt
it as a single baseline migration, retiring the existing history to an archive directory.
That requires a real `pg_dump`, which needs the database password from
Supabase dashboard → Project Settings → Database. The API service-role key is not
sufficient: PostgREST exposes data, not DDL.

Until that baseline exists, treat the live database as the only source of truth about its
own shape.
