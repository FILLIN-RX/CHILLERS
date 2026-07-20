export default function Spinner({ size = 24 }: { size?: number }) {
  // `animate-spin` is provided by Tailwind. The keyframe is defined once in the
  // generated stylesheet, so we don't need to inject a <style> tag here (which
  // would re-define the keyframe on every Spinner mount).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.15" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
