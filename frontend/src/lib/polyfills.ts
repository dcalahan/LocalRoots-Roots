// Polyfill for crypto.randomUUID (not available in older Safari/iOS)
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = function randomUUID(): `${string}-${string}-${string}-${string}-${string}` {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
      (
        Number(c) ^
        (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))
      ).toString(16)
    ) as `${string}-${string}-${string}-${string}-${string}`;
  };
}

export {};
