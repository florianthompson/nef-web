export default function Hero() {
  return (
    <section className="relative px-10 pt-40 pb-[100px] max-w-[1200px] mx-auto text-center overflow-hidden max-md:px-5 max-md:pt-[130px] max-md:pb-[60px]">
      {/* Red glow */}
      <div className="absolute w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.08)_0%,transparent_70%)] -top-[200px] -right-[100px] pointer-events-none" />

      <div
        className="inline-flex items-center gap-2 bg-surface border border-border rounded-full px-[18px] py-2 pl-2.5 text-[13px] font-semibold text-text-muted mb-8"
        style={{ animation: "fadeUp 0.6s ease both" }}
      >
        <div className="w-2 h-2 rounded-full bg-green" style={{ animation: "pulse-dot 2s ease infinite" }} />
        In Entwicklung — Bald verf&uuml;gbar
      </div>

      <h1
        className="text-[clamp(42px,6vw,76px)] font-extrabold tracking-[-0.04em] leading-[1.05] text-white mb-6"
        style={{ animation: "fadeUp 0.6s ease 0.1s both" }}
      >
        Schicht&uuml;bergabe.
        <br />
        <span className="bg-gradient-to-br from-red to-[#f97316] bg-clip-text text-transparent">
          Digital. Sicher. L&uuml;ckenlos.
        </span>
      </h1>

      <p
        className="text-[clamp(17px,2vw,20px)] leading-relaxed text-text-muted max-w-[600px] mx-auto mb-12 font-medium"
        style={{ animation: "fadeUp 0.6s ease 0.2s both" }}
      >
        Das digitale &Uuml;bergabeprotokoll f&uuml;r Rettungsdienste. Fahrzeuge,
        Medikamente und Ausr&uuml;stung — alles gepr&uuml;ft, dokumentiert und in
        Echtzeit synchronisiert.
      </p>

      <div
        className="flex justify-center gap-4 flex-wrap"
        style={{ animation: "fadeUp 0.6s ease 0.3s both" }}
      >
        <a
          href="#waitlist"
          className="bg-red text-white border-none px-9 py-4 rounded-[14px] font-extrabold text-[17px] cursor-pointer transition-all duration-200 no-underline inline-flex items-center gap-2.5 hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(239,68,68,0.35)]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M3 9.5L7 13.5L15 5"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Benachrichtigt werden
        </a>
        <a
          href="#demo"
          className="bg-surface text-text border border-border px-9 py-4 rounded-[14px] font-bold text-[17px] cursor-pointer transition-all duration-200 no-underline hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.04)]"
        >
          Demo ansehen &darr;
        </a>
      </div>
    </section>
  );
}
