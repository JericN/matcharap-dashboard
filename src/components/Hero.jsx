// Landing hero: arched "Matcharap Eto" logo over the whisking mascot.
export default function Hero() {
  return (
    <header
      className="relative text-center overflow-hidden border-[2.5px] border-forest rounded-[30px_24px_32px_22px] shadow-hard px-[18px] py-[14px] max-md:px-3 max-md:py-3"
      style={{
        background:
          "radial-gradient(60% 80% at 50% 12%, rgb(var(--c-matcha-bright) / .18), transparent 70%), rgb(var(--c-kraft))",
      }}
    >
      <span className="absolute top-[14px] left-[18px] font-mono text-[.58rem] tracking-[.16em] uppercase text-brown-soft max-md:hidden">
        est. 2026
      </span>
      <span className="absolute bottom-4 left-[18px] font-mono text-[.58rem] tracking-[.16em] uppercase text-brown-soft max-md:hidden">
        metro manila
      </span>

      <svg
        className="absolute top-3 right-[14px] w-[74px] h-[74px] rotate-[8deg] max-md:w-[54px] max-md:h-[54px] max-md:top-2 max-md:right-2"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M50 6c8 4 16 0 22 6s2 14 6 22-2 16 0 22-8 14-16 16-12 8-22 6-16-2-22-8-8-10-10-18 0-16 2-24 6-14 14-18 18-8 26-4Z"
          stroke="#b9542d"
          strokeWidth="2.4"
          fill="rgba(185,84,45,.06)"
        />
        <text
          x="50"
          y="40"
          textAnchor="middle"
          fontFamily="DM Mono, monospace"
          fontSize="9"
          fill="#b9542d"
          letterSpacing="1"
        >
          EST.
        </text>
        <text
          x="50"
          y="58"
          textAnchor="middle"
          fontFamily="Caveat, cursive"
          fontSize="24"
          fontWeight="700"
          fill="#b9542d"
        >
          2026
        </text>
        <text
          x="50"
          y="74"
          textAnchor="middle"
          fontFamily="DM Mono, monospace"
          fontSize="7"
          fill="#b9542d"
          letterSpacing="1.5"
        >
          MANILA · PH
        </text>
      </svg>

      <div className="max-w-[480px] mx-auto">
        <svg
          className="w-full h-auto block"
          viewBox="0 44 520 300"
          role="img"
          aria-label="Matcharap Eto logo with whisking mascot"
        >
          <defs>
            <path id="archTop" d="M 95 175 A 250 250 0 0 1 425 175" fill="none" />
          </defs>
          <text
            fontFamily="Caveat, cursive"
            fontWeight="700"
            fill="#3f5031"
            fontSize="60"
            letterSpacing="2"
          >
            <textPath href="#archTop" startOffset="50%" textAnchor="middle">
              Matcharap Eto
            </textPath>
          </text>
          <g stroke="#56683f" strokeWidth="2.4" fill="rgba(86,104,63,.18)" strokeLinecap="round">
            <path d="M96 150 q-16 -10 -8 -28 q18 4 18 24 q0 6 -10 4Z" />
            <path d="M424 150 q16 -10 8 -28 q-18 4 -18 24 q0 6 10 4Z" />
          </g>
          <g
            transform="translate(63,2)"
            stroke="#3f5031"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          >
            <path
              d="M196 196 c-30 0 -54 22 -54 52 c0 34 26 58 64 58 c40 0 66 -24 66 -58 c0 -30 -24 -52 -54 -52 Z"
              fill="#a9c08a"
            />
            <path d="M206 196 q4 -22 -8 -34 q20 2 22 26" fill="#7c9b58" />
            <path d="M218 188 q14 -16 30 -14 q-4 18 -26 22" fill="#8caa64" />
            <circle cx="178" cy="262" r="9" fill="#d98a63" stroke="none" opacity=".7" />
            <circle cx="246" cy="262" r="9" fill="#d98a63" stroke="none" opacity=".7" />
            <path d="M186 244 q5 -8 11 0" strokeWidth="3.4" />
            <path d="M229 244 q5 -8 11 0" strokeWidth="3.4" />
            <path d="M203 256 q9 9 18 0" strokeWidth="3" />
            <path d="M156 268 q-22 4 -34 22" />
            <path d="M268 250 q26 -8 34 -34" />
            <g>
              <path d="M96 290 h54 l-6 30 a8 8 0 0 1 -8 7 h-26 a8 8 0 0 1 -8 -7 Z" fill="#eef0e2" />
              <path d="M104 298 h38 l-3 16 h-32 Z" fill="#7faa4e" stroke="none" />
              <path d="M118 282 q6 -8 0 -16 q-6 -8 0 -16" strokeWidth="2.4" />
              <path d="M132 282 q6 -8 0 -16 q-6 -8 0 -16" strokeWidth="2.4" />
            </g>
            <g strokeWidth="2.6">
              <path d="M300 214 l14 -26" />
              <path d="M306 214 l16 -24" />
              <path d="M295 218 l10 -28" />
              <path d="M292 224 h18" strokeWidth="3" />
              <path d="M300 226 l4 18" strokeWidth="3.4" />
            </g>
          </g>
        </svg>
      </div>

      <p className="font-mono text-[.7rem] tracking-[.26em] uppercase text-brown mt-1.5">
        whisked fresh in metro manila
      </p>
      <p className="font-display font-semibold text-2xl text-olive mt-0.5">
        events · cost calculator · powder guide
      </p>
    </header>
  );
}
