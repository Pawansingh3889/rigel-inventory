# Demo seed

Fills one tenant with six months of trading history so every module has real
records to render instead of empty states.

```bash
export SUPABASE_URL=https://<project-id>.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=...
npm run seed:demo -- --reset
```

Then `npm run dev` and sign in at `/auth`:

| | |
|---|---|
| Email | `demo@rigeldemo.dev` |
| Password | `RigelDemo@2026` |
| Company | Rigel Demo Industries |

`SUPABASE_SERVICE_ROLE_KEY` is required rather than the anon key for the same
reason the Seamly export needs it (see [seamly-export.md](seamly-export.md)):
row-level security scopes every table to the signed-in user's company, and this
runs unattended.

## Isolation

The ERP is multi-tenant, so the demo data is isolated by the same mechanism
that isolates real customers: one `companies` row, and RLS keeps it out of
every other tenant's queries. The script reads and writes nothing outside that
company id, and `--reset` removes it again.

`--reset` clears the tenant's master and transactional data but keeps the
company row, the profile and the auth user, so the login survives a re-seed.

Without `--reset`, seeding a tenant that already holds products is refused.
That is not caution for its own sake: `record_inventory_transaction` upserts on
`(company_id, reference_id, product_id, transaction_type)` and **adds** the
quantity on conflict, so a second pass would silently double stock rather than
overwrite it.

## What it writes

| Area | Rows |
|---|---|
| Masters | 3 warehouse bins, 5 categories, 40 products, 8 suppliers, 12 customers |
| Purchasing | ~62 purchase orders, ~50 GRNs with line-level accept/reject |
| Sales | ~96 sales orders, ~75 finalized invoices |
| Cash | payments against both invoices and receipts, with an unpaid tail |
| Returns | 9 return orders, each with a credit note |
| Inventory | receipts, issues and 12 adjustments |

Ids are derived from a fixed namespace and the random stream is seeded, so a
`--reset` and re-run reproduces the same dataset rather than a new one.

## Ordering is dictated by triggers

The sequence is not arbitrary. Three database behaviours constrain it:

- **`trg_grn_line_items_inventory`** calls `record_inventory_transaction` for
  every GRN line, so goods receipts must not be mirrored by hand. The script
  inserts GRN lines and lets the trigger raise stock.
- **`handle_sales_invoice_status_change`** fires `AFTER UPDATE` only. Invoices
  are therefore inserted as `draft` and then moved to `finalized`; inserting
  them finalized would generate neither an invoice number nor a stock issue.
- **`record_inventory_transaction`** is keyed on
  `(company_id, reference_id, product_id, transaction_type)`, so a product
  appears at most once per document.

Sales quantities are capped at roughly half of what has been received, because
`process_sales_invoice` subtracts straight from `products.stock_quantity` with
no floor and would otherwise drive it negative.

## Known defect this works around

`process_sales_invoice` passes `NULL` as the `warehouse_id` argument to
`record_inventory_transaction`, but `inventory_transactions.warehouse_id` is
`NOT NULL` (added in `20250831093417`). The insert raises, the function's own
exception block swallows it, and `handle_sales_invoice_status_change` only
issues a `RAISE WARNING`, so finalizing an invoice appears to succeed while
recording no stock issue at all.

The script does not assume either way. After finalizing, it counts
`sales_invoice` transactions for the tenant; if the trigger recorded none it
writes them directly with a real `warehouse_id` and decrements stock itself.
The fix in the application is to pass the invoice's `default_warehouse_id`
through, or to make the column nullable.
