export default function SantaHat({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 32"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 24C8 13 17 5 31 4c-4 5-3 12 3 17L5 24Z" fill="#e52848" />
      <path d="M5 21c7 1 18-1 29-4l4 6c-10 4-24 7-33 5-3-.7-3-5 0-7Z" fill="#fffaf0" />
      <circle cx="32" cy="4" r="4" fill="#fffaf0" />
      <path d="M8 23c8 1 17-1 25-4" fill="none" stroke="#ffc4cf" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
