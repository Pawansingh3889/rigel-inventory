/**
 * Seed one demo tenant with six months of trading history.
 *
 * The ERP is multi-tenant and every table is RLS-scoped to the signed-in
 * user's company, so a demo dataset is naturally isolated: everything this
 * script writes hangs off a single `companies` row and is removed again by
 * `--reset`. No other tenant is read or touched.
 *
 *   export SUPABASE_URL=...
 *   export SUPABASE_SERVICE_ROLE_KEY=...
 *   npm run seed:demo -- --reset
 *
 * The service key is required rather than the anon key for the same reason
 * the Seamly export needs it (see docs/seamly-export.md): RLS scopes reads
 * and writes to a session that a script does not have.
 *
 * Ordering is dictated by the database's own triggers, not by convenience:
 *
 *   - `trg_grn_line_items_inventory` calls `record_inventory_transaction`
 *     on every GRN line, so goods receipts must not be mirrored by hand or
 *     the stock lands twice.
 *   - `handle_sales_invoice_status_change` fires on UPDATE only, so invoices
 *     are inserted as `draft` and then moved to `finalized`; inserting them
 *     finalized would generate no invoice number and no stock issue.
 *   - `record_inventory_transaction` upserts on
 *     (company_id, reference_id, product_id, transaction_type) and *adds* on
 *     conflict, so a product appears at most once per document and re-running
 *     over live data is refused rather than silently doubling quantities.
 *
 * Every id is derived from a fixed namespace, so a `--reset` and re-run
 * reproduces the same dataset rather than a new random one.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const COMPANY_NAME = 'Rigel Demo Industries';
const DEMO_EMAIL = 'demo@rigeldemo.dev';
const DEMO_PASSWORD = 'RigelDemo@2026';

/** Company's own state. Customers elsewhere are billed IGST, not CGST+SGST. */
const HOME_STATE = 'Karnataka';

// ---------------------------------------------------------------------------
// Deterministic ids and pseudo-randomness
// ---------------------------------------------------------------------------

const NAMESPACE = 'rigel-erp:demo-seed:v1';

