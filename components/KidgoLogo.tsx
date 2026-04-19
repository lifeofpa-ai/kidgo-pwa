export function KidgoLogo({ className = "" }: { className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: "var(--font-nunito), 'Nunito', sans-serif",
        fontWeight: 900,
        background: "linear-gradient(135deg, #FF8C42, #E8727A, #B06AB3, #6366F1)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        display: "inline-block",
        fontSize: "1.5rem",
        lineHeight: 1.1,
        letterSpacing: "-0.02em",
      }}
    >
      kidgo
    </span>
  );
}
