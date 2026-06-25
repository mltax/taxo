export const BOARD_CATEGORIES = ["사내양식", "법규", "업무매뉴얼", "일반"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];
