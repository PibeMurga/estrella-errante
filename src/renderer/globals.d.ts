declare global {
  interface Window {
    platform?: { kind: 'electron' };
  }
}
export {};
