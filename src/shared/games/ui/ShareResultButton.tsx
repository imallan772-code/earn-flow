import { useRef } from "react";
import { Share2 } from "lucide-react";
import { useShareResult } from "@/shared/hooks/useShareResult";

interface Props {
  label?: string;
  title?: string;
  /** Render game result into this canvas before share */
  renderToCanvas: (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => void;
  width?: number;
  height?: number;
}

export function ShareResultButton({
  label = "결과 공유",
  title = "Phonara",
  renderToCanvas,
  width = 360,
  height = 200,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { shareCanvas } = useShareResult();

  async function handleShare() {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "oklch(0.13 0.04 280)";
    ctx.fillRect(0, 0, width, height);
    renderToCanvas(canvas, ctx);
    await shareCanvas(canvas, `phonara-result-${Date.now()}.png`, title);
  }

  return (
    <>
      <canvas ref={canvasRef} className="hidden" width={width} height={height} aria-hidden />
      <button
        type="button"
        onClick={() => void handleShare()}
        className="glass-1 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold"
      >
        <Share2 size={14} />
        {label}
      </button>
    </>
  );
}
