export default function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-100 flex items-center justify-between px-10 py-5 border-b border-border bg-[rgba(6,6,10,0.8)] backdrop-blur-[20px] max-md:px-5 max-md:py-4">
      <div className="flex items-center gap-3">
        <div className="bg-red text-white font-mono font-extrabold text-xs tracking-wide px-[9px] py-[7px] rounded-lg leading-none">
          NEF
        </div>
        <span className="font-extrabold text-base tracking-tight text-white">
          Protokoll
        </span>
      </div>
      <a
        href="#waitlist"
        className="bg-red text-white border-none px-[22px] py-2.5 rounded-[10px] font-bold text-sm cursor-pointer transition-all duration-200 no-underline hover:-translate-y-px hover:shadow-[0_4px_24px_rgba(239,68,68,0.3)]"
      >
        Auf Warteliste &rarr;
      </a>
    </nav>
  );
}
