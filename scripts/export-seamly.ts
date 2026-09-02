/**
 * Export one company's sales data as a Seamly source bundle.
 *
 * Seamly (../seamly) ingests a directory of CSVs whose shape is fixed by
 * `seamly/src/seamly/modules/ingest/contract.py`. Point Seamly's `fixture_dir`
 * setting at this script's output and its ingest/reconcile pipeline runs
 * against real ERP records instead of hand-written fixtures.
 *
 *   npm run export:seamly -- --company <uuid> --out ../seamly/data/fixtures/erp
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service key is
 * needed because row-level security scopes every table to the signed-in
 * user's company, and an export runs unattended.
 *
 * Three of Seamly's ten files have no ERP source and are written header-only:
 * deliveries, delivery_lines and service_events. See docs/seamly-export.md.
 */

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Column order matters: Seamly builds CustomerCsv/OrderCsv/DeliveryCsv/InvoiceCsv
// with `Dataclass(**row)`, so an unexpected or missing header is a TypeError
// surfacing as `ingest.malformed_row`. These match contract.py exactly.
const HEADERS = {
  'customers.csv': ['customer_id', 'name'],
  'contracts.csv': [
    'contract_id',
    'customer_id',
    'invoice_window_days',
    'duplicate_window_days',
    'late_delivery_penalty_minor',
  ],
  'price_book.csv': ['contract_id', 'sku', 'kind', 'unit_price_minor'],
  'orders.csv': ['order_id', 'order_ref', 'customer', 'promised_date'],
  'order_lines.csv': ['order_id', 'sku', 'quantity', 'unit_price_minor'],
  'deliveries.csv': ['delivery_id', 'carrier_reference', 'order_ref', 'customer', 'delivery_date'],
  'delivery_lines.csv': ['delivery_id', 'sku', 'quantity'],
  'invoices.csv': ['invoice_id', 'external_ref', 'order_ref', 'customer', 'invoice_date', 'contract_id'],
  'invoice_lines.csv': ['invoice_id', 'sku', 'quantity', 'unit_price_minor'],
  'service_events.csv': ['event_id', 'customer', 'code', 'units', 'event_date'],
} as const;

type FileName = keyof typeof HEADERS;
type Row = Record<string, string | number>;

/**
 * Convert a Postgres DECIMAL to integer minor units.
 *
 * Seamly prices everything in minor units; the ERP stores DECIMAL(12,2).
 * Parsed from the string form rather than via `value * 100` so that a
 * half-penny never lands on the wrong side of a rounding boundary and
 * silently shifts a reconciliation result.
 */
export function toMinor(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const raw = String(value).trim();
  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) throw new Error(`Not a decimal: ${raw}`);
  const [, sign, whole, frac = ''] = match;
  const pence = (frac + '00').slice(0, 2);
  const magnitude = BigInt(whole || '0') * 100n + BigInt(pence);
  const rounded = frac.length > 2 && Number(frac[2]) >= 5 ? magnitude + 1n : magnitude;
  return Number(sign === '-' ? -rounded : rounded);
}

