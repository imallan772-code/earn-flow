import { useCallback } from "react";

export function useShareResult() {
  const shareBlob = useCallback(async (blob: Blob, filename: string, title?: string) => {
    if (typeof window === "undefined") return false;

    const file = new File([blob], filename, { type: blob.type });
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: title ?? "Phonara", files: [file] });
        return true;
      } catch {
        /* fall through */
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }, []);

  const shareCanvas = useCallback(
    async (canvas: HTMLCanvasElement, filename: string, title?: string) => {
      if (typeof window === "undefined") return false;
      return new Promise<boolean>((resolve) => {
        canvas.toBlob(async (blob) => {
          if (!blob) {
            resolve(false);
            return;
          }
          resolve(await shareBlob(blob, filename, title));
        }, "image/png");
      });
    },
    [shareBlob],
  );

  return { shareBlob, shareCanvas };
}
