import Hero from "@/components/Hero";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Hero />
      <section className="mt-12 max-md:mt-9">
        <span className="section-tag">
          <b className="text-clay font-medium">·</b> sections
        </span>
        <h2 className="sec-title">
          Pick a section
          <span className="sec-sub">everything you need to run a matcha pop-up booth in Metro Manila</span>
        </h2>
        <div className="grid gap-[18px] mt-[30px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,250px),1fr))]">
          <Link href="/events" className="home-card">
            <span className="absolute top-3.5 right-4 font-mono text-[.6rem] tracking-[.1em] text-brown-soft">01</span>
            <svg className="w-14 h-14" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-pin" /></svg>
            <div className="font-doodle font-bold text-[1.4rem] text-forest leading-tight">Pop-up Events</div>
            <p className="text-[.86rem] text-olive-soft flex-1">Where to set up a booth — upcoming matcha pop-ups, fests &amp; markets around Metro Manila.</p>
            <span className="font-mono text-[.6rem] tracking-[.1em] uppercase text-clay">open →</span>
          </Link>
          <Link href="/calculator" className="home-card">
            <span className="absolute top-3.5 right-4 font-mono text-[.6rem] tracking-[.1em] text-brown-soft">02</span>
            <svg className="w-14 h-14" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-whisk" /></svg>
            <div className="font-doodle font-bold text-[1.4rem] text-forest leading-tight">Cost Calculator</div>
            <p className="text-[.86rem] text-olive-soft flex-1">Pick your matcha &amp; milk; see COGS, price &amp; margin per drink — auto-calculated.</p>
            <span className="font-mono text-[.6rem] tracking-[.1em] uppercase text-clay">open →</span>
          </Link>
          <Link href="/powders" className="home-card">
            <span className="absolute top-3.5 right-4 font-mono text-[.6rem] tracking-[.1em] text-brown-soft">03</span>
            <svg className="w-14 h-14" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-leaf" /></svg>
            <div className="font-doodle font-bold text-[1.4rem] text-forest leading-tight">Powder Guide</div>
            <p className="text-[.86rem] text-olive-soft flex-1">Best matcha to source — PH-homegrown, Japanese-in-PH &amp; imports, with prices.</p>
            <span className="font-mono text-[.6rem] tracking-[.1em] uppercase text-clay">open →</span>
          </Link>
          <Link href="/competitors" className="home-card">
            <span className="absolute top-3.5 right-4 font-mono text-[.6rem] tracking-[.1em] text-brown-soft">04</span>
            <svg className="w-14 h-14" viewBox="0 0 64 64" aria-hidden="true"><use href="#mm-cup" /></svg>
            <div className="font-doodle font-bold text-[1.4rem] text-forest leading-tight">Competitors</div>
            <p className="text-[.86rem] text-olive-soft flex-1">Top 10 indie matcha rivals in Metro Manila — menus, prices &amp; scale, Maps-verified.</p>
            <span className="font-mono text-[.6rem] tracking-[.1em] uppercase text-clay">open →</span>
          </Link>
        </div>
      </section>
    </>
  );
}
