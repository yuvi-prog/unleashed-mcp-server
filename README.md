# Unleashed MCP Server

A remote MCP (Model Context Protocol) server that exposes Unleashed Software
inventory, sales, and purchasing data as tools Claude can call. Runs as a
Streamable HTTP server (not stdio), so it can be added to Claude as a custom
connector via URL and shared by multiple coworkers.

## What it exposes

Read-only tools covering:

- **Products** — `list_products`, `get_product`
- **Stock on hand** — `list_stock_on_hand` (by product/warehouse)
- **Warehouses** — `list_warehouses`
- **Sales orders** — `list_sales_orders`, `get_sales_order` (with line items), `list_sales_order_lines_by_product`
- **Purchase orders** — `list_purchase_orders`, `get_purchase_order` (with line items)
- **Customers** — `list_customers`, `get_customer`
- **Suppliers** — `list_suppliers`, `get_supplier`
- **Stock adjustments** — `list_stock_adjustments`
- **Stock transfers** — `list_stock_transfers`
- **Product groups** — `list_product_groups`
- **Credit notes** — `list_credit_notes` (returns/refunds)
- **Assemblies** — `list_assemblies` (manufacturing/bill-of-materials builds)
- **Sales shipments** — `list_sales_shipments` (dispatch/tracking, distinct from order status)
- **Sales invoices** — `list_sales_invoices` (billing/revenue)
- **Stock counts** — `list_stock_counts` (stocktakes/cycle counts)
- **Recost adjustments** — `list_recost_adjustments` (retrospective landed-cost corrections)

All tools are read-only (GET requests against the Unleashed API). No
write/create/update actions are included.

## Project structure

```
unleashed-mcp-server/
├── src/
│   ├── server.ts          # Express + Streamable HTTP MCP transport
│   ├── tools.ts            # MCP tool definitions (schemas + handlers)
│   └── unleashedClient.ts  # Unleashed REST client with HMAC-SHA256 signing
├── package.json
├── tsconfig.json
├── railway.json
├── .env.example
└── README.md
```

## Local setup

```bash
npm install
cp .env.example .env
# edit .env and set UNLEASHED_API_ID / UNLEASHED_API_KEY
npm run dev
```

The server listens on `http://localhost:3000/mcp` (Streamable HTTP endpoint)
and `http://localhost:3000/health` (health check).

To run a production build locally:

```bash
npm run build
npm start
```

## Environment variables

| Variable            | Required | Description                                                        |
|---------------------|----------|----------------------------------------------------------------------|
| `UNLEASHED_API_ID`   | Yes      | Your Unleashed API ID (Unleashed → Integration → API Access)        |
| `UNLEASHED_API_KEY`  | Yes      | Your Unleashed API Key. **Never commit this.**                      |
| `PORT`               | No       | Port to listen on. Railway sets this automatically. Defaults to 3000.|

This is a single shared API key/ID pair for the whole server — every
coworker who connects their own Claude account to this server's URL will
query Unleashed under the same credentials. There is no per-user auth.

## Deploying to Railway

1. Push this project to a GitHub repo (or use `railway up` from this
   directory with the Railway CLI).
2. In Railway, create a new project from that repo. Railway will detect
   `railway.json` and use Nixpacks to run `npm run build` then `npm start`.
3. In the Railway project's **Variables** tab, set:
   - `UNLEASHED_API_ID`
   - `UNLEASHED_API_KEY`
   
   Do not set `PORT` — Railway injects it automatically and the server reads
   `process.env.PORT`.
4. Deploy. Once live, Railway gives you a public URL like
   `https://unleashed-mcp-server-production.up.railway.app`.
5. (Recommended) Enable a custom domain or just use the Railway-provided
   domain — either works for the connector URL below.

## Connecting to Claude

Once deployed, in Claude go to **Settings → Connectors → Add custom
connector** and enter:

```
https://<your-railway-domain>/mcp
```

for example:

```
https://unleashed-mcp-server-production.up.railway.app/mcp
```

Any coworker who adds that same URL as a custom connector in their own
Claude account will get access to the same tools, backed by the same
Unleashed account (via the shared API credentials configured on the
server).

## Notes on the Unleashed API integration

- **Auth**: Every request signs its query string (not including the `?`)
  with HMAC-SHA256 using the API Key as the HMAC key, base64-encodes the
  result, and sends it as the `api-auth-signature` header alongside
  `api-auth-id`. When a request has no query parameters, the signature is
  computed over an empty string.
- **Pagination**: List endpoints use `/{Resource}/{pageNumber}?pageSize=N`.
  Page size defaults to 200 (Unleashed's standard default) and can be up to
  1000. Tools default `page=1`, `pageSize=200` and accept overrides.
- **Base URL**: `https://api.unleashedsoftware.com`

## Adding write actions later

The `tools.ts` registry is a flat list of `{ name, description, inputShape,
handler }` objects, each calling `unleashedGet` in `unleashedClient.ts`. To
add a write action later, add an `unleashedPost`/`unleashedPut` helper to
`unleashedClient.ts` (Unleashed's signing scheme is the same for
POST/PUT — it still signs the query string, with the body sent separately)
and register a new tool.
