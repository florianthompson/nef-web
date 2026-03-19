"use client";

import { useState } from "react";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(false);

  function handleSubmit() {
    if (!email || !email.includes("@")) {
      setError(true);
      return;
    }
    setSubmitted(true);
  }

  return (
    <section className="relative max-w-[700px] mx-auto px-10 pt-20 pb-[120px] text-center max-md:px-5 max-md:pt-[60px] max-md:pb-20" id="waitlist">
      {/* Blue glow */}
      <div className="absolute w-[500px] h-[500px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.05)_0%,transparent_70%)] -bottom-[200px] -left-[150px] pointer-events-none" />

      <h2 className="text-[clamp(28px,4vw,42px)] font-extrabold tracking-tight text-white mb-3">
        Bereit f&uuml;r die digitale &Uuml;bergabe?
      </h2>
      <p className="text-[17px] text-text-muted font-medium leading-relaxed mb-10">
        Wir informieren dich, sobald NEF Protokoll verf&uuml;gbar ist. Kein Spam —
        nur ein Ping zum Launch.
      </p>

      {!submitted ? (
        <div>
          <div className="flex gap-3 max-w-[480px] mx-auto max-md:flex-col">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
              placeholder="deine@email.de"
              className={`flex-1 bg-surface border rounded-[14px] px-5 py-4 font-sans text-base font-medium text-text outline-none transition-colors duration-200 placeholder:text-[rgba(255,255,255,0.25)] focus:border-red ${
                error ? "border-red" : "border-border"
              }`}
            />
            <button
              onClick={handleSubmit}
              className="bg-red text-white border-none px-7 py-4 rounded-[14px] font-extrabold text-base cursor-pointer transition-all duration-200 whitespace-nowrap hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(239,68,68,0.35)]"
            >
              Eintragen
            </button>
          </div>
          <p className="text-[13px] text-[rgba(255,255,255,0.2)] mt-4 font-medium">
            Kostenlos &middot; Kein Spam &middot; Jederzeit abmeldbar
          </p>
        </div>
      ) : (
        <div style={{ animation: "fadeUp 0.4s ease both" }}>
          <div className="w-14 h-14 rounded-full bg-[rgba(34,197,94,0.1)] border-2 border-[rgba(34,197,94,0.3)] flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 12.5L10 17.5L19 7"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h3 className="text-[22px] font-extrabold text-white mb-2">Du bist dabei!</h3>
          <p className="text-[15px] text-text-muted">
            Wir melden uns, sobald NEF Protokoll live geht.
          </p>
        </div>
      )}
    </section>
  );
}
