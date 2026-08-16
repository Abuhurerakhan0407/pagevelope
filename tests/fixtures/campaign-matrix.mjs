import { readFile } from "node:fs/promises";

const base = JSON.parse(await readFile(new URL("./product-launch.json", import.meta.url), "utf8"));

const directions = [
  ["launch-left", "Launch / Left", "left", 2],
  ["launch-center", "Launch / Center", "center", 2],
  ["launch-right", "Launch / Right", "right", 2],
  ["single-product", "Single product focus", "left", 1],
  ["three-column", "Three column collection", "center", 3],
  ["restock", "Restock announcement", "left", 2],
  ["waitlist", "Waitlist opening", "center", 2],
  ["limited-offer", "Limited offer", "left", 2],
  ["lifecycle-reminder", "Lifecycle reminder", "left", 2],
  ["editorial", "Collection editorial", "center", 2],
  ["minimal", "Minimal launch", "left", 1],
  ["premium", "Premium launch", "center", 2],
  ["mobile-first", "Mobile first", "left", 2],
  ["image-led", "Image led", "center", 2],
  ["copy-led", "Copy led", "left", 2],
  ["social-proof", "Social proof", "left", 2],
  ["seasonal", "Seasonal drop", "center", 3],
  ["vip", "VIP early access", "left", 2],
  ["back-in-stock", "Back in stock", "center", 2],
  ["final-call", "Final call", "right", 2]
];

export const campaignFixtures = directions.map(([slug, label, align, columns], index) => {
  const campaign = structuredClone(base);
  const number = String(index + 1).padStart(2, "0");
  campaign.id = `campaign_fixture_${number}_${slug}`;
  campaign.name = `Orbit ${label}`;
  campaign.subject = `${label}: Orbit is ready`;
  campaign.preheader = `Fixture ${number} validates the deterministic Pagevelope release path.`;

  const hero = campaign.blocks.find((block) => block.type === "hero");
  hero.align = align;
  hero.eyebrow = label;
  hero.heading = `Orbit campaign fixture ${number}`;
  hero.body = `A deterministic ${label.toLowerCase()} campaign used to prove safe production rendering.`;

  const grid = campaign.blocks.find((block) => block.type === "product-grid");
  grid.columns = columns;
  if (columns === 1) grid.products = grid.products.slice(0, 1);
  if (columns === 3) {
    grid.products.push({
      id: `p3-${number}`,
      title: "Orbit / Sand",
      price: "₹2,499",
      image: { src: "https://images.example.com/orbit-sand.jpg", alt: "Sand Orbit bottle" },
      href: "https://example.com/products/orbit-sand"
    });
  }

  return campaign;
});

if (campaignFixtures.length !== 20) throw new Error("Renderer hardening gate requires exactly 20 campaign fixtures.");
