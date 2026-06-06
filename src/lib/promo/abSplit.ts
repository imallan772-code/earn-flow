/**
 * A/B variant split — deterministic by ratio.
 */
export interface AbVariant<T> {
  id: string;
  weight: number;
  payload: T;
}

export interface SplitAssignment<T> {
  variantId: string;
  payload: T;
  ratio: number;
}

export function splitVariants<T>(variants: AbVariant<T>[]): SplitAssignment<T>[] {
  if (variants.length === 0) return [];
  const total = variants.reduce((s, v) => s + Math.max(0, v.weight), 0);
  if (total <= 0) {
    const r = 1 / variants.length;
    return variants.map((v) => ({ variantId: v.id, payload: v.payload, ratio: r }));
  }
  return variants.map((v) => ({
    variantId: v.id,
    payload: v.payload,
    ratio: Math.max(0, v.weight) / total,
  }));
}

export function pickVariant<T>(variants: AbVariant<T>[], rand: number): AbVariant<T> | null {
  if (variants.length === 0) return null;
  const split = splitVariants(variants);
  let acc = 0;
  const r = Math.min(0.9999999, Math.max(0, rand));
  for (let i = 0; i < split.length; i++) {
    acc += split[i].ratio;
    if (r < acc) return variants[i];
  }
  return variants[variants.length - 1];
}
