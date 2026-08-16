import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { createManualProduct, saveCampaignProducts } from "./actions";
import { ShopifyPanel } from "./shopify-panel";
import styles from "./products.module.css";

type PageProps = {
  params: Promise<{ workspaceId: string; brandId: string; campaignId: string }>;
  searchParams: Promise<{ error?: string; product?: string; shopify?: string }>;
};

type Product = {
  id: string;
  title: string;
  sku: string | null;
  price_amount: string | number;
  currency: string;
  image_url: string | null;
  product_url: string | null;
  source: "manual" | "shopify";
};

type IntegrationConnection = {
  external_account_id: string;
  status: string;
};

const errors: Record<string, string> = {
  "invalid-product": "Check the product title, price, currency, and HTTPS links.",
  "product-create-failed": "The product could not be created in this brand.",
  "invalid-selection": "Select between one and six unique products.",
  "selection-save-failed": "The campaign product selection could not be saved.",
};

function priceLabel(product: Product) {
  const amount = Number(product.price_amount);
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: product.currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${product.currency} ${amount.toLocaleString("en-IN")}`;
  }
}

export const dynamic = "force-dynamic";

export default async function CampaignProductsPage({ params, searchParams }: PageProps) {
  const { workspaceId, brandId, campaignId } = await params;
  const query = await searchParams;
  if (!getSupabasePublicConfig()) redirect("/dashboard");

  const supabase = await createClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claimsData?.claims?.sub) redirect("/auth/sign-in");

  const [workspaceResult, brandResult, campaignResult, productsResult, selectedResult, shopifyResult] = await Promise.all([
    supabase.from("workspaces").select("id,name").eq("id", workspaceId).maybeSingle(),
    supabase.from("brands").select("id,name,primary_color").eq("workspace_id", workspaceId).eq("id", brandId).maybeSingle(),
    supabase
      .from("campaigns")
      .select("id,name,status,product_selection_completed_at")
      .eq("workspace_id", workspaceId)
      .eq("brand_id", brandId)
      .eq("id", campaignId)
      .maybeSingle(),
    supabase
      .from("products")
      .select("id,title,sku,price_amount,currency,image_url,product_url,source")
      .eq("workspace_id", workspaceId)
      .eq("brand_id", brandId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("campaign_products")
      .select("product_id,position")
      .eq("workspace_id", workspaceId)
      .eq("campaign_id", campaignId)
      .order("position", { ascending: true }),
    supabase
      .from("integration_connections")
      .select("external_account_id,status")
      .eq("workspace_id", workspaceId)
      .eq("provider", "shopify")
      .maybeSingle(),
  ]);

  const workspace = workspaceResult.data;
  const brand = brandResult.data;
  const campaign = campaignResult.data;
  if (!workspace || !brand || !campaign) redirect("/dashboard");

  const products = (productsResult.data ?? []) as Product[];
  const selectedIds = new Set((selectedResult.data ?? []).map((item) => String(item.product_id)));
  const shopifyConnection = shopifyResult.data as IntegrationConnection | null;
  const connectedShop = shopifyConnection?.status === "connected" ? shopifyConnection.external_account_id : null;
  const errorMessage = query.error ? errors[query.error] : null;
  const addProduct = createManualProduct.bind(null, workspaceId, brandId, campaignId);
  const saveProducts = saveCampaignProducts.bind(null, workspaceId, brandId, campaignId);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.logo} href="/dashboard"><span>P</span>Pagevelope</Link>
        <div className={styles.crumbs}>
          <Link href={`/workspaces/${workspaceId}/brands/${brandId}`}>{brand.name}</Link>
          <span>/</span>
          <strong>{campaign.name}</strong>
        </div>
      </header>

      <section className={styles.page}>
        <div className={styles.progress}>
          <div className={styles.progressItem}><i className={styles.done}>✓</i><span>Brand</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i className={styles.active}>2</i><span>Products</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i>3</i><span>Brief</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i>4</i><span>Direction</span></div>
          <div className={styles.progressLine} />
          <div className={styles.progressItem}><i>5</i><span>Builder</span></div>
        </div>

        <div className={styles.headingRow}>
          <div>
            <p className={styles.eyebrow}>Product source · {workspace.name}</p>
            <h1>Choose what this campaign is selling.</h1>
            <p className={styles.lead}>Select up to six products. These exact products become structured campaign content instead of placeholder cards inside the builder.</p>
          </div>
          <div className={styles.campaignPill}><span style={{ background: brand.primary_color }} />{campaign.name}</div>
        </div>

        {errorMessage ? <div className={styles.error}>{errorMessage}</div> : null}
        {query.product === "1" ? <div className={styles.success}>Product added to {brand.name}. Select it below when it belongs in this campaign.</div> : null}
        {query.shopify === "connected" ? <div className={styles.success}>Shopify connected. Sync the catalog from the product source panel.</div> : null}
        {query.shopify === "scope-error" || query.shopify === "token-error" ? <div className={styles.error}>Shopify authorization did not complete. Reconnect the store and approve product read access.</div> : null}

        <div className={styles.layout}>
          <section className={styles.catalogCard}>
            <div className={styles.sectionHeading}>
              <div>
                <span>01</span>
                <div><h2>Campaign products</h2><p>{products.length} available in this brand</p></div>
              </div>
              <em>1–6 required</em>
            </div>

            {products.length ? (
              <form action={saveProducts}>
                <div className={styles.productGrid}>
                  {products.map((product) => (
                    <label className={styles.productCard} key={product.id}>
                      <input name="productIds" type="checkbox" value={product.id} defaultChecked={selectedIds.has(product.id)} />
                      <span className={styles.checkmark}>✓</span>
                      <div className={styles.productImage}>
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt="" />
                        ) : (
                          <span>{product.title.slice(0, 1).toUpperCase()}</span>
                        )}
                      </div>
                      <div className={styles.productInfo}>
                        <div className={styles.productMeta}><span>{product.source}</span>{product.sku ? <span>{product.sku}</span> : null}</div>
                        <strong>{product.title}</strong>
                        <b>{priceLabel(product)}</b>
                      </div>
                    </label>
                  ))}
                </div>

                <div className={styles.catalogFooter}>
                  <p>Changing this selection later invalidates the downstream brief and creative direction so stale campaign work cannot silently survive.</p>
                  <button type="submit">Save products & continue →</button>
                </div>
              </form>
            ) : (
              <div className={styles.emptyState}>
                <span>0 products</span>
                <h2>Add or sync the first product.</h2>
                <p>Connect Shopify for real catalog data or use the manual product form.</p>
              </div>
            )}
          </section>

          <aside className={styles.addCard}>
            <p className={styles.sideKicker}>Product sources</p>
            <h2>Shopify catalog</h2>
            <p className={styles.sideCopy}>Import product title, first variant price/SKU, featured image and storefront URL using read-only product access.</p>
            <ShopifyPanel workspaceId={workspaceId} brandId={brandId} connectedShop={connectedShop} />

            <div style={{ height: 1, background: "rgba(15,18,33,.08)", margin: "24px 0" }} />
            <p className={styles.sideKicker}>Manual source</p>
            <h2>Add a product</h2>
            <p className={styles.sideCopy}>Use real product information. Image and product links must be HTTPS.</p>
            <form className={styles.productForm} action={addProduct}>
              <label><span>Product title</span><input name="title" maxLength={200} placeholder="Orbit Bottle" required /></label>
              <div className={styles.twoCol}>
                <label><span>Price</span><input name="price" type="number" min="0" step="0.01" placeholder="2499" required /></label>
                <label><span>Currency</span><input name="currency" maxLength={3} defaultValue="INR" required /></label>
              </div>
              <label><span>SKU <em>optional</em></span><input name="sku" maxLength={120} placeholder="ORB-001" /></label>
              <label><span>Image URL <em>optional</em></span><input name="imageUrl" type="url" placeholder="https://…" /></label>
              <label><span>Product URL <em>optional</em></span><input name="productUrl" type="url" placeholder="https://…" /></label>
              <button type="submit">Add to brand catalog</button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
