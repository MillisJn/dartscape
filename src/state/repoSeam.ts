import { memoryRepo, type Repo } from "@/core/store/repo";

/**
 * Our seam, mirroring the kit's pattern: an interface declared in core/ (Repo, plus memoryRepo as
 * its inert in-memory reference impl), with the real implementation injected at the composition
 * root (startup/registerAppSeams.ts → data/asyncStorageRepo.ts). Nothing above rank 2 ever
 * constructs a Repo directly — it goes through here.
 */
let activeRepo: Repo = memoryRepo();

export function setRepo(repo: Repo): void {
  activeRepo = repo;
}

export function getRepo(): Repo {
  return activeRepo;
}
