import type { CampaignBlock, CampaignDocumentV1, GifMotionValue, ImageValue } from "./model.js";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  issues: ValidationIssue[];
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const SAFE_URL = /^(https:\/\/|mailto:)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, path: string, issues: ValidationIssue[]): value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "Required non-empty string." });
    return false;
  }
  return true;
}

function optionalSafeUrl(value: unknown, path: string, issues: ValidationIssue[]): boolean {
  if (value === undefined) return true;
  if (typeof value !== "string" || !SAFE_URL.test(value)) {
    issues.push({ path, message: "Expected https:// or mailto: URL." });
    return false;
  }
  return true;
}

function validatePositiveInteger(value: unknown, path: string, issues: ValidationIssue[], minimum = 1): boolean {
  if (typeof value !== "number" || !Number.isInteger(value) || value < minimum) {
    issues.push({ path, message: `Expected integer greater than or equal to ${minimum}.` });
    return false;
  }
  return true;
}

function validateMotion(value: unknown, imageSrc: unknown, path: string, issues: ValidationIssue[]): value is GifMotionValue {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected motion metadata object." });
    return false;
  }

  let ok = true;
  if (value.kind !== "gif") {
    issues.push({ path: `${path}.kind`, message: "Only email-safe GIF motion is supported." });
    ok = false;
  }

  const firstFrameOk = requiredString(value.firstFrameSrc, `${path}.firstFrameSrc`, issues)
    && optionalSafeUrl(value.firstFrameSrc, `${path}.firstFrameSrc`, issues);
  ok = firstFrameOk && ok;

  if (typeof imageSrc === "string" && typeof value.firstFrameSrc === "string" && imageSrc === value.firstFrameSrc) {
    issues.push({ path: `${path}.firstFrameSrc`, message: "First-frame fallback must be a separate static asset from the animated GIF." });
    ok = false;
  }

  ok = optionalSafeUrl(value.previewVideoSrc, `${path}.previewVideoSrc`, issues) && ok;
  ok = validatePositiveInteger(value.byteSize, `${path}.byteSize`, issues) && ok;
  ok = validatePositiveInteger(value.frameCount, `${path}.frameCount`, issues, 2) && ok;
  ok = validatePositiveInteger(value.durationMs, `${path}.durationMs`, issues) && ok;

  if (value.loop !== true) {
    issues.push({ path: `${path}.loop`, message: "Email motion must be an intentional looping GIF." });
    ok = false;
  }

  return ok;
}

function validateImage(value: unknown, path: string, issues: ValidationIssue[]): value is ImageValue {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected image object." });
    return false;
  }
  const srcOk = requiredString(value.src, `${path}.src`, issues) && optionalSafeUrl(value.src, `${path}.src`, issues);
  const decorative = value.decorative === true;
  const altOk = decorative || requiredString(value.alt, `${path}.alt`, issues);
  let widthOk = true;
  if (value.width !== undefined && (typeof value.width !== "number" || value.width < 1 || value.width > 1200)) {
    issues.push({ path: `${path}.width`, message: "Image width must be between 1 and 1200 pixels." });
    widthOk = false;
  }
  const motionOk = value.motion === undefined || validateMotion(value.motion, value.src, `${path}.motion`, issues);
  return srcOk && altOk && widthOk && motionOk;
}