/** Postgres DATE / TIMESTAMPTZ to the ISO date Seamly parses. */
export function toIsoDate(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function csvCell(value: string | number): string {
  const s = String(value ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(file: FileName, rows: Row[]): string {
  const headers = HEADERS[file] as readonly string[];
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvCell(row[h] ?? '')).join(','));
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Shapes read from Supabase. Only the columns the bundle needs.
// ---------------------------------------------------------------------------

export interface ErpData {
  customers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; sku: string; unit_price: string | number }>;
  salesOrders: Array<{
    id: string;
    customer_id: string;
    order_number: string;
    order_date: string;
    delivery_date: string | null;
  }>;
  salesOrderItems: Array<{
    sales_order_id: string;
    product_id: string;
    quantity: number;
    unit_price: string | number;
  }>;
  salesInvoices: Array<{
    id: string;
    invoice_number: string;
    invoice_date: string;
    sales_order_id: string | null;
    customer_id: string;
    customer_name: string;
  }>;
  salesInvoiceItems: Array<{
    sales_invoice_id: string;
    item_code: string;
    quantity_invoiced: number;
    unit_price: string | number;
  }>;
}

export interface ContractDefaults {
  invoiceWindowDays: number;
  duplicateWindowDays: number;
  latePenaltyMinor: number;
}

/**
 * Build the ten CSV texts from ERP rows.
 *
 * Pure: no I/O, no Supabase. That is what makes the mapping testable against
 * Seamly's own parser without a database.
 *
 * The ERP has no contract or terms table, so one contract per customer is
 * synthesised from `defaults` and the price book is derived from each
 * product's list price. That is what lets Seamly's `rate_mismatch` check run
 * at all: it compares an invoice line's rate against the book. Every other
 * field is a real ERP value.
 */
export function buildBundle(data: ErpData, defaults: ContractDefaults): Record<string, string> {
  const customerName = new Map(data.customers.map((c) => [c.id, c.name]));
  const sku = new Map(data.products.map((p) => [p.id, p.sku]));
  const contractId = (customerId: string) => `CON-${customerId.slice(0, 8)}`;

  // Order ref is the human-facing number Seamly joins invoices to orders on.
  const orderRef = new Map(data.salesOrders.map((o) => [o.id, o.order_number]));

  const unknownProducts = new Set<string>();
  const lineSku = (productId: string): string => {
    const found = sku.get(productId);
    if (!found) unknownProducts.add(productId);
    return found ?? '';
  };

  const bundle: Record<string, string> = {
    'customers.csv': toCsv(
      'customers.csv',
      data.customers.map((c) => ({ customer_id: c.id, name: c.name })),
    ),

    'contracts.csv': toCsv(
      'contracts.csv',
      data.customers.map((c) => ({
        contract_id: contractId(c.id),
        customer_id: c.id,
        invoice_window_days: defaults.invoiceWindowDays,
        duplicate_window_days: defaults.duplicateWindowDays,
        late_delivery_penalty_minor: defaults.latePenaltyMinor,
      })),
    ),

    // One book per customer contract, priced at the product list price.
    'price_book.csv': toCsv(
      'price_book.csv',
      data.customers.flatMap((c) =>
        data.products.map((p) => ({
          contract_id: contractId(c.id),
          sku: p.sku,
          kind: 'goods',
          unit_price_minor: toMinor(p.unit_price),
        })),
      ),
    ),

    'orders.csv': toCsv(
      'orders.csv',
      data.salesOrders.map((o) => ({
        order_id: o.id,
        order_ref: o.order_number,
        customer: customerName.get(o.customer_id) ?? '',
        // Seamly measures lateness against the promise, so the committed
        // delivery date is the right field; order_date is the fallback.
        promised_date: toIsoDate(o.delivery_date ?? o.order_date),
      })),
    ),

    'order_lines.csv': toCsv(
      'order_lines.csv',
      data.salesOrderItems.map((i) => ({
        order_id: i.sales_order_id,
        sku: lineSku(i.product_id),
        quantity: i.quantity,
        unit_price_minor: toMinor(i.unit_price),
      })),
    ),

    'invoices.csv': toCsv(
      'invoices.csv',
      data.salesInvoices.map((inv) => ({
        invoice_id: inv.id,
        external_ref: inv.invoice_number,
        // Invoices with no sales_order_id cannot be matched to an order;
        // they still count for duplicate detection.
        order_ref: inv.sales_order_id ? (orderRef.get(inv.sales_order_id) ?? '') : '',
        customer: inv.customer_name || (customerName.get(inv.customer_id) ?? ''),
        invoice_date: toIsoDate(inv.invoice_date),
        contract_id: contractId(inv.customer_id),
      })),
    ),

    'invoice_lines.csv': toCsv(
      'invoice_lines.csv',
      data.salesInvoiceItems.map((i) => ({
        invoice_id: i.sales_invoice_id,
        // sales_invoice_items carries the SKU directly as item_code.
        sku: i.item_code,
        quantity: i.quantity_invoiced,
        unit_price_minor: toMinor(i.unit_price),
      })),
    ),

    // No ERP source. The ERP records no dispatch: sales_invoices has a bare
    // delivery_note_number text column with no deliveries table behind it.
    // Header-only keeps the bundle valid; five of Seamly's eight reconcile
    // checks stay dormant until the ERP grows a deliveries table.
    'deliveries.csv': toCsv('deliveries.csv', []),
    'delivery_lines.csv': toCsv('delivery_lines.csv', []),
    'service_events.csv': toCsv('service_events.csv', []),
  };

  if (unknownProducts.size > 0) {
    throw new Error(
      `${unknownProducts.size} order line(s) reference a product missing from the products export ` +
        `(first: ${[...unknownProducts][0]}). Export aborted rather than emit blank SKUs.`,
    );
  }

  return bundle;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function arg(name: string, fallback?: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  if (fallback !== undefined) return fallback;
  throw new Error(`Missing required argument --${name}`);
}

async function fetchAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  // PostgREST caps a response at 1000 rows by default; page until short.
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await query(from, from + page - 1);
    if (error) throw new Error(`Failed reading ${label}: ${error.message}`);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. The service key is required: ' +
        'row-level security scopes these tables to a signed-in user, and this runs unattended.',
    );
  }

  const companyId = arg('company');
  const outDir = arg('out', './seamly-export');
  const defaults: ContractDefaults = {
    invoiceWindowDays: Number(arg('invoice-window', '30')),
    duplicateWindowDays: Number(arg('duplicate-window', '14')),
    latePenaltyMinor: Number(arg('late-penalty', '0')),
  };

  const db = createClient(url, key, { auth: { persistSession: false } });
  const scoped = <T>(table: string, cols: string) =>
    fetchAll<T>(
      (from, to) => db.from(table).select(cols).eq('company_id', companyId).range(from, to) as never,
      table,
    );

  const customers = await scoped<ErpData['customers'][number]>('customers', 'id,name');
  const products = await scoped<ErpData['products'][number]>('products', 'id,sku,unit_price');
  const salesOrders = await scoped<ErpData['salesOrders'][number]>(
    'sales_orders',
    'id,customer_id,order_number,order_date,delivery_date',
  );
  const salesInvoices = await scoped<ErpData['salesInvoices'][number]>(
    'sales_invoices',
    'id,invoice_number,invoice_date,sales_order_id,customer_id,customer_name',
  );

  // Line items have no company_id; scope them through their parent.
  const orderIds = salesOrders.map((o) => o.id);
  const invoiceIds = salesInvoices.map((i) => i.id);
  const salesOrderItems = orderIds.length
    ? await fetchAll<ErpData['salesOrderItems'][number]>(
        (from, to) =>
          db
            .from('sales_order_items')
            .select('sales_order_id,product_id,quantity,unit_price')
            .in('sales_order_id', orderIds)
            .range(from, to) as never,
        'sales_order_items',
      )
    : [];
  const salesInvoiceItems = invoiceIds.length
    ? await fetchAll<ErpData['salesInvoiceItems'][number]>(
        (from, to) =>
          db
            .from('sales_invoice_items')
            .select('sales_invoice_id,item_code,quantity_invoiced,unit_price')
            .in('sales_invoice_id', invoiceIds)
            .range(from, to) as never,
        'sales_invoice_items',
      )
    : [];

  const bundle = buildBundle(
    { customers, products, salesOrders, salesOrderItems, salesInvoices, salesInvoiceItems },
    defaults,
  );

  await mkdir(outDir, { recursive: true });
  for (const [name, text] of Object.entries(bundle)) {
    await writeFile(join(outDir, name), text, 'utf8');
  }

  const counts = Object.entries(bundle)
    .map(([name, text]) => `  ${name.padEnd(20)} ${text.trimEnd().split('\n').length - 1}`)
    .join('\n');
  console.log(`Wrote Seamly bundle to ${outDir}\n${counts}`);
  if (salesInvoices.length === 0) {
    console.warn('\nNo invoices exported. Every reconcile check needs invoices; Seamly will find nothing.');
  }
  console.log(
    '\ndeliveries, delivery_lines and service_events are header-only (no ERP source).\n' +
      'Seamly checks that stay dormant: delivered_not_invoiced, invoiced_not_delivered,\n' +
      'late_delivery_credit, service_not_invoiced, and the delivery half of quantity_mismatch.',
  );
}

// Only run when executed directly, so the pure helpers stay importable.
if (process.argv[1]?.endsWith('export-seamly.ts')) {
  main().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
