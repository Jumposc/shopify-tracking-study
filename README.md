# Shopify tracking study: aggregated data

Totals from a scan of the browser tracking on 245 Shopify stores, run on October 25, 2026. It covers how often stores sent page view and product view events to GA4, Meta and TikTok more than once, or didn't send a product view at all.

The write-up, with more context, is here: [We checked tracking on 245 Shopify stores](https://tools.solvir.net/en/guides/shopify-tracking-study).

## Main numbers

| Measure | Stores | Share |
|---|---|---|
| Loaded successfully | 245 | |
| Sent visible Meta, GA4 or TikTok events | 195 of 245 | 79.6% |
| At least one duplicate event | 57 of 195 | 29.2% |
| Page view but no product view | 25 of 166 | 15.1% |

This is one visit per store, and the list isn't a random sample. Please read the limits below before citing these numbers.

## How the data was collected

We used a headless Chromium browser on a server in Japan, with a desktop user agent and English settings. Each store got a new browser session:

1. Load the home page and wait 10 seconds.
2. Load the first product in the store's public product feed and wait 10 seconds. This worked on 211 stores.
3. Record every request from the pages, their iframes and their workers.

We didn't click anything, add to cart, touch cookie banners or send any events.

**The sample.** 96 stores came from Meta's Ad Library and 149 from a hand-made list of well-known direct-to-consumer brands. Those counts come from the scan log. A later attempt to match stores back to the lists was unreliable, so the data files don't split results between them.

## Definitions

- **Duplicate:** the same platform, the same pixel or measurement ID, and the same page view or product view event, sent two or more times in one page load. Where Meta or TikTok sent an event ID, hits sharing that ID counted once. Our parser found no event ID on GA4 hits, so every GA4 repeat counted. The rules differ, so the platform rates aren't a ranking.
- **Missing product view:** on a product page, a platform received the page view but no product view (ViewContent or view_item).
- **Tool groups:** based only on requests seen to Triple Whale, Elevar, Northbeam or Hyros. A tool that runs only on a server wouldn't show up, so its store would count under `none_of_the_four`. That group can also include stores using other tools. Only one store showed requests to Hyros, so it has no row of its own and counts only in `any_of_the_four`.

## Files

| File | What it holds |
|---|---|
| `data/summary.csv` | Overall totals. `stores` out of `out_of`. |
| `data/by_platform.csv` | Duplicates and missing product views for GA4, TikTok and Meta. |
| `data/repeat_counts.csv` | How many times repeated events were sent. Counted per platform, ID, event and page. |
| `data/ga4_measurement_ids.csv` | GA4 duplicates by whether a store sent to one measurement ID or more than one. |
| `data/attribution_tool_requests.csv` | Duplicates and missing product views by tool seen in requests. Stores can appear in more than one row. |
| `scripts/build-dataset.mjs` | The script that produced these files from the private scan file. |

`share_pct` columns are percentages rounded to one decimal place. The write-up rounds to whole numbers.

## Limits

- **One visit per store.** Tags can behave differently between visits. One store that showed a duplicate in the scan didn't show it when we checked it again.
- **A headless browser in a data center in Japan.** Stores may treat that traffic differently through bot detection, or show different consent rules by region.
- **Browser requests only, for about 10 seconds a page.** Server-side events and anything firing later don't show up.
- **Requests sent, not events received.** We recorded what each page sent, not whether the platform accepted it.
- **No purchases.** We didn't add to cart or check out, so this says nothing about Purchase events.
- **Not a random sample.** The list leans toward larger brands and stores running Meta ads. These numbers don't describe all Shopify stores.
- **Not a test of any tool.** The tool groups are small, and stores using these tools may differ in size and setup.

50 of the 245 stores showed no events, and Meta appeared on only 51 stores even though 96 came from the Ad Library. We can't tell how much of that is server-side sending, consent, bot detection or timing, so `stores_with_events` doesn't tell you how many stores use a platform.

## What isn't here

Store names, domains, pixel IDs and store-level rows aren't published. This is a snapshot of one visit, not a judgment of any store. Because the scan file stays private, you can read the method in the script but can't rerun it on our data.

## Citing this data

Please link to the [write-up](https://tools.solvir.net/en/guides/shopify-tracking-study) and mention the sample and the single visit. `CITATION.cff` has the details.

## License

The data and documentation are under CC BY 4.0, and the script is under the MIT License. See `LICENSE.md`.

Maintained by Chen Xuanzhao at [Solvir Tools](https://tools.solvir.net). Solvir Tools earns affiliate commissions from some tools it covers. Of the four tools grouped in this data, Hyros pays us a commission, and Triple Whale, Elevar and Northbeam don't. They're included because they showed up in requests.
