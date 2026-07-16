// Avatar stored-path resolution seam for the kit tier.
//
// Avatar's UNCONTROLLED mode takes a stored app-storage path and resolves it to something an
// <Image> can display. That resolution is a Data-tier concern (it typically reads the app's db and
// its file-storage root), which the kit — a LEAF — may not import. So the kit declares the
// one-function surface it needs and the app's composition root injects the real resolver.
//
// INERT DEFAULT: resolve to null. An app that hasn't wired a resolver simply gets Avatar's initials
// fallback, which is the correct degraded behavior — not an error. That is also exactly what
// happens today when a path fails to resolve, so the inert path is a state the component already
// handles.
//
// Avatar's CONTROLLED mode (`resolvedUri`) never touches this seam — the caller has already
// resolved (and ideally prefetched) the uri.
export type AvatarPathResolverSeam = {
  resolve: (storedPath: string) => Promise<string | null>;
};

const inert: AvatarPathResolverSeam = {
  resolve: async () => null,
};

let seam: AvatarPathResolverSeam = inert;

export function setAvatarPathResolverSeam(
  next: Partial<AvatarPathResolverSeam>,
): void {
  seam = { ...seam, ...next };
}

export function resolveAvatarPath(storedPath: string): Promise<string | null> {
  return seam.resolve(storedPath);
}
