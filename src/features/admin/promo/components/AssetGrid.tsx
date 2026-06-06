import { Upload } from "lucide-react";
import { usePromoAdmin } from "../hooks/usePromoAdmin";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export function AssetGrid() {
  const { assets, addAsset, loading } = usePromoAdmin();
  const ko = ADMIN_KO.promo.assets;
  const addPlaceholder = () => {
    addAsset({
      id: `a-${Date.now()}`,
      kind: "image",
      url: `https://placehold.co/600x400?text=Promo+${assets.length + 1}`,
      alt: "플레이스홀더",
      createdAt: new Date().toISOString(),
    });
  };
  return (
    <section className="glass-2 rounded-3xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold">{ko.title}</h2>
        <button
          onClick={addPlaceholder}
          className="flex items-center gap-1 rounded-2xl bg-holographic px-3 py-1.5 text-xs font-bold text-(--color-bg-0)"
        >
          <Upload size={12} /> {ko.addPlaceholder}
        </button>
      </div>
      {loading ? (
        <p className="text-xs text-(--color-muted)">{ko.loading}</p>
      ) : assets.length === 0 ? (
        <p className="text-xs text-(--color-muted)">{ko.empty}</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {assets.map((a) => (
            <figure key={a.id} className="glass-1 overflow-hidden rounded-2xl">
              <img
                src={a.url}
                alt={a.alt ?? ""}
                loading="lazy"
                className="aspect-3/2 w-full object-cover"
              />
              <figcaption className="font-numeric p-2 text-[10px] text-(--color-muted)">
                {ko.kind[a.kind] ?? a.kind} · {a.createdAt.slice(0, 10)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
