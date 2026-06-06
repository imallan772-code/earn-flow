import { useEffect } from "react";
import { seedFeedStream } from "./FeedStreamStore";
import { startFeedStreamBot } from "./feedStreamBot";

export function useFeedStreamBoot(): void {
  useEffect(() => {
    seedFeedStream();
    return startFeedStreamBot();
  }, []);
}
