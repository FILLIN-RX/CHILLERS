export default function SantaHat({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M22 76C24 38 56 18 92 26c6 2 10 10 6 20s-12 14-16 8c-4-8-16-8-20 2l6 20Z" fill="#ef4444" />
      <path d="M62 56c6-6 14-4 20 0L68 76Z" fill="#dc2626" />
      <circle cx="96" cy="54" r="11" fill="#f8fafc" />
      <rect x="16" y="72" width="66" height="18" rx="9" fill="#f8fafc" />
    </svg>
  );
}
