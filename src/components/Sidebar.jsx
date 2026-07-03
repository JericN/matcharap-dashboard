"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MascotMini } from "@/components/Doodles";

const ROOT = [
  { href: "/calculator", label: "Calculator" },
  { href: "/expenses", label: "Expenses" },
  { href: "/documents", label: "Documents" },
];

const RESEARCH = [
  { href: "/events", label: "Events" },
  { href: "/competitors", label: "Competitors" },
  { href: "/powders", label: "Powders" },
  { href: "/milks", label: "Milks" },
  { href: "/drinks", label: "Drinks" },
];

function NavLinks({ path }) {
  const row = (l) => {
    const active = path.startsWith(l.href);
    return (
      <Link
        key={l.href}
        href={l.href}
        className={`side-link${active ? " side-link--active" : ""}`}
      >
        {l.label}
      </Link>
    );
  };
  return (
    <nav className="flex flex-col gap-1">
      {ROOT.map(row)}
      <div className="side-head">Market Research</div>
      {RESEARCH.map(row)}
    </nav>
  );
}

function Wordmark({ className, iconClass }) {
  return (
    <Link
      href="/"
      className={`flex items-center gap-[9px] font-display font-bold text-forest no-underline leading-none ${className}`}
    >
      <MascotMini className={`shrink-0 ${iconClass}`} />
      Matcharap Eto
    </Link>
  );
}

export default function Sidebar() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <>
      {/* Desktop: permanent left rail */}
      <aside className="hidden md:flex md:flex-col fixed left-0 top-0 z-30 w-[216px] h-screen overflow-y-auto border-r-2 border-dashed border-ink bg-cream-light/85 backdrop-blur px-3 py-5">
        <Wordmark className="text-2xl px-2 mb-5" iconClass="w-[34px] h-[34px]" />
        <NavLinks path={path} />
      </aside>

      {/* Mobile: slim top bar with hamburger */}
      <div className="md:hidden sticky top-0 z-40 flex items-center justify-between gap-3 px-3 py-2 border-b-2 border-dashed border-ink bg-cream-light/90 backdrop-blur">
        <Wordmark className="text-xl" iconClass="w-7 h-7" />
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="side-burger"
        >
          ☰
        </button>
      </div>

      {/* Mobile: slide-in drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-[70]">
          <div
            className="absolute inset-0 bg-forest/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-[248px] max-w-[82vw] overflow-y-auto bg-cream-light border-r-2 border-ink shadow-hard px-3 py-5 flex flex-col">
            <div className="flex items-center justify-between mb-5">
              <Wordmark className="text-xl px-1" iconClass="w-7 h-7" />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="side-burger"
              >
                ✕
              </button>
            </div>
            <NavLinks path={path} />
          </aside>
        </div>
      )}
    </>
  );
}
