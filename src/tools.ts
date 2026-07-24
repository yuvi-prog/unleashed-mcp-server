import { z } from "zod";
import { unleashedGet } from "./unleashedClient.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const pageArgs = {
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number to retrieve (1-based). Defaults to 1."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(1000)
    .default(200)
    .describe(
      "Number of records per page (1-1000). Defaults to 200, Unleashed's standard page size."
    ),
};

function textResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

async function listEndpoint(
  resource: string,
  page: number,
  pageSize: number,
  extraQuery: Record<string, string | number | undefined> = {}
) {
  const data = await unleashedGet(`${resource}/${page}`, {
    pageSize,
    ...extraQuery,
  });
  return textResult(data);
}

// ---------------------------------------------------------------------------
// Tool registry: each entry has a name, description, zod input shape, and handler.
// ---------------------------------------------------------------------------

export interface ToolDef {
  name: string;
  description: string;
  inputShape: z.ZodRawShape;
  handler: (args: any) => Promise<ReturnType<typeof textResult>>;
}

export const tools: ToolDef[] = [
  // -------------------------------------------------------------------
  // Products
  // -------------------------------------------------------------------
  {
    name: "list_products",
    description:
      "List products in the Unleashed inventory catalog. Supports free-text search and pagination. Use this to browse or search the product catalog by code, description, or other product fields.",
    inputShape: {
      ...pageArgs,
      productCode: z
        .string()
        .optional()
        .describe("Filter to an exact product code."),
      search: z
        .string()
        .optional()
        .describe(
          "Free-text search term matched against product code and description."
        ),
    },
    handler: async ({ page, pageSize, productCode, search }) =>
      listEndpoint("Products", page, pageSize, {
        productCode,
        productDescription: search,
      }),
  },
  {
    name: "get_product",
    description:
      "Get full details for a single product by its exact Unleashed product Guid or product code.",
    inputShape: {
      guidOrCode: z
        .string()
        .describe("The product's Guid (preferred) or exact product code."),
    },
    handler: async ({ guidOrCode }) =>
      textResult(await unleashedGet(`Products/${encodeURIComponent(guidOrCode)}`)),
  },

  // -------------------------------------------------------------------
  // Stock on hand
  // -------------------------------------------------------------------
  {
    name: "list_stock_on_hand",
    description:
      "Get current stock-on-hand levels, optionally filtered by product code and/or warehouse. Returns quantity available, allocated, and on order for each product/warehouse combination. Use this to answer 'how much stock do we have' questions.",
    inputShape: {
      ...pageArgs,
      productCode: z
        .string()
        .optional()
        .describe("Filter to a specific product code."),
      warehouseCode: z
        .string()
        .optional()
        .describe("Filter to a specific warehouse code."),
    },
    handler: async ({ page, pageSize, productCode, warehouseCode }) =>
      listEndpoint("StockOnHand", page, pageSize, {
        productCode,
        warehouseCode,
      }),
  },

  // -------------------------------------------------------------------
  // Warehouses
  // -------------------------------------------------------------------
  {
    name: "list_warehouses",
    description:
      "List all warehouses configured in Unleashed, including warehouse codes used to filter stock and order queries.",
    inputShape: {},
    handler: async () => textResult(await unleashedGet("Warehouses")),
  },

  // -------------------------------------------------------------------
  // Sales Orders
  // -------------------------------------------------------------------
  {
    name: "list_sales_orders",
    description:
      "List sales orders, optionally filtered by customer code, order status, or order date range. Use this to answer questions about sales activity, order volume, or what's been sold to a customer over a period.",
    inputShape: {
      ...pageArgs,
      customerCode: z
        .string()
        .optional()
        .describe("Filter to a specific customer code."),
      orderStatus: z
        .string()
        .optional()
        .describe(
          "Filter by order status, e.g. Open, Parked, Placed, Backordered, Completed, Deleted."
        ),
      startDate: z
        .string()
        .optional()
        .describe("Only include orders on/after this date (YYYY-MM-DD)."),
      endDate: z
        .string()
        .optional()
        .describe("Only include orders on/before this date (YYYY-MM-DD)."),
    },
    handler: async ({ page, pageSize, customerCode, orderStatus, startDate, endDate }) =>
      listEndpoint("SalesOrders", page, pageSize, {
        customerCode,
        orderStatus,
        startDate,
        endDate,
      }),
  },
  {
    name: "get_sales_order",
    description:
      "Get full details of a single sales order by its Guid or order number, including all line items (products, quantities, prices).",
    inputShape: {
      guidOrOrderNumber: z
        .string()
        .describe("The sales order's Guid or exact order number."),
    },
    handler: async ({ guidOrOrderNumber }) =>
      textResult(
        await unleashedGet(`SalesOrders/${encodeURIComponent(guidOrOrderNumber)}`)
      ),
  },

  // -------------------------------------------------------------------
  // Purchase Orders
  // -------------------------------------------------------------------
  {
    name: "list_purchase_orders",
    description:
      "List purchase orders, optionally filtered by supplier code, order status, or order date range. Use this to answer questions about purchasing activity or what's on order from a supplier.",
    inputShape: {
      ...pageArgs,
      supplierCode: z
        .string()
        .optional()
        .describe("Filter to a specific supplier code."),
      orderStatus: z
        .string()
        .optional()
        .describe(
          "Filter by order status, e.g. Open, Parked, Placed, Sent, Complete, Deleted."
        ),
      startDate: z
        .string()
        .optional()
        .describe("Only include orders on/after this date (YYYY-MM-DD)."),
      endDate: z
        .string()
        .optional()
        .describe("Only include orders on/before this date (YYYY-MM-DD)."),
    },
    handler: async ({ page, pageSize, supplierCode, orderStatus, startDate, endDate }) =>
      listEndpoint("PurchaseOrders", page, pageSize, {
        supplierCode,
        orderStatus,
        startDate,
        endDate,
      }),
  },
  {
    name: "get_purchase_order",
    description:
      "Get full details of a single purchase order by its Guid or order number, including all line items (products, quantities, costs).",
    inputShape: {
      guidOrOrderNumber: z
        .string()
        .describe("The purchase order's Guid or exact order number."),
    },
    handler: async ({ guidOrOrderNumber }) =>
      textResult(
        await unleashedGet(`PurchaseOrders/${encodeURIComponent(guidOrOrderNumber)}`)
      ),
  },

  // -------------------------------------------------------------------
  // Customers
  // -------------------------------------------------------------------
  {
    name: "list_customers",
    description:
      "List customers, optionally filtered by customer code or free-text search on customer name.",
    inputShape: {
      ...pageArgs,
      search: z
        .string()
        .optional()
        .describe("Free-text search matched against customer name/code."),
    },
    handler: async ({ page, pageSize, search }) =>
      listEndpoint("Customers", page, pageSize, { customerCode: search }),
  },
  {
    name: "get_customer",
    description:
      "Get full details for a single customer by Guid or exact customer code, including contact info, payment terms, and price tier.",
    inputShape: {
      guidOrCode: z.string().describe("The customer's Guid or exact customer code."),
    },
    handler: async ({ guidOrCode }) =>
      textResult(await unleashedGet(`Customers/${encodeURIComponent(guidOrCode)}`)),
  },

  // -------------------------------------------------------------------
  // Suppliers
  // -------------------------------------------------------------------
  {
    name: "list_suppliers",
    description:
      "List suppliers, optionally filtered by supplier code or free-text search on supplier name.",
    inputShape: {
      ...pageArgs,
      search: z
        .string()
        .optional()
        .describe("Free-text search matched against supplier name/code."),
    },
    handler: async ({ page, pageSize, search }) =>
      listEndpoint("Suppliers", page, pageSize, { supplierCode: search }),
  },
  {
    name: "get_supplier",
    description:
      "Get full details for a single supplier by Guid or exact supplier code, including contact info and payment terms.",
    inputShape: {
      guidOrCode: z.string().describe("The supplier's Guid or exact supplier code."),
    },
    handler: async ({ guidOrCode }) =>
      textResult(await unleashedGet(`Suppliers/${encodeURIComponent(guidOrCode)}`)),
  },

  // -------------------------------------------------------------------
  // Stock adjustments / movements
  // -------------------------------------------------------------------
  {
    name: "list_stock_adjustments",
    description:
      "List stock adjustments (manual stock movements/corrections), optionally filtered by warehouse or date range. Use this to investigate stock discrepancies or manual corrections, as distinct from sales/purchase order driven stock changes.",
    inputShape: {
      ...pageArgs,
      warehouseCode: z
        .string()
        .optional()
        .describe("Filter to a specific warehouse code."),
      startDate: z
        .string()
        .optional()
        .describe("Only include adjustments on/after this date (YYYY-MM-DD)."),
      endDate: z
        .string()
        .optional()
        .describe("Only include adjustments on/before this date (YYYY-MM-DD)."),
    },
    handler: async ({ page, pageSize, warehouseCode, startDate, endDate }) =>
      listEndpoint("StockAdjustments", page, pageSize, {
        warehouseCode,
        startDate,
        endDate,
      }),
  },

  // -------------------------------------------------------------------
  // Sales/Purchase Order line-item search (StockOnHand-style enquiry endpoints)
  // -------------------------------------------------------------------
  {
    name: "list_sales_order_lines_by_product",
    description:
      "Search sales order line items across orders by product code, optionally within a date range. Useful for answering 'how much of product X has been sold, and to whom' without pulling full order objects.",
    inputShape: {
      ...pageArgs,
      productCode: z.string().describe("The product code to search for in order lines."),
      startDate: z
        .string()
        .optional()
        .describe("Only include lines from orders on/after this date (YYYY-MM-DD)."),
      endDate: z
        .string()
        .optional()
        .describe("Only include lines from orders on/before this date (YYYY-MM-DD)."),
    },
    handler: async ({ page, pageSize, productCode, startDate, endDate }) =>
      listEndpoint("SalesOrders", page, pageSize, {
        productCode,
        startDate,
        endDate,
      }),
  },

  // -------------------------------------------------------------------
  // Stock transfers
  // -------------------------------------------------------------------
  {
    name: "list_stock_transfers",
    description:
      "List stock transfers between warehouses, optionally filtered by date range. Use this to see inventory movement between locations.",
    inputShape: {
      ...pageArgs,
      startDate: z
        .string()
        .optional()
        .describe("Only include transfers on/after this date (YYYY-MM-DD)."),
      endDate: z
        .string()
        .optional()
        .describe("Only include transfers on/before this date (YYYY-MM-DD)."),
    },
    handler: async ({ page, pageSize, startDate, endDate }) =>
      listEndpoint("StockTransfers", page, pageSize, { startDate, endDate }),
  },

  // -------------------------------------------------------------------
  // Product groups / categories (helps segment product questions)
  // -------------------------------------------------------------------
  {
    name: "list_product_groups",
    description:
      "List product groups (categories) configured in Unleashed. Useful for understanding how products are segmented before filtering other queries.",
    inputShape: {},
    handler: async () => textResult(await unleashedGet("ProductGroups")),
  },
];
