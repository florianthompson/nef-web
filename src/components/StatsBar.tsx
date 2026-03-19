const stats = [
  { num: "91", label: "Prüfpositionen" },
  { num: "4", label: "Kategorien" },
  { num: "<2 min", label: "Pro Übergabe" },
];

export default function StatsBar() {
  return (
    <div
      className="flex justify-center gap-12 px-10 py-12 max-w-[800px] mx-auto max-md:gap-6 max-md:flex-wrap max-md:px-5 max-md:py-8"
      style={{ animation: "fadeUp 0.6s ease 0.4s both" }}
    >
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <div className="font-mono text-4xl font-bold text-white tracking-tight max-md:text-[28px]">
            {s.num}
          </div>
          <div className="text-[13px] font-semibold text-text-muted mt-1 uppercase tracking-[0.06em]">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
