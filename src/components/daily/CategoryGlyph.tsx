import { getCategoryVisual } from "@/lib/categoryVisuals";

interface CategoryGlyphProps {
  categoryName?: string | null;
}

/** Pastel well + category emoji for expense rows. */
export default function CategoryGlyph({ categoryName }: CategoryGlyphProps) {
  const visual = getCategoryVisual(categoryName);
  return (
    <span
      className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px] leading-none shadow-[inset_0_0_0_1px_rgba(40,28,20,0.06)]"
      style={{ backgroundImage: visual.gradient }}
      aria-hidden="true"
      title={categoryName || visual.name}
    >
      {visual.emoji}
    </span>
  );
}
