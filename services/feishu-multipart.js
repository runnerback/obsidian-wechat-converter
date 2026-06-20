// services/feishu-multipart.js
//
// Small multipart/form-data builder for Feishu OpenAPI uploads.

/**
 * @param {unknown} binary
 * @returns {Uint8Array}
 */
function toUint8Array(binary) {
  if (binary instanceof Uint8Array) return binary;
  if (binary instanceof ArrayBuffer) return new Uint8Array(binary);
  if (ArrayBuffer.isView(binary)) {
    return new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength);
  }
  return new Uint8Array(0);
}

/**
 * @param {Uint8Array[]} parts
 * @returns {ArrayBuffer}
 */
function mergeParts(parts) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const bodyBuffer = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    bodyBuffer.set(part, offset);
    offset += part.length;
  }
  return bodyBuffer.buffer;
}

/**
 * @param {{
 *   boundary: string,
 *   fields?: Record<string, string>,
 *   file: { fieldName?: string, fileName: string, mimeType?: string, bytes: ArrayBuffer | Uint8Array },
 * }} params
 * @returns {ArrayBuffer}
 */
function buildMultipartBody({ boundary, fields = {}, file }) {
  const encoder = new TextEncoder();
  /** @type {Uint8Array[]} */
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(encoder.encode(`--${boundary}\r\n`));
    parts.push(encoder.encode(`Content-Disposition: form-data; name="${name}"\r\n\r\n`));
    parts.push(encoder.encode(`${value}\r\n`));
  }

  const fileBytes = toUint8Array(file.bytes);
  parts.push(encoder.encode(`--${boundary}\r\n`));
  parts.push(encoder.encode(`Content-Disposition: form-data; name="${file.fieldName || 'file'}"; filename="${file.fileName}"\r\n`));
  parts.push(encoder.encode(`Content-Type: ${file.mimeType || 'application/octet-stream'}\r\n\r\n`));
  parts.push(fileBytes);
  parts.push(encoder.encode(`\r\n`));
  parts.push(encoder.encode(`--${boundary}--\r\n`));

  return mergeParts(parts);
}

export {
  buildMultipartBody,
  toUint8Array,
};
