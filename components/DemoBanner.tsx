export function DemoBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
      <span className="font-medium uppercase tracking-widest">Demo mode</span>
      <span className="mx-2 opacity-50">·</span>
      <span>No real payment, no real retailer, mock providers throughout</span>
    </div>
  );
}
