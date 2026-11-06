// Builds the aggregated CSV files in data/ from the private scan file.
// The scan file holds store domains and isn't published. This script writes totals only.
// Usage: node build-dataset.mjs <scan.jsonl> <output-dir>
import fs from 'node:fs';
import path from 'node:path';

const [scanPath, outDir] = process.argv.slice(2);
if (!scanPath || !outDir) {
  console.error('Usage: node build-dataset.mjs <scan.jsonl> <output-dir>');
  process.exit(1);
}

const rows = fs
  .readFileSync(scanPath, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const PAGE_EVENT = { meta: 'PageView', ga4: 'page_view', tiktok: 'Pageview' };
const VIEW_EVENT = { meta: 'ViewContent', ga4: 'view_item', tiktok: 'ViewContent' };
const PLATFORMS = ['ga4', 'tiktok', 'meta'];
const TOOLS = ['triplewhale', 'elevar', 'northbeam', 'hyros'];

const parseCounts = (counts) =>
  Object.entries(counts || {}).map(([key, n]) => {
    const [platform, id, event] = key.split('|');
    return { platform, id, event, n };
  });

const stores = [];
for (const row of rows) {
  if (row.error || !row.home || row.home.error) continue;
  if (!(row.home.status >= 200 && row.home.status < 400)) continue;
  const home = parseCounts(row.home.counts);
  const product = row.product && !row.product.error ? parseCounts(row.product.counts) : null;
  const store = {
    tools: new Set([...(row.home.tools || []), ...(row.product?.tools || [])]),
    hasProduct: Boolean(product),
    duplicates: [],
    platforms: {},
    missing: null,
    idCount: {},
  };
  for (const p of PLATFORMS) {
    const all = [...home, ...(product || [])].filter((e) => e.platform === p);
    if (!all.length) continue;
    store.idCount[p] = new Set(all.map((e) => e.id)).size;
    const duplicates = [
      ...home.filter((e) => e.platform === p && e.event === PAGE_EVENT[p] && e.n >= 2),
      ...(product || []).filter(
        (e) => e.platform === p && (e.event === PAGE_EVENT[p] || e.event === VIEW_EVENT[p]) && e.n >= 2,
      ),
    ];
    let missing = null;
    if (product?.some((e) => e.platform === p && e.event === PAGE_EVENT[p])) {
      missing = !product.some((e) => e.platform === p && e.event === VIEW_EVENT[p]);
    }
    store.platforms[p] = { duplicate: duplicates.length > 0, missing };
    store.duplicates.push(...duplicates);
    if (missing !== null) store.missing = store.missing || missing;
  }
  stores.push(store);
}

const count = (list, test) => list.filter(test).length;
const share = (a, b) => (b ? ((a / b) * 100).toFixed(1) : '');
const visible = stores.filter((s) => Object.keys(s.platforms).length > 0);
const checked = visible.filter((s) => s.missing !== null);
const withDuplicate = count(visible, (s) => s.duplicates.length > 0);

const toCsv = (header, lines) =>
  [header, ...lines]
    .map((cols) =>
      cols.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : c)).join(','),
    )
    .join('\n') + '\n';

const summaryRow = (metric, a, b) => [metric, a, b, share(a, b)];
const summary = toCsv(
  ['metric', 'stores', 'out_of', 'share_pct'],
  [
    summaryRow('product_page_loaded', count(stores, (s) => s.hasProduct), stores.length),
    summaryRow('visible_events', visible.length, stores.length),
    summaryRow('any_duplicate_of_stores_with_visible_events', withDuplicate, visible.length),
    summaryRow('any_duplicate_of_all_loaded_stores', withDuplicate, stores.length),
    summaryRow('missing_product_view', count(checked, (s) => s.missing), checked.length),
  ],
);

const byPlatform = toCsv(
  [
    'platform',
    'stores_with_events',
    'stores_with_duplicate',
    'duplicate_share_pct',
    'stores_checked_for_product_view',
    'stores_missing_product_view',
    'missing_share_pct',
  ],
  PLATFORMS.map((p) => {
    const group = visible.filter((s) => s.platforms[p]);
    const dup = count(group, (s) => s.platforms[p].duplicate);
    const pChecked = group.filter((s) => s.platforms[p].missing !== null);
    const miss = count(pChecked, (s) => s.platforms[p].missing);
    return [p, group.length, dup, share(dup, group.length), pChecked.length, miss, share(miss, pChecked.length)];
  }),
);

const sizes = {};
for (const s of visible) for (const d of s.duplicates) sizes[d.n] = (sizes[d.n] || 0) + 1;
const repeatCounts = toCsv(
  ['times_sent', 'repeated_events'],
  Object.keys(sizes)
    .map(Number)
    .sort((a, b) => a - b)
    .map((n) => [n, sizes[n]]),
);

const ga4 = visible.filter((s) => s.platforms.ga4);
const idRow = (label, group) => {
  const dup = count(group, (s) => s.platforms.ga4.duplicate);
  return [label, group.length, dup, share(dup, group.length)];
};
const ga4Ids = toCsv(
  ['measurement_ids', 'stores', 'stores_with_duplicate', 'duplicate_share_pct'],
  [
    idRow('one', ga4.filter((s) => s.idCount.ga4 === 1)),
    idRow('more_than_one', ga4.filter((s) => s.idCount.ga4 > 1)),
  ],
);

const toolRow = (label, group) => {
  const dup = count(group, (s) => s.duplicates.length > 0);
  const c = group.filter((s) => s.missing !== null);
  const miss = count(c, (s) => s.missing);
  return [label, group.length, dup, share(dup, group.length), c.length, miss, share(miss, c.length)];
};
const hasTool = (s) => TOOLS.some((t) => s.tools.has(t));
const toolGroups = toCsv(
  [
    'requests_seen_to',
    'stores_with_events',
    'stores_with_duplicate',
    'duplicate_share_pct',
    'stores_checked_for_product_view',
    'stores_missing_product_view',
    'missing_share_pct',
  ],
  [
    // Hyros showed up on one store, so it gets no row of its own. It still counts in any_of_the_four.
    ...TOOLS.filter((t) => t !== 'hyros').map((t) => toolRow(t, visible.filter((s) => s.tools.has(t)))),
    toolRow('any_of_the_four', visible.filter(hasTool)),
    toolRow('none_of_the_four', visible.filter((s) => !hasTool(s))),
  ],
);

fs.mkdirSync(outDir, { recursive: true });
const files = {
  'summary.csv': summary,
  'by_platform.csv': byPlatform,
  'repeat_counts.csv': repeatCounts,
  'ga4_measurement_ids.csv': ga4Ids,
  'attribution_tool_requests.csv': toolGroups,
};
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(outDir, name), text);
console.log(`loaded ${stores.length}, wrote ${Object.keys(files).length} files`);
