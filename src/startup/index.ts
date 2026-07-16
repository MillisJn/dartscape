// The composition root. A static import from app/_layout.tsx — module load, not lazy: several
// seams are reachable on first paint (the theme storage seam runs before the first frame).
import "./registerKitSeams";
import "./registerAppSeams";
