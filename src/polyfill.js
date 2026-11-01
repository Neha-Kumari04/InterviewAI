import { Buffer } from 'buffer';

// Ensure Buffer is globally defined across all JavaScript runtime scopes
// Hermes in React Native resolves bare identifiers via globalThis in strict mode
if (typeof globalThis !== 'undefined') {
  globalThis.Buffer = Buffer;
}
if (typeof global !== 'undefined') {
  global.Buffer = Buffer;
}
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

export { Buffer };
export default Buffer;