/** Stable UUIDv5-shaped id, so re-seeding reproduces the same dataset. */
function uid(...parts: (string | number)[]): string {
  const h = createHash('sha1').update(`${NAMESPACE}|${parts.join('|')}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = h.subarray(0, 16).toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)].join('-');
}

const COMPANY_ID = uid('company');

/** mulberry32: small, seeded, and identical across Node versions. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = rng(20260902);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (lo: number, hi: number): number => lo + Math.floor(rand() * (hi - lo + 1));

/** Round to paise. The columns are DECIMAL(12,2); float drift fails reconciliation. */
const r2 = (n: number): number => Math.round(n * 100) / 100;

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const TODAY = new Date();
const MONTHS = 6;

function daysAgo(n: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isoAt(dayOffset: number): string {
  const d = new Date(TODAY);
  d.setDate(d.getDate() - dayOffset);
  d.setHours(between(9, 18), between(0, 59), 0, 0);
  return d.toISOString();
}

const SPAN_DAYS = MONTHS * 30;

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  ['Cables & Wiring', 'Copper and aluminium conductors, flexible and armoured'],
  ['Switchgear', 'MCBs, RCCBs, contactors and distribution boards'],
  ['Lighting', 'LED luminaires, drivers and fittings'],
  ['Fasteners & Hardware', 'Bolts, anchors, cable ties and glands'],
  ['Instrumentation', 'Meters, sensors and control components'],
] as const;

/** [name, sku, categoryIndex, unit, costPrice, unitPrice, gst%, hsn] */
const CATALOGUE: readonly [string, string, number, string, number, number, number, string][] = [
  ['1.5 sqmm FR Copper Cable 90m', 'CBL-FR-1.5-90', 0, 'ROLL', 1180, 1690, 18, '85444911'],
  ['2.5 sqmm FR Copper Cable 90m', 'CBL-FR-2.5-90', 0, 'ROLL', 1890, 2680, 18, '85444911'],
  ['4 sqmm FR Copper Cable 90m', 'CBL-FR-4.0-90', 0, 'ROLL', 2940, 4150, 18, '85444911'],
  ['6 sqmm FR Copper Cable 90m', 'CBL-FR-6.0-90', 0, 'ROLL', 4320, 6080, 18, '85444911'],
  ['4C x 16 sqmm Armoured Cable', 'CBL-ARM-4C16', 0, 'MTR', 412, 585, 18, '85444929'],
  ['4C x 25 sqmm Armoured Cable', 'CBL-ARM-4C25', 0, 'MTR', 638, 905, 18, '85444929'],
  ['3C x 2.5 sqmm Flexible Cable', 'CBL-FLX-3C25', 0, 'MTR', 96, 138, 18, '85444919'],
  ['Single Core 10 sqmm Earth Wire', 'CBL-ERT-10', 0, 'MTR', 78, 112, 18, '85444911'],
  ['6A SP MCB C-Curve', 'SWG-MCB-6A', 1, 'NOS', 178, 265, 18, '85362000'],
  ['16A SP MCB C-Curve', 'SWG-MCB-16A', 1, 'NOS', 186, 278, 18, '85362000'],
  ['32A DP MCB C-Curve', 'SWG-MCB-32A-DP', 1, 'NOS', 468, 690, 18, '85362000'],
  ['63A FP MCB C-Curve', 'SWG-MCB-63A-FP', 1, 'NOS', 1240, 1795, 18, '85362000'],
  ['25A DP RCCB 30mA', 'SWG-RCCB-25A', 1, 'NOS', 1420, 2050, 18, '85362000'],
  ['40A FP RCCB 100mA', 'SWG-RCCB-40A', 1, 'NOS', 2380, 3390, 18, '85362000'],
  ['9A 3-Pole Contactor 240V', 'SWG-CTR-9A', 1, 'NOS', 812, 1180, 18, '85364900'],
  ['18A 3-Pole Contactor 240V', 'SWG-CTR-18A', 1, 'NOS', 1465, 2110, 18, '85364900'],
  ['8-Way SPN Distribution Board', 'SWG-DB-8SPN', 1, 'NOS', 1180, 1720, 18, '85371000'],
  ['16-Way TPN Distribution Board', 'SWG-DB-16TPN', 1, 'NOS', 3240, 4680, 18, '85371000'],
  ['100A 4P Changeover Switch', 'SWG-CHG-100A', 1, 'NOS', 3850, 5490, 18, '85365090'],
  ['9W LED Bulb B22 Cool White', 'LGT-BLB-9W', 2, 'NOS', 62, 96, 12, '94054010'],
  ['18W LED Bulb B22 Cool White', 'LGT-BLB-18W', 2, 'NOS', 134, 198, 12, '94054010'],
  ['20W LED Batten 4ft', 'LGT-BTN-20W', 2, 'NOS', 218, 325, 12, '94054010'],
  ['36W LED Batten 4ft Twin', 'LGT-BTN-36W', 2, 'NOS', 398, 585, 12, '94054010'],
  ['50W LED Flood Light IP65', 'LGT-FLD-50W', 2, 'NOS', 685, 985, 12, '94054010'],
  ['150W LED Flood Light IP66', 'LGT-FLD-150W', 2, 'NOS', 1980, 2840, 12, '94054010'],
  ['24W LED Panel Round Recessed', 'LGT-PNL-24W', 2, 'NOS', 342, 498, 12, '94054010'],
  ['60W LED High Bay IP65', 'LGT-HBY-60W', 2, 'NOS', 2140, 3050, 12, '94054010'],
  ['LED Driver 36W Constant Current', 'LGT-DRV-36W', 2, 'NOS', 186, 275, 18, '85044090'],
  ['M8 x 50 Hex Bolt Zinc (100 pk)', 'FST-BLT-M850', 3, 'PKT', 268, 395, 18, '73181500'],
  ['M10 x 75 Hex Bolt Zinc (100 pk)', 'FST-BLT-M1075', 3, 'PKT', 462, 675, 18, '73181500'],
  ['M12 Wedge Anchor (50 pk)', 'FST-ANC-M12', 3, 'PKT', 585, 848, 18, '73182900'],
  ['200mm Nylon Cable Tie (1000 pk)', 'FST-TIE-200', 3, 'PKT', 312, 465, 18, '39231010'],
  ['300mm Nylon Cable Tie (1000 pk)', 'FST-TIE-300', 3, 'PKT', 528, 768, 18, '39231010'],
  ['PG16 Brass Cable Gland (50 pk)', 'FST-GLD-PG16', 3, 'PKT', 745, 1080, 18, '85369090'],
  ['PG21 Brass Cable Gland (50 pk)', 'FST-GLD-PG21', 3, 'PKT', 1120, 1620, 18, '85369090'],
  ['Single Phase Digital Energy Meter', 'INS-MTR-1P', 4, 'NOS', 1180, 1690, 18, '90283010'],
  ['Three Phase Digital Energy Meter', 'INS-MTR-3P', 4, 'NOS', 4280, 6120, 18, '90283010'],
  ['96mm Panel Ammeter 0-100A', 'INS-AMM-96', 4, 'NOS', 685, 995, 18, '90303300'],
  ['PT100 Temperature Sensor 150mm', 'INS-SNS-PT100', 4, 'NOS', 848, 1220, 18, '90251190'],
  ['Digital Temperature Controller 72mm', 'INS-CTL-72', 4, 'NOS', 1620, 2340, 18, '90322000'],
];

/** [name, city, state, contact, gst] */
const SUPPLIERS: readonly [string, string, string, string, string][] = [
  ['Vidyut Conductors Pvt Ltd', 'Bengaluru', 'Karnataka', 'Ramesh Iyer', '29AABCV1234K1Z5'],
  ['Deccan Switchgear Supplies', 'Hyderabad', 'Telangana', 'Sana Qureshi', '36AACCD5678L1Z2'],
  ['Meridian Lighting Systems', 'Chennai', 'Tamil Nadu', 'Karthik Balan', '33AAECM9012M1Z8'],
  ['Sterling Fasteners & Hardware', 'Pune', 'Maharashtra', 'Nilesh Wagh', '27AAFCS3456N1Z1'],
  ['Precision Instruments India', 'Bengaluru', 'Karnataka', 'Anjali Rao', '29AAGCP7890P1Z7'],
  ['Kaveri Cable Industries', 'Mysuru', 'Karnataka', 'Girish Hegde', '29AAHCK2345Q1Z4'],
  ['Northgate Electricals Ltd', 'Noida', 'Uttar Pradesh', 'Vikram Sethi', '09AAJCN6789R1Z9'],
  ['Coastal Power Components', 'Kochi', 'Kerala', 'Deepa Menon', '32AAKCC0123S1Z6'],
];

/** [name, city, state, contact, gst, creditDays] */
const CUSTOMERS: readonly [string, string, string, string, string, number][] = [
  ['Anand Constructions Pvt Ltd', 'Bengaluru', 'Karnataka', 'Prakash Anand', '29AABCA1111A1Z0', 30],
  ['Bharat Infra Projects', 'Bengaluru', 'Karnataka', 'Sunita Kulkarni', '29AABCB2222B1Z9', 45],
  ['Coromandel Facilities Management', 'Chennai', 'Tamil Nadu', 'Ravi Subramanian', '33AABCC3333C1Z8', 30],
  ['Deccan Housing Developers', 'Hyderabad', 'Telangana', 'Imran Baig', '36AABCD4444D1Z7', 60],
  ['Everest Electricals & Contracts', 'Pune', 'Maharashtra', 'Meera Joshi', '27AABCE5555E1Z6', 30],
  ['Fortune Retail Estates', 'Bengaluru', 'Karnataka', 'Nikhil Shetty', '29AABCF6666F1Z5', 15],
  ['Gateway Industrial Services', 'Mangaluru', 'Karnataka', 'Sharath Pai', '29AABCG7777G1Z4', 30],
  ['Harbour Line Logistics Park', 'Kochi', 'Kerala', 'Elizabeth Thomas', '32AABCH8888H1Z3', 45],
  ['Indus Valley Hotels Group', 'Mysuru', 'Karnataka', 'Rajat Malhotra', '29AABCI9999I1Z2', 30],
  ['Jupiter Manufacturing Works', 'Coimbatore', 'Tamil Nadu', 'Lakshmi Narayan', '33AABCJ1010J1Z1', 60],
  ['Kestrel Data Centres India', 'Hyderabad', 'Telangana', 'Arjun Reddy', '36AABCK1111K1Z0', 45],
  ['Lakeview Township Association', 'Bengaluru', 'Karnataka', 'Farida Khan', '29AABCL1212L1Z9', 30],
];

const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'upi', 'cash'] as const;
const RETURN_REASONS = [
  'Damaged in transit',
  'Wrong item supplied',
  'Excess quantity delivered',
  'Quality not to specification',
] as const;

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

type Db = SupabaseClient;

/** One row of an insert payload. Columns are validated by the database, not here. */
type Row = Record<string, unknown>;

/** The invoice-line fields that returns and the stock fallback read back. */
type InvoiceItemRow = Row & {
  product_id: string;
  quantity_invoiced: number;
  unit_price: number;
};

/** Insert in chunks; PostgREST payloads get unwieldy well before the row cap. */
async function insert(db: Db, table: string, rows: Row[], chunk = 200): Promise<void> {
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await db.from(table).insert(slice);
    if (error) throw new Error(`insert ${table} [${i}..${i + slice.length}): ${error.message}`);
  }
}

/**
 * Resolve an auth user id by email. The admin API has no email filter, so
 * this walks pages rather than assuming the account sits in the first one.
 */
async function findUserByEmail(db: Db, email: string): Promise<string | null> {
  for (let page = 1; page <= 50; page++) {
    const listed = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (listed.error) throw new Error(`listUsers page ${page}: ${listed.error.message}`);
    const match = listed.data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
    if (listed.data.users.length < 200) return null;
  }
  return null;
}

async function countRows(db: Db, table: string, column = 'company_id'): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq(column, COMPANY_ID);
  if (error) return -1;
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Line maths
// ---------------------------------------------------------------------------

interface Line {
  qty: number;
  unitPrice: number;
  discountPct: number;
  discount: number;
  taxable: number;
  gstRate: number;
  cgstRate: number;
  sgstRate: number;
  igstRate: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  total: number;
}

/**
 * Build one taxed line. Place of supply decides the split: within the home
 * state GST halves into CGST and SGST, outside it becomes a single IGST
 * charge. The totals are identical either way, but the three columns are
 * what the invoice PDF and the GST reports read.
 */
function line(qty: number, unitPrice: number, gstRate: number, discountPct: number, interState: boolean): Line {
  const gross = r2(qty * unitPrice);
  const discount = r2((gross * discountPct) / 100);
  const taxable = r2(gross - discount);
  const cgstRate = interState ? 0 : gstRate / 2;
  const sgstRate = interState ? 0 : gstRate / 2;
  const igstRate = interState ? gstRate : 0;
  const cgst = r2((taxable * cgstRate) / 100);
  const sgst = r2((taxable * sgstRate) / 100);
  const igst = r2((taxable * igstRate) / 100);
  const tax = r2(cgst + sgst + igst);
  return {
    qty, unitPrice, discountPct, discount, taxable,
    gstRate, cgstRate, sgstRate, igstRate, cgst, sgst, igst, tax,
    total: r2(taxable + tax),
  };
}

const sum = (xs: number[]): number => r2(xs.reduce((a, b) => a + b, 0));

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * Delete everything this script created for the demo tenant, leaving the
 * company row, the profile and the auth user in place so the login keeps
 * working across re-seeds.
 */
async function reset(db: Db): Promise<void> {
  const byCompany = [
    'credit_note_items', 'credit_notes',
    'return_order_lines', 'return_order_header',
    'payments',
    'sales_invoice_items', 'sales_invoices',
    'sales_order_items', 'sales_orders',
    'grn_line_items', 'grn_header',
    'purchase_order_items', 'purchase_orders',
    'inventory_transactions', 'inventory_adjustments', 'stock_transfers',
    'bom_components', 'bom_headers', 'production_runs',
    'products', 'product_categories',
    'customers', 'suppliers', 'warehouse_bins',
    'transaction_audit_log',
  ];

  // Child tables carry no company_id, so clear them through their parent.
  const children: [string, string, string][] = [
    ['credit_note_items', 'credit_note_id', 'credit_notes'],
    ['return_order_lines', 'return_order_id', 'return_order_header'],
    ['sales_invoice_items', 'sales_invoice_id', 'sales_invoices'],
    ['sales_order_items', 'sales_order_id', 'sales_orders'],
    ['grn_line_items', 'grn_header_id', 'grn_header'],
    ['purchase_order_items', 'purchase_order_id', 'purchase_orders'],
    ['bom_components', 'bom_header_id', 'bom_headers'],
  ];

  for (const [child, fk, parent] of children) {
    const { data } = await db.from(parent).select('id').eq('company_id', COMPANY_ID);
    const ids = (data ?? []).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 200) {
      await db.from(child).delete().in(fk, ids.slice(i, i + 200));
    }
  }

  for (const table of byCompany) {
    if (children.some(([c]) => c === table)) continue;
    const { error } = await db.from(table).delete().eq('company_id', COMPANY_ID);
    if (error && !/does not exist|schema cache/i.test(error.message)) {
      console.warn(`  reset ${table}: ${error.message}`);
    }
  }
  console.log('  demo tenant cleared');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }
  const wantsReset = process.argv.includes('--reset');

  const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- company -------------------------------------------------------------
  console.log('company');
  // business_ref_no is supplied rather than left to the trigger: the live
  // database carries a companies trigger that reads
  // `public.gated_business_registration_requests`, a table that no longer
  // exists, and it only runs when the column arrives NULL or empty.
  const { error: companyError } = await db.from('companies').upsert({
    id: COMPANY_ID,
    business_ref_no: 'BUS-DEMO-RIGEL',
    name: COMPANY_NAME,
    email: 'accounts@rigeldemo.dev',
    phone: '+91 80 4123 8800',
    address: '4th Floor, Trinity Works, Old Airport Road',
    address_line1: '4th Floor, Trinity Works',
    address_line2: 'Old Airport Road, Domlur',
    city: 'Bengaluru',
    state: HOME_STATE,
    postal_code: '560071',
    country: 'India',
    gstn: '29AAACR1234E1ZX',
    website: 'https://rigeldemo.dev',
    status: 'active',
  }, { onConflict: 'id' });
  if (companyError) throw new Error(`companies: ${companyError.message}`);

  // --- guard against seeding on top of live data ---------------------------
  const existingProducts = await countRows(db, 'products');
  if (existingProducts > 0 && !wantsReset) {
    throw new Error(
      `demo tenant already holds ${existingProducts} products. ` +
      `Re-run with --reset. Seeding twice would double stock: ` +
      `record_inventory_transaction adds on conflict rather than replacing.`,
    );
  }
  if (wantsReset) {
    console.log('reset');
    await reset(db);
  }

  // --- auth user -----------------------------------------------------------
  // `handle_new_user` creates a fresh company for every signup unless the
  // metadata marks the user as invited into one, which is exactly the path
  // a demo login needs: attach to the seeded company, do not spawn another.
  console.log('demo user');
  let userId: string | null = null;
  const found = await findUserByEmail(db, DEMO_EMAIL);
  if (found) {
    userId = found;
    await db.auth.admin.updateUserById(userId, { password: DEMO_PASSWORD, email_confirm: true });
  } else {
    const { data: created, error: userError } = await db.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: 'Demo',
        last_name: 'Owner',
        company_id: COMPANY_ID,
        invited_via: 'invite-business-user',
        app_role: 'owner',
        city: 'Bengaluru',
        state: HOME_STATE,
        country: 'India',
      },
    });
    if (userError) throw new Error(`createUser: ${userError.message}`);
    userId = created.user.id;
  }
  const owner = userId!;

  const { error: profileError } = await db.from('profiles').upsert({
    user_id: owner,
    company_id: COMPANY_ID,
    first_name: 'Demo',
    last_name: 'Owner',
    phone: '+91 98450 00000',
    city: 'Bengaluru',
    state: HOME_STATE,
    country: 'India',
    role: 'owner',
    is_active: true,
  }, { onConflict: 'user_id' });
  if (profileError) throw new Error(`profiles: ${profileError.message}`);

  await db.from('user_company_access').upsert({
    id: uid('access', owner),
    user_id: owner,
    company_id: COMPANY_ID,
    role: 'owner',
    is_active: true,
  }, { onConflict: 'id' });

  await db.from('subscriptions').upsert({
    id: uid('subscription'),
    business_id: COMPANY_ID,
    plan_type: 'yearly',
    payment_status: 'paid',
    amount: 49999,
    currency: 'INR',
    start_date: daysAgo(SPAN_DAYS),
    end_date: daysAgo(-365),
  }, { onConflict: 'id' });

  // --- warehouses ----------------------------------------------------------
  console.log('warehouses and catalogue');
  const bins = [
    {
      id: uid('bin', 'MAIN'), company_id: COMPANY_ID, wh_bin_code: 'BLR1',
      bin_name: 'MainStore', warehouse_code: 'BLR', warehouse_name: 'Bengaluru Central Warehouse',
      address_line1: 'Plot 22, Peenya Industrial Area Phase II', city: 'Bengaluru',
      state: HOME_STATE, postal_code: '560058', country: 'India',
      contact_person_name: 'Suresh Gowda', contact_person_phone: '+91 98860 11223',
      is_default: true, is_active: true,
    },
    {
      id: uid('bin', 'PROJ'), company_id: COMPANY_ID, wh_bin_code: 'BLR2',
      bin_name: 'Staging', warehouse_code: 'BLR', warehouse_name: 'Bengaluru Central Warehouse',
      address_line1: 'Plot 22, Peenya Industrial Area Phase II', city: 'Bengaluru',
      state: HOME_STATE, postal_code: '560058', country: 'India',
      contact_person_name: 'Latha Nayak', contact_person_phone: '+91 98860 11224',
      is_default: false, is_active: true,
    },
    {
      id: uid('bin', 'HYD'), company_id: COMPANY_ID, wh_bin_code: 'HYD1',
      bin_name: 'MainStore', warehouse_code: 'HYD', warehouse_name: 'Hyderabad Depot',
      address_line1: 'Survey 118, Kukatpally', city: 'Hyderabad',
      state: 'Telangana', postal_code: '500072', country: 'India',
      contact_person_name: 'Mohan Rao', contact_person_phone: '+91 99490 44556',
      is_default: false, is_active: true,
    },
  ];
  await insert(db, 'warehouse_bins', bins);
  const mainBin = bins[0].id;

  // --- categories and products --------------------------------------------
  const categories = CATEGORIES.map(([name, description], i) => ({
    id: uid('category', i), company_id: COMPANY_ID, name, description,
  }));
  await insert(db, 'product_categories', categories);

  interface Product {
    id: string; sku: string; name: string; unit: string;
    cost: number; price: number; gst: number; hsn: string;
    /** Accumulated as GRN lines are built, so sales never outrun receipts. */
    received: number;
  }
  const products: Product[] = CATALOGUE.map(([name, sku, , unit, cost, price, gst, hsn]) => ({
    id: uid('product', sku), sku, name, unit, cost, price, gst, hsn, received: 0,
  }));
  await insert(db, 'products', CATALOGUE.map(([name, sku, cat, unit, cost, price, gst, hsn], i) => ({
    id: uid('product', sku), company_id: COMPANY_ID, category_id: categories[cat].id,
    name, sku, description: `${name} - ${CATEGORIES[cat][0]}`,
    product_category: CATEGORIES[cat][0], product_type: 'goods',
    unit, cost_price: cost, unit_price: price, mrp: r2(price * 1.15),
    gst_percentage: gst, is_taxable: true, hsn_code: hsn,
    stock_quantity: 0, min_stock_level: between(10, 40), max_stock_level: between(400, 900),
    wh_bin_code: 'BLR1', bin_name: 'MainStore',
    barcode: `890${String(1000000 + i)}`,
    weight_kg: r2(0.2 + rand() * 8), is_active: true,
  })));

  // --- suppliers and customers --------------------------------------------
  interface Supplier {
    id: string; code: string; name: string; contact: string; email: string;
    phone: string; state: string; gst: string; paymentTerms: string;
  }
  const suppliers: Supplier[] = SUPPLIERS.map(([name, , state, contact, gst], i) => ({
    id: uid('supplier', i),
    code: `SUP-${String(i + 1).padStart(3, '0')}`,
    name, contact, state, gst,
    email: `purchase@${name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 14)}.example.com`,
    phone: `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`,
    paymentTerms: pick(['Net 30', 'Net 45', 'Net 15']),
  }));
  await insert(db, 'suppliers', SUPPLIERS.map(([name, city, state, , gst], i) => ({
    id: suppliers[i].id, company_id: COMPANY_ID, name, supplier_ref: suppliers[i].code,
    contact_person: suppliers[i].contact, email: suppliers[i].email, phone: suppliers[i].phone,
    address_line1: `Unit ${between(10, 99)}, Industrial Estate`, city, state,
    pin_code: String(between(400001, 682099)), country: 'India',
    gst_number: gst, pan_number: gst.slice(2, 12),
    payment_terms: suppliers[i].paymentTerms, credit_time: pick([15, 30, 45]),
    supplier_type: 'vendor', preferred_currency: 'INR', place_of_supply: state,
    bank_name: pick(['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank']),
    account_number: String(between(10000000, 99999999)) + String(between(1000, 9999)),
    ifsc_code: `HDFC000${between(1000, 9999)}`, is_active: true,
  })));

  interface Customer {
    id: string; name: string; contact: string; email: string; phone: string;
    address: string; city: string; state: string; pin: string;
    paymentTerms: string; creditDays: number;
  }
  const customers: Customer[] = CUSTOMERS.map(([name, city, state, contact, , creditDays], i) => ({
    id: uid('customer', i), name, contact, city, state, creditDays,
    email: `accounts@${name.toLowerCase().replace(/[^a-z]+/g, '').slice(0, 14)}.example.com`,
    phone: `+91 ${between(70, 99)}${between(100, 999)} ${between(10000, 99999)}`,
    address: `${between(1, 200)}, ${pick(['MG Road', 'Ring Road', 'Industrial Layout', 'Beach Road'])}`,
    pin: String(between(400001, 682099)),
    paymentTerms: `Net ${creditDays}`,
  }));
  await insert(db, 'customers', CUSTOMERS.map(([name, , state, , gst, creditDays], i) => ({
    id: customers[i].id, company_id: COMPANY_ID, name,
    contact_person: customers[i].contact, email: customers[i].email, phone: customers[i].phone,
    address_line1: customers[i].address, city: customers[i].city, state,
    pin_code: customers[i].pin, country: 'India',
    gstin: gst, pan_number: gst.slice(2, 12), gst_tax_location: state,
    customer_type: pick(['corporate', 'contractor', 'institutional']),
    credit_limit: between(5, 40) * 100000, credit_limit_days: creditDays,
    payment_terms: customers[i].paymentTerms, preferred_currency: 'INR',
    preferred_payment_method: 'bank_transfer', billing_cycle: 'monthly',
    same_as_registered_address: true, is_active: true,
  })));

  // =========================================================================
  // Purchasing: PO -> GRN. The GRN line trigger raises stock, so nothing
  // here writes inventory_transactions by hand.
  // =========================================================================
  console.log('purchase orders and goods receipts');

  const purchaseOrders: Row[] = [];
  const poItems: Row[] = [];
  const grnHeaders: Row[] = [];
  const grnLines: Row[] = [];
  const poReceipts: { poId: string; supplierIdx: number; day: number; total: number }[] = [];

  const PO_COUNT = 62;
  for (let n = 0; n < PO_COUNT; n++) {
    const poId = uid('po', n);
    const supplierIdx = between(0, suppliers.length - 1);
    const supplier = suppliers[supplierIdx];
    const interState = supplier.state !== HOME_STATE;
    const orderDay = SPAN_DAYS - Math.floor((n / PO_COUNT) * (SPAN_DAYS - 12)) - between(0, 4);
    const poNumber = `PO-${String(2400 + n)}`;

    // Unique products per document: record_inventory_transaction is keyed on
    // (company, reference, product, type) and adds on conflict.
    const chosen = new Set<number>();
    const lineCount = between(3, 7);
    while (chosen.size < lineCount) chosen.add(between(0, products.length - 1));

    const lines = [...chosen].map((pi) => {
      const p = products[pi];
      const qty = between(10, 120);
      const l = line(qty, p.cost, p.gst, pick([0, 0, 0, 5]), interState);
      return { p, l };
    });

    const subtotal = sum(lines.map(({ l }) => l.taxable));
    const taxTotal = sum(lines.map(({ l }) => l.tax));
    const discountTotal = sum(lines.map(({ l }) => l.discount));
    const total = r2(subtotal + taxTotal);

    // The oldest orders are fully received; the newest are still open, so the
    // Purchase module has something in every status.
    const fullyReceived = orderDay > 20;
    const partiallyReceived = !fullyReceived && orderDay > 8;

    purchaseOrders.push({
      id: poId, company_id: COMPANY_ID, created_by: owner, po_number: poNumber,
      supplier_id: supplier.id, supplier_code: supplier.code,
      supplier_contact_person: supplier.contact, supplier_contact_email: supplier.email,
      supplier_contact_phone: supplier.phone, supplier_gstin: supplier.gst,
      order_date: daysAgo(orderDay), expected_date: daysAgo(orderDay - between(7, 21)),
      status: fullyReceived ? 'received' : partiallyReceived ? 'partial' : 'pending',
      currency: 'INR', payment_terms: supplier.paymentTerms,
      subtotal_amount: subtotal, total_tax_amount: taxTotal,
      total_discount_amount: discountTotal, total_amount: total,
      company_place_of_supply: HOME_STATE, same_as_registered_address: true,
      delivery_address_line1: 'Plot 22, Peenya Industrial Area Phase II',
      delivery_city: 'Bengaluru', delivery_state: HOME_STATE,
      delivery_postal_code: '560058', delivery_country: 'India',
      notes: fullyReceived ? null : 'Awaiting supplier despatch confirmation',
      created_at: isoAt(orderDay), updated_at: isoAt(orderDay),
    });

    lines.forEach(({ p, l }, li) => {
      const received = fullyReceived ? l.qty : partiallyReceived ? Math.floor(l.qty * 0.6) : 0;
      poItems.push({
        id: uid('poitem', n, li), purchase_order_id: poId, product_id: p.id,
        item_code: p.sku, item_description: p.name, unit_of_measure: p.unit,
        quantity: l.qty, received_quantity: received, pending_quantity: l.qty - received,
        unit_price: l.unitPrice, total_price: l.total,
        discount_percentage: l.discountPct, discount_amount: l.discount,
        taxable_value: l.taxable, gst_rate: l.gstRate, hsn_sac_code: p.hsn, is_taxable: true,
        cgst_rate: l.cgstRate, cgst_amount: l.cgst,
        sgst_rate: l.sgstRate, sgst_amount: l.sgst,
        igst_rate: l.igstRate, igst_amount: l.igst,
      });
    });

    if (!fullyReceived && !partiallyReceived) continue;

    // --- goods receipt ---
    const grnId = uid('grn', n);
    const grnDay = Math.max(1, orderDay - between(5, 16));
    const receiptLines = lines.map(({ p, l }) => {
      const ordered = l.qty;
      const receivedQty = fullyReceived ? ordered : Math.floor(ordered * 0.6);
      // A small share of receipts carries a rejection, so the GRN screen and
      // the rejected-quantity totals are not uniformly zero.
      const rejected = receivedQty > 20 && rand() < 0.12 ? between(1, 4) : 0;
      const accepted = receivedQty - rejected;
      const rl = line(accepted, p.cost, p.gst, l.discountPct, interState);
      return { p, ordered, receivedQty, rejected, accepted, rl };
    }).filter((x) => x.accepted > 0);

    if (receiptLines.length === 0) continue;

    const grnSubtotal = sum(receiptLines.map((x) => x.rl.taxable));
    const grnTax = sum(receiptLines.map((x) => x.rl.tax));
    const grnDiscount = sum(receiptLines.map((x) => x.rl.discount));
    const grnTotal = r2(grnSubtotal + grnTax);

    grnHeaders.push({
      id: grnId, company_id: COMPANY_ID, created_by: owner,
      grn_number: `GRN-${String(3400 + n)}`, purchase_order_id: poId,
      supplier_id: supplier.id, supplier_name: supplier.name,
      grn_date: daysAgo(grnDay), status: 'completed',
      grn_reference_no: `DC-${between(10000, 99999)}`,
      supplier_invoice_number: `${supplier.name.slice(0, 3).toUpperCase()}/${between(100, 999)}/${new Date().getFullYear()}`,
      supplier_invoice_date: daysAgo(grnDay + between(0, 3)),
      total_ordered_quantity: receiptLines.reduce((a, x) => a + x.ordered, 0),
      total_received_quantity: receiptLines.reduce((a, x) => a + x.receivedQty, 0),
      total_accepted_quantity: receiptLines.reduce((a, x) => a + x.accepted, 0),
      total_rejected_quantity: receiptLines.reduce((a, x) => a + x.rejected, 0),
      subtotal_amount: grnSubtotal, total_tax_amount: grnTax,
      total_discount_amount: grnDiscount, total_amount: grnTotal,
      remarks: fullyReceived ? 'Received in full against PO' : 'Part delivery, balance pending',
      created_at: isoAt(grnDay), updated_at: isoAt(grnDay),
    });

    receiptLines.forEach((x, li) => {
      grnLines.push({
        id: uid('grnline', n, li), grn_header_id: grnId, product_id: x.p.id,
        product_name: x.p.name, product_sku: x.p.sku, unit_of_measure: x.p.unit,
        ordered_quantity: x.ordered, received_quantity: x.receivedQty,
        accepted_quantity: x.accepted, rejected_quantity: x.rejected,
        unit_price: x.rl.unitPrice, line_total: x.rl.total,
        discount_percentage: x.rl.discountPct, discount_amount: x.rl.discount,
        hsn_sac_code: x.p.hsn,
        cgst_rate: x.rl.cgstRate, cgst_amount: x.rl.cgst,
        sgst_rate: x.rl.sgstRate, sgst_amount: x.rl.sgst,
        igst_rate: x.rl.igstRate, igst_amount: x.rl.igst,
        total_tax_amount: x.rl.tax,
        warehouse_id: mainBin, bin_id: mainBin,
      });
      x.p.received += x.accepted;
    });

    poReceipts.push({ poId, supplierIdx, day: grnDay, total: grnTotal });
  }

  await insert(db, 'purchase_orders', purchaseOrders);
  await insert(db, 'purchase_order_items', poItems);
  await insert(db, 'grn_header', grnHeaders);
  await insert(db, 'grn_line_items', grnLines);
  console.log(`  ${purchaseOrders.length} POs, ${grnHeaders.length} GRNs, ${grnLines.length} receipt lines`);

  // =========================================================================
  // Sales: order -> invoice (draft, then finalized) -> payment
  // =========================================================================
  console.log('sales orders and invoices');

  // Never sell more than has been received: process_sales_invoice subtracts
  // straight from products.stock_quantity and would drive it negative.
  const sellable = new Map(products.map((p) => [p.id, Math.floor(p.received * 0.55)]));

  const salesOrders: Row[] = [];
  const soItems: Row[] = [];
  const invoices: Row[] = [];
  const invoiceItems: Row[] = [];
  interface InvoiceRef {
    id: string; number: string; customerIdx: number; day: number;
    total: number; items: InvoiceItemRow[];
  }
  const invoiceIndex: InvoiceRef[] = [];

  const SO_COUNT = 96;
  for (let n = 0; n < SO_COUNT; n++) {
    const soId = uid('so', n);
    const customerIdx = between(0, customers.length - 1);
    const customer = customers[customerIdx];
    const interState = customer.state !== HOME_STATE;
    const orderDay = SPAN_DAYS - Math.floor((n / SO_COUNT) * (SPAN_DAYS - 6)) - between(0, 3);

    const chosen = new Set<number>();
    const lineCount = between(2, 6);
    let guard = 0;
    while (chosen.size < lineCount && guard++ < 60) {
      const pi = between(0, products.length - 1);
      if ((sellable.get(products[pi].id) ?? 0) >= 6) chosen.add(pi);
    }
    if (chosen.size === 0) continue;

    const lines = [...chosen].map((pi) => {
      const p = products[pi];
      const available = sellable.get(p.id) ?? 0;
      const qty = Math.max(1, Math.min(between(3, 45), Math.floor(available * 0.25)));
      sellable.set(p.id, available - qty);
      return { p, l: line(qty, p.price, p.gst, pick([0, 0, 0, 2.5, 5]), interState) };
    }).filter((x) => x.l.qty > 0);
    if (lines.length === 0) continue;

    const subtotal = sum(lines.map(({ l }) => l.taxable));
    const taxTotal = sum(lines.map(({ l }) => l.tax));
    const discountTotal = sum(lines.map(({ l }) => l.discount));
    const total = r2(subtotal + taxTotal);

    const invoiced = orderDay > 10;
    const deliveryDay = orderDay - between(4, 18);

    salesOrders.push({
      id: soId, company_id: COMPANY_ID, created_by: owner,
      order_number: `SO-${String(5200 + n)}`, customer_id: customer.id,
      order_date: daysAgo(orderDay),
      delivery_date: daysAgo(deliveryDay), expected_delivery_date: daysAgo(deliveryDay),
      status: invoiced ? 'closed' : pick(['confirmed', 'confirmed', 'draft']),
      order_type: 'standard', currency: 'INR',
      customer_po_number: `${customer.name.slice(0, 3).toUpperCase()}-PO-${between(1000, 9999)}`,
      customer_reference_no: `REF-${between(100000, 999999)}`,
      payment_terms: customer.paymentTerms, account_manager: 'Demo Owner',
      mode_of_transport: pick(['Road', 'Road', 'Rail', 'Courier']),
      subtotal_amount: subtotal, tax_amount: taxTotal,
      discount_amount: discountTotal, total_amount: total,
      billing_address_line1: customer.address, billing_city: customer.city,
      billing_state: customer.state, billing_pin_code: customer.pin, billing_country: 'India',
      delivery_address_line1: customer.address, delivery_city: customer.city,
      delivery_state: customer.state, delivery_pin_code: customer.pin, delivery_country: 'India',
      same_as_registered_address: true,
      default_warehouse_id: mainBin, default_bin_id: mainBin,
      shipping_instructions: pick(['Deliver between 09:00 and 17:00', 'Call site contact before despatch', null]),
      created_at: isoAt(orderDay), updated_at: isoAt(orderDay),
    });

    lines.forEach(({ p, l }, li) => {
      soItems.push({
        id: uid('soitem', n, li), sales_order_id: soId, product_id: p.id, line_no: li + 1,
        item_description: p.name, unit_of_measure: p.unit,
        quantity: l.qty, ordered_quantity: l.qty, back_order_quantity: 0,
        unit_price: l.unitPrice, total_price: l.total, net_amount: l.taxable,
        discount_percentage: l.discountPct, discount_amount: l.discount,
        tax_percentage: l.gstRate, hsn_sac_code: p.hsn,
        cgst_rate: l.cgstRate, cgst_amount: l.cgst,
        sgst_rate: l.sgstRate, sgst_amount: l.sgst,
        igst_rate: l.igstRate, igst_amount: l.igst,
        warehouse_id: mainBin, bin_id: mainBin,
      });
    });

    if (!invoiced) continue;

    const invId = uid('inv', n);
    const invDay = Math.max(1, deliveryDay - between(0, 3));
    const invNumber = `INV-${String(7100 + n)}`;
    invoices.push({
      id: invId, company_id: COMPANY_ID, created_by: owner,
      invoice_number: null, sales_order_id: soId,
      customer_id: customer.id, customer_name: customer.name,
      invoice_date: daysAgo(invDay),
      due_date: daysAgo(invDay - customer.creditDays),
      status: 'draft',
      currency: 'INR', payment_terms: customer.paymentTerms,
      customer_po_reference: `${customer.name.slice(0, 3).toUpperCase()}-PO-${between(1000, 9999)}`,
      subtotal_amount: subtotal, tax_amount: taxTotal,
      discount_amount: discountTotal, total_amount: total,
      freight_charges: 0, packing_charges: 0, round_off: 0,
      billing_address_line1: customer.address, billing_city: customer.city,
      billing_state: customer.state, billing_pin_code: customer.pin, billing_country: 'India',
      same_as_billing_address: true,
      shipping_address_line1: customer.address, shipping_city: customer.city,
      shipping_state: customer.state, shipping_pin_code: customer.pin, shipping_country: 'India',
      default_warehouse_id: mainBin, default_bin_id: mainBin,
      account_manager: 'Demo Owner', transporter: pick(['VRL Logistics', 'TCI Express', 'Safexpress']),
      mode_of_delivery: 'Road', delivery_note_number: `DN-${between(10000, 99999)}`,
      created_at: isoAt(invDay), updated_at: isoAt(invDay),
    });

    const items: InvoiceItemRow[] = lines.map(({ p, l }, li) => ({
      id: uid('invitem', n, li), sales_invoice_id: invId, product_id: p.id,
      item_code: p.sku, item_description: p.name, unit_of_measure: p.unit,
      quantity_ordered: l.qty, quantity_invoiced: l.qty, backorder_quantity: 0,
      unit_price: l.unitPrice, line_subtotal: l.taxable, line_total: l.total,
      discount_percentage: l.discountPct, discount_amount: l.discount,
      tax_amount: l.tax, hsn_sac_code: p.hsn,
      cgst_rate: l.cgstRate, cgst_amount: l.cgst,
      sgst_rate: l.sgstRate, sgst_amount: l.sgst,
      igst_rate: l.igstRate, igst_amount: l.igst,
      warehouse_id: mainBin, bin_id: mainBin,
    }));
    invoiceItems.push(...items);
    invoiceIndex.push({ id: invId, customerIdx, day: invDay, total, items, number: invNumber });
  }

  await insert(db, 'sales_orders', salesOrders);
  await insert(db, 'sales_order_items', soItems);
  await insert(db, 'sales_invoices', invoices);
  await insert(db, 'sales_invoice_items', invoiceItems);
  console.log(`  ${salesOrders.length} sales orders, ${invoices.length} invoices drafted`);

  // Finalize: an UPDATE is what fires auto_generate_invoice_number and
  // handle_sales_invoice_status_change. Inserting them finalized does neither.
  console.log('  finalizing invoices');
  for (const inv of invoiceIndex) {
    const { error } = await db
      .from('sales_invoices')
      .update({ status: 'finalized', invoice_number: inv.number })
      .eq('id', inv.id);
    if (error) throw new Error(`finalize ${inv.number}: ${error.message}`);
  }

  // --- did the stock issue actually happen? -------------------------------
  // process_sales_invoice passes NULL for warehouse_id, but
  // inventory_transactions.warehouse_id is NOT NULL, so the whole item loop
  // can roll back inside its own exception block and the trigger only raises
  // a warning. Check rather than assume, and fill the gap if it is real.
  const { count: issueCount } = await db
    .from('inventory_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('company_id', COMPANY_ID)
    .eq('transaction_type', 'sales_invoice');

  if ((issueCount ?? 0) === 0 && invoiceIndex.length > 0) {
    console.log('  sales issue trigger recorded nothing, writing issues directly');
    const issues: Row[] = [];
    const consumed = new Map<string, number>();
    for (const inv of invoiceIndex) {
      for (const item of inv.items) {
        issues.push({
          id: uid('itx', inv.id, item.product_id),
          company_id: COMPANY_ID, created_by: owner,
          transaction_type: 'sales_invoice',
          reference_id: inv.id, reference_number: inv.number,
          product_id: item.product_id, warehouse_id: mainBin, bin_id: mainBin,
          quantity_change: -item.quantity_invoiced,
          unit_cost: item.unit_price,
          total_value: r2(-item.quantity_invoiced * item.unit_price),
          transaction_date: isoAt(inv.day),
          notes: `Sales Invoice - ${inv.number}`,
        });
        consumed.set(item.product_id, (consumed.get(item.product_id) ?? 0) + item.quantity_invoiced);
      }
    }
    await insert(db, 'inventory_transactions', issues);

    const { data: current } = await db
      .from('products').select('id, stock_quantity').eq('company_id', COMPANY_ID);
    for (const row of current ?? []) {
      const out = consumed.get(row.id) ?? 0;
      if (out === 0) continue;
      await db.from('products')
        .update({ stock_quantity: Math.max(0, (row.stock_quantity ?? 0) - out) })
        .eq('id', row.id);
    }
  }

  // =========================================================================
  // Payments, against both sales invoices and purchase receipts
  // =========================================================================
  console.log('payments');
  const payments: Row[] = [];
  for (const inv of invoiceIndex) {
    if (rand() < 0.18) continue; // leave a genuine receivables ageing tail
    const partial = rand() < 0.15;
    const amount = partial ? r2(inv.total * (0.4 + rand() * 0.3)) : inv.total;
    const payDay = Math.max(0, inv.day - between(5, 40));
    payments.push({
      id: uid('payment', 'in', inv.id), company_id: COMPANY_ID, created_by: owner,
      sales_invoice_id: inv.id, amount, payment_date: daysAgo(payDay),
      payment_method: pick(PAYMENT_METHODS), payment_type: 'receipt',
      payment_status: 'completed',
      reference_number: `RCPT-${between(100000, 999999)}`,
      notes: partial ? 'Part payment against invoice' : null,
      created_at: isoAt(payDay), updated_at: isoAt(payDay),
    });
  }
  for (const receipt of poReceipts) {
    if (rand() < 0.25) continue;
    const payDay = Math.max(0, receipt.day - between(5, 35));
    payments.push({
      id: uid('payment', 'out', receipt.poId), company_id: COMPANY_ID, created_by: owner,
      purchase_order_id: receipt.poId, amount: receipt.total, payment_date: daysAgo(payDay),
      payment_method: pick(PAYMENT_METHODS), payment_type: 'payment',
      payment_status: 'completed',
      reference_number: `PAY-${between(100000, 999999)}`,
      created_at: isoAt(payDay), updated_at: isoAt(payDay),
    });
  }
  await insert(db, 'payments', payments);
  console.log(`  ${payments.length} payments`);

  // =========================================================================
  // Returns and credit notes, against a handful of settled invoices
  // =========================================================================
  console.log('returns and credit notes');
  const rsoHeaders: Row[] = [];
  const rsoLines: Row[] = [];
  const creditNotes: Row[] = [];
  const cnItems: Row[] = [];

  const returnable = invoiceIndex.filter((i) => i.day > 20).slice(0, 9);
  returnable.forEach((inv, n) => {
    const customer = customers[inv.customerIdx];
    const interState = customer.state !== HOME_STATE;
    const rsoId = uid('rso', n);
    const rsoDay = Math.max(2, inv.day - between(6, 20));
    const returnedItems = inv.items.slice(0, between(1, Math.min(2, inv.items.length)));

    const built = returnedItems.map((item) => {
      const product = products.find((p) => p.id === item.product_id)!;
      const returnQty = Math.max(1, Math.floor(item.quantity_invoiced * (0.15 + rand() * 0.25)));
      return { item, product, returnQty, l: line(returnQty, item.unit_price, product.gst, 0, interState) };
    });

    const subtotal = sum(built.map((b) => b.l.taxable));
    const tax = sum(built.map((b) => b.l.tax));
    const total = r2(subtotal + tax);

    rsoHeaders.push({
      id: rsoId, company_id: COMPANY_ID, created_by: owner,
      rso_number: `RSO-${String(200 + n)}`,
      customer_id: customer.id, customer_name: customer.name,
      invoice_id: inv.id, invoice_number: inv.number, invoice_date: daysAgo(inv.day),
      rso_date: daysAgo(rsoDay), status: 'confirmed',
      reason_for_credit: pick(RETURN_REASONS),
      subtotal_amount: subtotal, tax_amount: tax, total_amount: total,
      delivery_same_as_company: true,
      delivery_address_line1: 'Plot 22, Peenya Industrial Area Phase II',
      delivery_city: 'Bengaluru', delivery_pin_code: '560058', delivery_country: 'India',
      notes: 'Goods collected and inspected at the Bengaluru store',
      created_at: isoAt(rsoDay), updated_at: isoAt(rsoDay),
    });

    built.forEach((b, li) => {
      rsoLines.push({
        id: uid('rsoline', n, li), return_order_id: rsoId, product_id: b.product.id,
        product_name: b.product.name, product_sku: b.product.sku, unit_of_measure: b.product.unit,
        invoice_qty: b.item.quantity_invoiced, return_qty: b.returnQty, pending_return_qty: 0,
        unit_price: b.l.unitPrice, line_subtotal: b.l.taxable, line_total: b.l.total,
        tax_amount: b.l.tax, hsn_sac_code: b.product.hsn,
        cgst_rate: b.l.cgstRate, cgst_amount: b.l.cgst,
        sgst_rate: b.l.sgstRate, sgst_amount: b.l.sgst,
        igst_rate: b.l.igstRate, igst_amount: b.l.igst,
      });
    });

    const cnId = uid('cn', n);
    const cnDay = Math.max(1, rsoDay - between(1, 5));
    creditNotes.push({
      id: cnId, company_id: COMPANY_ID, created_by: owner,
      cn_number: `CN-${String(300 + n)}`, cn_date: daysAgo(cnDay),
      rso_id: rsoId, customer_id: customer.id, customer_name: customer.name,
      default_warehouse_id: mainBin, status: 'draft',
      subtotal_amount: subtotal, tax_amount: tax, total_amount: total,
      notes: `Credit against RSO-${String(200 + n)}`,
      created_at: isoAt(cnDay), updated_at: isoAt(cnDay),
    });

    built.forEach((b, li) => {
      cnItems.push({
        id: uid('cnitem', n, li), credit_note_id: cnId, product_id: b.product.id,
        product_name: b.product.name, product_sku: b.product.sku, unit_of_measure: b.product.unit,
        rso_qty: b.returnQty, return_qty: b.returnQty, pending_return_qty: 0,
        unit_price: b.l.unitPrice, line_subtotal: b.l.taxable, line_total: b.l.total,
        tax_amount: b.l.tax, hsn_sac_code: b.product.hsn,
        cgst_rate: b.l.cgstRate, cgst_amount: b.l.cgst,
        sgst_rate: b.l.sgstRate, sgst_amount: b.l.sgst,
        igst_rate: b.l.igstRate, igst_amount: b.l.igst,
        warehouse_id: mainBin, bin_id: mainBin,
      });
    });
  });

  await insert(db, 'return_order_header', rsoHeaders);
  await insert(db, 'return_order_lines', rsoLines);
  await insert(db, 'credit_notes', creditNotes);
  await insert(db, 'credit_note_items', cnItems);
  console.log(`  ${rsoHeaders.length} return orders, ${creditNotes.length} credit notes`);

  // =========================================================================
  // Stock adjustments, so the inventory ledger is not purely receipts/issues
  // =========================================================================
  console.log('stock adjustments');
  const adjustments: Row[] = [];
  const adjustmentTx: Row[] = [];
  for (let n = 0; n < 12; n++) {
    const p = products[between(0, products.length - 1)];
    const day = between(4, SPAN_DAYS - 10);
    const positive = rand() < 0.4;
    const qty = between(1, 8);
    const adjId = uid('adjust', n);
    adjustments.push({
      id: adjId, company_id: COMPANY_ID, created_by: owner, product_id: p.id,
      warehouse_id: mainBin,
      adjustment_type: positive ? 'increase' : 'decrease',
      adjustment_quantity: positive ? qty : -qty,
      adjustment_amount: r2((positive ? qty : -qty) * p.cost),
      reason: positive
        ? pick(['Cycle count surplus', 'Return to stock from site'])
        : pick(['Damaged during handling', 'Cycle count shortfall', 'Sample issued']),
      remarks: `Adjusted at ${daysAgo(day)}`,
      created_at: isoAt(day), updated_at: isoAt(day),
    });
    adjustmentTx.push({
      id: uid('adjusttx', n), company_id: COMPANY_ID, created_by: owner,
      transaction_type: positive ? 'adjustment_positive' : 'adjustment_negative',
      reference_id: adjId, reference_number: `ADJ-${String(900 + n)}`,
      product_id: p.id, warehouse_id: mainBin, bin_id: mainBin,
      quantity_change: positive ? qty : -qty,
      unit_cost: p.cost, total_value: r2((positive ? qty : -qty) * p.cost),
      transaction_date: isoAt(day), notes: 'Stock adjustment',
    });
  }
  const { error: adjError } = await db.from('inventory_adjustments').insert(adjustments);
  if (adjError) console.warn(`  inventory_adjustments skipped: ${adjError.message}`);
  else await insert(db, 'inventory_transactions', adjustmentTx);

  // =========================================================================
  // Verify what actually landed
  // =========================================================================
  console.log('\nseeded:');
  const tables = [
    'products', 'customers', 'suppliers', 'warehouse_bins',
    'purchase_orders', 'grn_header', 'sales_orders', 'sales_invoices',
    'payments', 'return_order_header', 'credit_notes', 'inventory_transactions',
  ];
  for (const t of tables) {
    console.log(`  ${t.padEnd(22)} ${await countRows(db, t)}`);
  }

  const { data: stock } = await db
    .from('products')
    .select('sku, name, stock_quantity')
    .eq('company_id', COMPANY_ID)
    .order('stock_quantity', { ascending: false })
    .limit(5);
  console.log('\ntop stock:');
  for (const row of stock ?? []) {
    console.log(`  ${String(row.sku).padEnd(18)} ${String(row.stock_quantity).padStart(6)}  ${row.name}`);
  }

  const { data: negative } = await db
    .from('products')
    .select('sku, stock_quantity')
    .eq('company_id', COMPANY_ID)
    .lt('stock_quantity', 0);
  if (negative?.length) {
    console.warn(`\nwarning: ${negative.length} products hold negative stock`);
  }

  console.log(`\ncompany_id ${COMPANY_ID}`);
  console.log(`sign in at /auth as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main().catch((error) => {
  console.error(`\nseed failed: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
