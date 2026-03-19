const CheckIcon = () => (
  <svg viewBox="0 0 14 14" fill="none" className="w-[11px] h-[11px]">
    <path
      d="M2 7.5L5.5 11L12 3"
      stroke="#fff"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChevronRight = ({ rotate = false }: { rotate?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    style={rotate ? { transform: "rotate(90deg)" } : undefined}
  >
    <path
      d="M6 4L10 8L6 12"
      stroke="rgba(255,255,255,0.3)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

interface SectionHeaderProps {
  icon: string;
  title: string;
  count: string;
  countColor?: string;
  barWidth: string;
  barColor: string;
  open?: boolean;
}

function SectionHeader({ icon, title, count, countColor, barWidth, barColor, open }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 flex items-center justify-center bg-[rgba(255,255,255,0.04)] rounded-[7px] text-[15px]">
          {icon}
        </div>
        <div>
          <div className="text-[13px] font-bold text-white">{title}</div>
          <div className="font-mono text-[10px] font-semibold" style={{ color: countColor || "var(--color-text-muted)" }}>
            {count}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-8 h-[3px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: barWidth, background: barColor }} />
        </div>
        <ChevronRight rotate={open} />
      </div>
    </div>
  );
}

const equipmentItems = [
  { name: "EKG", done: true },
  { name: "Medumat", done: true },
  { name: "Sauerstoff / Ersatzflasche", done: true },
  { name: "Absauger", done: false },
  { name: "Videolaryngoskop", done: true },
  { name: "Ozo-Bohrer", done: false },
  { name: "Perfusor", done: true },
  { name: "REBEL-Tasche", done: true },
  { name: "Thoraxdrainage-Set", done: false },
  { name: "Beckenschlinge", done: true },
];

export default function PhoneDemo() {
  return (
    <section className="relative max-w-[1100px] mx-auto px-10 py-20 pb-[100px] max-md:px-5 max-md:py-[60px] max-md:pb-20" id="demo">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-red mb-4 text-center">
        Interaktive Demo
      </div>
      <h2 className="text-[clamp(28px,4vw,42px)] font-extrabold tracking-tight text-white text-center mb-4">
        So sieht die App aus
      </h2>
      <p className="text-center text-base text-text-muted font-medium mb-12">
        Scrolle durch das Protokoll — direkt im Browser
      </p>

      {/* Phone Frame */}
      <div className="w-[375px] mx-auto bg-[#0a0a0b] rounded-[36px] border-2 border-[rgba(255,255,255,0.08)] shadow-[0_40px_80px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.03),0_0_120px_rgba(239,68,68,0.06)] overflow-hidden relative max-md:w-full max-md:max-w-[375px]">
        <div className="w-[120px] h-7 bg-[#0a0a0b] rounded-b-[18px] mx-auto relative z-5" />
        <div className="pb-5 max-h-[680px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-1.5">
            <span className="font-mono text-xs font-semibold opacity-40">14:32</span>
            <div className="flex gap-1.5">
              <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-[3px] rounded-full text-amber bg-[rgba(245,158,11,0.1)]">
                <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
                  <path d="M2 3.5h11M2 7h7M2 10.5h9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                1 offen
              </div>
              <div className="flex items-center gap-1 text-[10px] font-semibold px-2 py-[3px] rounded-full text-purple bg-[rgba(139,92,246,0.1)]">
                <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
                  <rect x="1" y="3" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M4 1v2M9 1v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  <circle cx="6.5" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.2" />
                </svg>
                2 Leitstelle
              </div>
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center gap-3 px-5 pt-3 pb-2.5">
            <div className="bg-red text-white font-mono font-extrabold text-[11px] px-[9px] py-2 rounded-lg leading-none">
              NEF
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white tracking-tight">Schichtprotokoll</h3>
              <p className="text-[11px] text-text-muted font-medium">Fahrzeug-&Uuml;bergabecheck</p>
            </div>
          </div>

          {/* Vehicle */}
          <div className="mx-4 mt-1 mb-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-text-muted mb-1.5">Fahrzeug</div>
            <div className="bg-[rgba(255,255,255,0.04)] border border-border rounded-[10px] px-3.5 py-[11px] flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-white">MB RK 2233</div>
                <div className="text-[11px] text-text-muted">NEF</div>
              </div>
              <ChevronRight />
            </div>
          </div>

          {/* Progress */}
          <div className="mx-[18px] mb-3.5">
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-40">Fortschritt</span>
              <span className="font-mono text-[13px] font-bold">
                <span className="text-red">32</span> / 91
              </span>
            </div>
            <div className="h-1 bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
              <div
                className="h-full bg-red rounded-full"
                style={{ animation: "progressGrow 2s ease 1s both" }}
              />
            </div>
          </div>

          {/* Section: Fahrzeug */}
          <div className="mx-4 mb-1.5 bg-surface2 rounded-xl border border-[rgba(255,255,255,0.04)] overflow-hidden">
            <SectionHeader
              icon={"\ud83d\ude97"}
              title="Fahrzeug"
              count="8/8 \u2713"
              countColor="var(--color-green)"
              barWidth="100%"
              barColor="var(--color-green)"
            />
          </div>

          {/* Section: Ausrüstung (open) */}
          <div className="mx-4 mb-1.5 bg-surface2 rounded-xl border border-[rgba(255,255,255,0.04)] overflow-hidden">
            <SectionHeader
              icon={"\ud83e\uddf0"}
              title="Ausrüstung"
              count="9/12"
              barWidth="75%"
              barColor="var(--color-red)"
              open
            />
            <div className="border-t border-[rgba(255,255,255,0.04)]">
              {equipmentItems.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center gap-2.5 px-3 py-2.5 border-b border-[rgba(255,255,255,0.02)]"
                >
                  <div
                    className={`w-[18px] h-[18px] min-w-[18px] rounded-[5px] flex items-center justify-center ${
                      item.done
                        ? "bg-green border-2 border-green"
                        : "border-2 border-[rgba(255,255,255,0.15)]"
                    }`}
                  >
                    {item.done && <CheckIcon />}
                  </div>
                  <span
                    className={`text-xs font-medium text-text ${
                      item.done ? "opacity-40 line-through" : ""
                    }`}
                  >
                    {item.name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Medikamente */}
          <div className="mx-4 mb-1.5 bg-surface2 rounded-xl border border-[rgba(255,255,255,0.04)] overflow-hidden">
            <SectionHeader
              icon={"\ud83d\udc8a"}
              title="Medikamente"
              count="12/68"
              barWidth="18%"
              barColor="var(--color-red)"
            />
          </div>

          {/* Section: BTM */}
          <div className="mx-4 mb-1.5 bg-surface2 rounded-xl border border-[rgba(255,255,255,0.04)] overflow-hidden">
            <SectionHeader
              icon={"\ud83d\udd12"}
              title="Betäubungsmittel"
              count="3/3 \u2713"
              countColor="var(--color-green)"
              barWidth="100%"
              barColor="var(--color-green)"
            />
          </div>

          {/* Submit button */}
          <div className="mx-4 mt-4">
            <div className="w-full py-3.5 bg-red rounded-xl text-center">
              <div className="text-white text-[15px] font-extrabold">Protokoll absenden</div>
              <div className="text-[rgba(255,255,255,0.6)] text-[11px] font-semibold font-mono mt-0.5">
                32/91 gepr&uuml;ft
              </div>
            </div>
            <p className="text-center text-[11px] text-amber mt-2 font-medium">
              &#9888; 59 Positionen nicht gepr&uuml;ft — wird bei Abgabe markiert
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
