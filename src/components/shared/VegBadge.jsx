export default function VegBadge({ className = "" }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-veg ${className}`}
      aria-label="Vegetarian"
      title="Vegetarian"
    >
      <span className="h-2 w-2 rounded-full bg-veg" />
    </span>
  );
}
