export const BOARD_CATEGORIES = ["일반", "업무개선", "사례공유"] as const;
export type BoardCategory = (typeof BOARD_CATEGORIES)[number];
