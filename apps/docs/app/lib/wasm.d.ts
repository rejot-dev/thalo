/**
 * Type declarations for WASM module imports.
 *
 * In Cloudflare Workers, .wasm imports are resolved as WebAssembly.Module.
 */
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
