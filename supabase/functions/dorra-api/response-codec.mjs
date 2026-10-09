// Large replay results are compressed in the private database, then restored
// before responding. Retries receive the original outcome without rerunning it.
const MAX_CACHED_BYTES = 262144;
const encoder = new TextEncoder();
const decoder = new TextDecoder();
export async function encodeResult(result) {
  const bytes = encoder.encode(JSON.stringify(result));
  if (bytes.length < 32768) return result;
  const compressed = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < compressed.length; offset += 8192) binary += String.fromCharCode(...compressed.subarray(offset, offset + 8192));
  const encoded = {dorraReplayEncoding:'gzip-base64-v1',data:btoa(binary)};
  if (encoder.encode(JSON.stringify(encoded)).length >= MAX_CACHED_BYTES) {
    throw Object.assign(new Error('This operation produced too much replay data. Contact the House owner before retrying.'), {code:'RESULT_SIZE_LIMIT',status:409});
  }
  return encoded;
}
export async function decodeResult(value) {
  if (value?.dorraReplayEncoding !== 'gzip-base64-v1') return value;
  const bytes = Uint8Array.from(atob(value.data), char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(decoder.decode(await new Response(stream).arrayBuffer()));
}
