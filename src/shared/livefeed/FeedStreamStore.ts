/**
 * Global social feed store — ring buffer of FOMO posts (display only).
 */
import { generateFeedPost, generateHotMoment, type FeedCurrency } from "./feedStreamContent";

export interface FeedPost {
  id: string;
  user: string;
  flag: string;
  avatar: string;
  body: string;
  reward: number;
  currency: FeedCurrency;
  likes: number;
  comments: number;
  ts: number;
}

export interface HotMoment {
  id: string;
  name: string;
  flag: string;
  action: string;
  amount: number;
  currency: FeedCurrency;
  ts: number;
}

export type { FeedCurrency };

const MAX_POSTS = 80;
const MAX_HOT = 12;

let posts: FeedPost[] = [];
let hotMoments: HotMoment[] = [];
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => fn());
}

function nextId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function pushHotIfBig(
  reward: number,
  currency: FeedCurrency,
  user: string,
  flag: string,
  action: string,
): void {
  if (currency === "USDT" && reward < 420 && Math.random() > 0.35) return;
  if (currency === "PHON" && reward < 200_000 && Math.random() > 0.15) return;
  hotMoments = [
    {
      id: nextId("hm"),
      name: `${flag} ${user.length > 6 ? user.slice(0, 4) + "***" : user}`,
      flag,
      action: action.slice(0, 60),
      amount: reward,
      currency,
      ts: Date.now(),
    },
    ...hotMoments,
  ].slice(0, MAX_HOT);
}

export const feedStreamStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getPosts: () => posts,
  getHotMoments: () => hotMoments,
  pushPost(data?: Partial<Omit<FeedPost, "id" | "ts">> & { ts?: number }) {
    const generated = generateFeedPost();
    const post: FeedPost = {
      id: nextId("fp"),
      user: data?.user ?? generated.user,
      flag: data?.flag ?? generated.flag,
      avatar: data?.avatar ?? generated.avatar,
      body: data?.body ?? generated.body,
      reward: data?.reward ?? generated.reward,
      currency: data?.currency ?? generated.currency,
      likes: data?.likes ?? generated.likes,
      comments: data?.comments ?? generated.comments,
      ts: data?.ts ?? Date.now(),
    };
    posts = [post, ...posts].slice(0, MAX_POSTS);
    pushHotIfBig(post.reward, post.currency, post.user, post.flag, post.body);
    emit();
    return post.id;
  },
  pushHotMoment(data?: Partial<Omit<HotMoment, "id" | "ts">> & { ts?: number }) {
    const generated = generateHotMoment();
    const moment: HotMoment = {
      id: nextId("hm"),
      name: data?.name ?? generated.name,
      flag: data?.flag ?? generated.flag,
      action: data?.action ?? generated.action,
      amount: data?.amount ?? generated.amount,
      currency: data?.currency ?? generated.currency,
      ts: data?.ts ?? Date.now(),
    };
    hotMoments = [moment, ...hotMoments].slice(0, MAX_HOT);
    emit();
    return moment.id;
  },
  __reset() {
    posts = [];
    hotMoments = [];
    emit();
  },
};

export function seedFeedStream(postCount = 16, hotCount = 8): void {
  if (posts.length > 0) return;
  for (let i = 0; i < postCount; i++) {
    feedStreamStore.pushPost({ ts: Date.now() - (postCount - i) * (800 + Math.random() * 1200) });
  }
  for (let i = 0; i < hotCount; i++) {
    feedStreamStore.pushHotMoment({ ts: Date.now() - i * 5000 });
  }
}
