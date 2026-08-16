"use client";

import { createClient } from "@/lib/supabase/client";

const DELIVERY_BUCKET = "pagevelope-delivery";
const MAX_DELIVERY_BYTES = 25 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
};

export type DeliveryAsset = {
  assetId: string;
  publicUrl: string;
  objectPath: string;
  sha256: string;
  mimeType: string;
  byteSize: number;
};

export type GifInspection = {
  frameCount: number;
  durationMs: number;
  loopsForever: boolean;
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function sha256(file: File) {
  return toHex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
}

function skipSubBlocks(bytes: Uint8Array, start: number) {
  let offset = start;
  while (offset < bytes.length) {
    const size = bytes[offset];
    offset += 1;
    if (size === 0) return offset;
    offset += size;
    if (offset > bytes.length) throw new Error("GIF contains a truncated data sub-block.");
  }
  throw new Error("GIF data sub-blocks are not terminated.");
}

export async function inspectGif(file: File): Promise<GifInspection> {
  if (file.type !== "image/gif") throw new Error("Motion asset must be an animated GIF.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 13) throw new Error("GIF file is truncated.");
  const signature = String.fromCharCode(...bytes.slice(0, 6));
  if (signature !== "GIF87a" && signature !== "GIF89a") throw new Error("File does not contain a valid GIF header.");

  let offset = 13;
  const globalPacked = bytes[10];
  if (globalPacked & 0x80) offset += 3 * (2 ** ((globalPacked & 0x07) + 1));

  let frameCount = 0;
  let durationMs = 0;
  let pendingDelayMs = 0;
  let loopsForever = false;

  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;

    if (marker === 0x21) {
      if (offset >= bytes.length) throw new Error("GIF extension is truncated.");
      const label = bytes[offset++];
      if (label === 0xf9) {
        const blockSize = bytes[offset++];
        if (blockSize !== 4 || offset + 4 > bytes.length) throw new Error("GIF graphic control extension is invalid.");
        pendingDelayMs = (bytes[offset + 1] | (bytes[offset + 2] << 8)) * 10;
        offset += 4;
        if (bytes[offset++] !== 0) throw new Error("GIF graphic control extension is not terminated.");
        continue;
      }

      if (label === 0xff) {
        const appSize = bytes[offset++];
        if (offset + appSize > bytes.length) throw new Error("GIF application extension is truncated.");
        const app = String.fromCharCode(...bytes.slice(offset, offset + appSize));
        offset += appSize;
        if (app === "NETSCAPE2.0" && offset + 5 <= bytes.length && bytes[offset] === 3 && bytes[offset + 1] === 1) {
          const loops = bytes[offset + 2] | (bytes[offset + 3] << 8);
          loopsForever = loops === 0;
        }
        offset = skipSubBlocks(bytes, offset);
        continue;
      }

      offset = skipSubBlocks(bytes, offset);
      continue;
    }

    if (marker === 0x2c) {
      if (offset + 9 > bytes.length) throw new Error("GIF image descriptor is truncated.");
      const packed = bytes[offset + 8];
      offset += 9;
      if (packed & 0x80) offset += 3 * (2 ** ((packed & 0x07) + 1));
      if (offset >= bytes.length) throw new Error("GIF image data is truncated.");
      offset += 1; // LZW minimum code size.
      offset = skipSubBlocks(bytes, offset);
      frameCount += 1;
      durationMs += pendingDelayMs;
      pendingDelayMs = 0;
      continue;
    }

    throw new Error("GIF contains an unsupported or corrupt block marker.");
  }

  if (frameCount < 2) throw new Error("GIF is static; safe motion requires at least two frames.");
  if (!loopsForever) throw new Error("GIF must contain an infinite loop instruction for email motion.");
  return { frameCount, durationMs: Math.max(durationMs, 1), loopsForever };
}

export async function uploadDeliveryAsset(input: {
  workspaceId: string;
  brandId?: string | null;
  file: File;
}): Promise<DeliveryAsset> {
  const extension = EXTENSIONS[input.file.type];
  if (!extension) throw new Error("Unsupported delivery asset type.");
  if (input.file.size < 1 || input.file.size > MAX_DELIVERY_BYTES) throw new Error("Delivery asset must be between 1 byte and 25 MiB.");

  const fingerprint = await sha256(input.file);
  const objectPath = `${input.workspaceId}/delivery/${fingerprint}.${extension}`;
  const supabase = createClient();

  const { error: uploadError } = await supabase.storage
    .from(DELIVERY_BUCKET)
    .upload(objectPath, input.file, { contentType: input.file.type, cacheControl: "31536000", upsert: false });

  if (uploadError && !/already exists|duplicate/i.test(uploadError.message)) {
    throw new Error(`Delivery asset upload failed: ${uploadError.message}`);
  }

  const { data: assetId, error: registerError } = await supabase.rpc("register_delivery_asset", {
    target_workspace_id: input.workspaceId,
    target_brand_id: input.brandId ?? null,
    target_object_path: objectPath,
    target_mime_type: input.file.type,
    target_byte_size: input.file.size,
    target_sha256: fingerprint,
  });
  if (registerError || typeof assetId !== "string") {
    throw new Error(registerError?.message || "Delivery asset could not be registered.");
  }

  const { data } = supabase.storage.from(DELIVERY_BUCKET).getPublicUrl(objectPath);
  if (!data.publicUrl.startsWith("https://")) throw new Error("Delivery asset did not receive a public HTTPS URL.");

  return {
    assetId,
    publicUrl: data.publicUrl,
    objectPath,
    sha256: fingerprint,
    mimeType: input.file.type,
    byteSize: input.file.size,
  };
}
