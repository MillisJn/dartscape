/**
 * ID generation seam (GRAND_PLAN.md's seam table), mirroring `store/repo.ts`'s pattern: an inert
 * default that keeps every core/ test running in node with zero mocks, a real implementation
 * injected at the composition root (startup/registerAppSeams.ts).
 *
 * The raw `crypto.randomUUID()` global this replaces does not exist on Hermes — there is no
 * polyfill in this project, and expo-crypto only exports a named `Crypto.randomUUID()`, it does
 * not patch the global. Calling the bare global crashes on device; going through this seam is what
 * lets data/asyncStorageRepo.ts and features/game/GameScreen.tsx stay driver-free.
 */
let counter = 0;

/** `id-1`, `id-2`, ... — unique enough for the in-memory repo and every core/ test. */
const inertNewId: () => string = () => `id-${++counter}`;

let generator: () => string = inertNewId;

export function setIdGenerator(next: () => string): void {
  generator = next;
}

export function newId(): string {
  return generator();
}
