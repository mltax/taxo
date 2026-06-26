/** 귀여운 우주 로켓 로고 (인라인 SVG). className으로 크기 조절. */
export function RocketLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="로켓 로고"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 불꽃 */}
      <path
        d="M32 54c-4 0-7 3.5-7 8 0 0 3-2 7-2s7 2 7 2c0-4.5-3-8-7-8z"
        fill="#fb923c"
      />
      <path
        d="M32 56c-2.2 0-4 2-4 4.6 0 0 1.8-1.1 4-1.1s4 1.1 4 1.1c0-2.6-1.8-4.6-4-4.6z"
        fill="#fde047"
      />
      {/* 좌우 핀 */}
      <path d="M22 38c-5 2-8 7-8 13 4-1 7-3 9-6z" fill="#7c3aed" />
      <path d="M42 38c5 2 8 7 8 13-4-1-7-3-9-6z" fill="#7c3aed" />
      {/* 본체 */}
      <path
        d="M32 4c7 5 12 14 12 26 0 8-2 14-4 18H24c-2-4-4-10-4-18C20 18 25 9 32 4z"
        fill="#f5f3ff"
        stroke="#a78bfa"
        strokeWidth="2"
      />
      {/* 창문 */}
      <circle cx="32" cy="24" r="6.5" fill="#22d3ee" stroke="#0891b2" strokeWidth="2" />
      <circle cx="29.6" cy="21.6" r="1.8" fill="#cffafe" />
      {/* 바닥 라인 */}
      <path d="M24 48h16" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
