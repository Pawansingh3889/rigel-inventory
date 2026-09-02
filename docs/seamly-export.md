# Seamly export

Exports one company's sales data as a [Seamly](../../seamly) source bundle, so
Seamly's reconciliation runs against real ERP records instead of hand-written
fixtures.

```bash
export SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
npm run export:seamly -- --company <uuid> --out ../seamly/data/fixtures/erp
```

Then point Seamly at the output (`fixture_dir` in `seamly/src/seamly/config.py`,
default `data/fixtures/generic`) and run `make demo-reset` there.

| Flag | Default | Meaning |
|---|---|---|
| `--company` | required | Company UUID. The ERP is multi-tenant; an export is always one tenant. |
| `--out` | `./seamly-export` | Output directory, created if absent. |
| `--invoice-window` | `30` | Days for the synthesised contract's invoice window. |
| `--duplicate-window` | `14` | Days within which two invoices count as duplicates. |
| `--late-penalty` | `0` | Late delivery penalty in minor units. |

`SUPABASE_SERVICE_ROLE_KEY` is required rather than the anon key: row-level
security scopes every table to the signed-in user's company, and this runs
unattended.

## Mapping

The target shape is fixed by `seamly/src/seamly/modules/ingest/contract.py`.

| Seamly file | ERP source |
|---|---|
| `customers.csv` | `customers.id`, `.name` |
| `orders.csv` | `sales_orders`, `promised_date` ← `delivery_date` (falls back to `order_date`) |
| `order_lines.csv` | `sales_order_items`, SKU joined via `products` |
| `invoices.csv` | `sales_invoices`, `order_ref` resolved through `sales_order_id` |
| `invoice_lines.csv` | `sales_invoice_items`, SKU from `item_code`, quantity from `quantity_invoiced` |
| `contracts.csv` | **synthesised**, one per customer |
| `price_book.csv` | **synthesised** from `products.unit_price` |
| `deliveries.csv` | **empty**, no ERP source |
| `delivery_lines.csv` | **empty**, no ERP source |
| `service_events.csv` | **empty**, no ERP source |

### Money

The ERP stores `DECIMAL(12,2)`; Seamly works in integer minor units. `toMinor`
parses the decimal string rather than computing `value * 100`, because the
float form rounds the wrong way at a half-penny (`Math.round(1.005 * 100)` is
`100`, not `101`) and a reconciliation would silently disagree by a penny.

### Identity

Seamly resolves customers by normalised name, not by id: `normalise_name`
strips punctuation and legal suffixes, so `ACME Industrial Supplies` and
`Acme Industrial Supplies Ltd` collapse to one key. This matters because
`sales_invoices` denormalises `customer_name` onto the invoice, and it drifts
from `customers.name` over time. The export passes both through as-is and lets
Seamly reconcile them.

## What does not work yet

The ERP records no dispatch. `sales_invoices.delivery_note_number` is a bare
text column with no `deliveries` table behind it, so nothing captures what
physically left the building.

Five of Seamly's eight reconcile checks are therefore dormant:

- `delivered_not_invoiced`
- `invoiced_not_delivered`
- `late_delivery_credit`
- `service_not_invoiced`
- the delivery half of `quantity_mismatch`

Working today: `duplicate_invoices`, `detect_duplicates`, `rate_mismatch`
(invoice line rate against the product price book), and the order-versus-invoice
half of `quantity_mismatch`.

Adding `deliveries` and `delivery_lines` tables to the ERP, plus a dispatch step
in the Sales module, is what unlocks the other five. That is the highest-value
next change on the ERP side, and Seamly's contract is what makes the gap
visible.

## Contract drift

`scripts/export-seamly.ts` hardcodes Seamly's CSV headers in `HEADERS`. Seamly
builds four of its dataclasses with `Dataclass(**row)`, so an extra or missing
column is a hard `ingest.malformed_row` failure rather than a silently ignored
field. If Seamly's `contract.py` changes, this export breaks loudly, which is
the intent.