function validateBlock(value: unknown, index: number, issues: ValidationIssue[]): value is CampaignBlock {
  const path = `blocks[${index}]`;
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected block object." });
    return false;
  }
  const idOk = requiredString(value.id, `${path}.id`, issues);
  if (!requiredString(value.type, `${path}.type`, issues)) return false;

  switch (value.type) {
    case "preheader":
      return idOk && requiredString(value.text, `${path}.text`, issues);
    case "header": {
      const wordmarkOk = value.wordmark === undefined || typeof value.wordmark === "string";
      if (!wordmarkOk) issues.push({ path: `${path}.wordmark`, message: "Expected string." });
      const logoOk = value.logo === undefined || validateImage(value.logo, `${path}.logo`, issues);
      return idOk && wordmarkOk && logoOk && optionalSafeUrl(value.homeUrl, `${path}.homeUrl`, issues);
    }
    case "hero": {
      const headingOk = requiredString(value.heading, `${path}.heading`, issues);
      const imageOk = value.image === undefined || validateImage(value.image, `${path}.image`, issues);
      let ctaOk = true;
      if (value.cta !== undefined) {
        if (!isRecord(value.cta)) {
          issues.push({ path: `${path}.cta`, message: "Expected CTA object." });
          ctaOk = false;
        } else {
          ctaOk = requiredString(value.cta.label, `${path}.cta.label`, issues) && optionalSafeUrl(value.cta.href, `${path}.cta.href`, issues);
        }
      }
      return idOk && headingOk && imageOk && ctaOk;
    }
    case "text":
      return idOk && requiredString(value.body, `${path}.body`, issues);
    case "image":
      return idOk && validateImage(value.image, `${path}.image`, issues) && optionalSafeUrl(value.href, `${path}.href`, issues);
    case "button": {
      if (!isRecord(value.cta)) {
        issues.push({ path: `${path}.cta`, message: "Expected CTA object." });
        return false;
      }
      return idOk && requiredString(value.cta.label, `${path}.cta.label`, issues) && optionalSafeUrl(value.cta.href, `${path}.cta.href`, issues);
    }
    case "divider":
      return idOk;
    case "spacer": {
      const allowed = new Set([8, 12, 16, 24, 32, 40, 48, 64]);
      if (typeof value.size !== "number" || !allowed.has(value.size)) {
        issues.push({ path: `${path}.size`, message: "Unsupported spacer size." });
        return false;
      }
      return idOk;
    }
    case "social": {
      if (!Array.isArray(value.links) || value.links.length === 0) {
        issues.push({ path: `${path}.links`, message: "At least one social link is required." });
        return false;
      }
      let ok = idOk;
      value.links.forEach((link, linkIndex) => {
        if (!isRecord(link)) {
          issues.push({ path: `${path}.links[${linkIndex}]`, message: "Expected social link object." });
          ok = false;
          return;
        }
        ok = requiredString(link.label, `${path}.links[${linkIndex}].label`, issues) && ok;
        ok = optionalSafeUrl(link.href, `${path}.links[${linkIndex}].href`, issues) && ok;
      });
      return ok;
    }
    case "product-grid": {
      if (!Array.isArray(value.products) || value.products.length === 0 || value.products.length > 6) {
        issues.push({ path: `${path}.products`, message: "Product grid requires 1–6 products." });
        return false;
      }
      let ok = idOk;
      value.products.forEach((product, productIndex) => {
        if (!isRecord(product)) {
          issues.push({ path: `${path}.products[${productIndex}]`, message: "Expected product object." });
          ok = false;
          return;
        }
        ok = requiredString(product.id, `${path}.products[${productIndex}].id`, issues) && ok;
        ok = requiredString(product.title, `${path}.products[${productIndex}].title`, issues) && ok;
        ok = validateImage(product.image, `${path}.products[${productIndex}].image`, issues) && ok;
        ok = optionalSafeUrl(product.href, `${path}.products[${productIndex}].href`, issues) && ok;
      });
      return ok;
    }
    case "columns": {
      if (!Array.isArray(value.columns) || value.columns.length < 2 || value.columns.length > 3) {
        issues.push({ path: `${path}.columns`, message: "Columns block requires 2 or 3 columns." });
        return false;
      }
      let ok = idOk;
      value.columns.forEach((column, columnIndex) => {
        if (!isRecord(column) || !Array.isArray(column.blocks)) {
          issues.push({ path: `${path}.columns[${columnIndex}]`, message: "Expected column with blocks array." });
          ok = false;
          return;
        }
        ok = requiredString(column.id, `${path}.columns[${columnIndex}].id`, issues) && ok;
        column.blocks.forEach((child, childIndex) => {
          if (!isRecord(child) || !["text", "image", "button"].includes(String(child.type))) {
            issues.push({ path: `${path}.columns[${columnIndex}].blocks[${childIndex}]`, message: "Only text, image, and button children are allowed in columns." });
            ok = false;
            return;
          }
          validateBlock(child, childIndex, issues);
        });
      });
      return ok;
    }
    case "footer":
      return idOk && requiredString(value.companyName, `${path}.companyName`, issues) && requiredString(value.physicalAddress, `${path}.physicalAddress`, issues);
    default:
      issues.push({ path: `${path}.type`, message: `Unsupported block type: ${String(value.type)}` });
      return false;
  }
}

export function validateCampaignDocument(value: unknown): ValidationResult<CampaignDocumentV1> {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return { success: false, issues: [{ path: "$", message: "Expected campaign object." }] };

  if (value.schemaVersion !== "1.0.0") issues.push({ path: "schemaVersion", message: "Only schemaVersion 1.0.0 is supported." });
  requiredString(value.id, "id", issues);
  requiredString(value.name, "name", issues);
  requiredString(value.locale, "locale", issues);
  requiredString(value.subject, "subject", issues);
  requiredString(value.preheader, "preheader", issues);

  if (!isRecord(value.brand)) {
    issues.push({ path: "brand", message: "Expected brand object." });
  } else {
    requiredString(value.brand.name, "brand.name", issues);
    requiredString(value.brand.fontFamily, "brand.fontFamily", issues);
    if (!isRecord(value.brand.colors)) {
      issues.push({ path: "brand.colors", message: "Expected color token object." });
    } else {
      for (const key of ["background", "surface", "text", "muted", "primary"] as const) {
        const color = value.brand.colors[key];
        if (typeof color !== "string" || !HEX.test(color)) issues.push({ path: `brand.colors.${key}`, message: "Expected six-digit hex color." });
      }
    }
  }

  if (!Array.isArray(value.blocks) || value.blocks.length === 0) {
    issues.push({ path: "blocks", message: "Campaign requires at least one block." });
  } else {
    const ids = new Set<string>();
    value.blocks.forEach((block, index) => {
      validateBlock(block, index, issues);
      if (isRecord(block) && typeof block.id === "string") {
        if (ids.has(block.id)) issues.push({ path: `blocks[${index}].id`, message: "Block IDs must be unique." });
        ids.add(block.id);
      }
    });
    const footerCount = value.blocks.filter((block) => isRecord(block) && block.type === "footer").length;
    if (footerCount !== 1) issues.push({ path: "blocks", message: "Exactly one footer block is required." });
  }

  return issues.length === 0
    ? { success: true, data: value as unknown as CampaignDocumentV1, issues }
    : { success: false, issues };
}
