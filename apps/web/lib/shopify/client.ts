import { SHOPIFY_ADMIN_API_VERSION } from "./config";

export type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
  onlineStoreUrl: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  sku: string | null;
  price: string;
};

export type ShopifyProductPage = {
  currencyCode: string;
  products: ShopifyProduct[];
  endCursor: string | null;
  hasNextPage: boolean;
};

const PRODUCTS_QUERY = `#graphql
  query PagevelopeProducts($first: Int!, $after: String) {
    shop { currencyCode }
    products(first: $first, after: $after, sortKey: UPDATED_AT) {
      nodes {
        id
        title
        handle
        updatedAt
        onlineStoreUrl
        featuredMedia { preview { image { url altText } } }
        variants(first: 1) { nodes { sku price } }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export async function fetchShopifyProductPage(
  shop: string,
  accessToken: string,
  after: string | null = null,
  first = 50,
): Promise<ShopifyProductPage> {
  const response = await fetch(`https://${shop}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
    },
    body: JSON.stringify({ query: PRODUCTS_QUERY, variables: { first, after } }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null) as {
    data?: {
      shop?: { currencyCode?: string };
      products?: {
        nodes?: Array<{
          id?: string;
          title?: string;
          handle?: string;
          updatedAt?: string;
          onlineStoreUrl?: string | null;
          featuredMedia?: { preview?: { image?: { url?: string; altText?: string | null } | null } | null } | null;
          variants?: { nodes?: Array<{ sku?: string | null; price?: string }> };
        }>;
        pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
      };
    };
    errors?: unknown;
  } | null;

  if (!response.ok || payload?.errors || !payload?.data?.shop?.currencyCode || !payload.data.products) {
    throw new Error(`Shopify GraphQL product query failed with HTTP ${response.status}.`);
  }

  const products = (payload.data.products.nodes ?? []).flatMap((node) => {
    const variant = node.variants?.nodes?.[0];
    if (!node.id || !node.title || !node.handle || !node.updatedAt || !variant?.price) return [];
    return [{
      id: node.id,
      title: node.title,
      handle: node.handle,
      updatedAt: node.updatedAt,
      onlineStoreUrl: node.onlineStoreUrl ?? null,
      imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
      imageAlt: node.featuredMedia?.preview?.image?.altText ?? null,
      sku: variant.sku ?? null,
      price: variant.price,
    } satisfies ShopifyProduct];
  });

  return {
    currencyCode: payload.data.shop.currencyCode,
    products,
    endCursor: payload.data.products.pageInfo?.endCursor ?? null,
    hasNextPage: Boolean(payload.data.products.pageInfo?.hasNextPage),
  };
}
