const textEncoder = new TextEncoder();

function toBytes(content: string | Uint8Array): Uint8Array {
  return typeof content === "string" ? textEncoder.encode(content) : content;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getSubtleCrypto(): SubtleCrypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Web Crypto is required to hash VFS file content.");
  }

  return globalThis.crypto.subtle;
}

export async function hashContent(content: string | Uint8Array): Promise<string> {
  const subtle = await getSubtleCrypto();
  const digest = await subtle.digest("SHA-256", toBytes(content) as unknown as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}
