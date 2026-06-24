'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MascotMini } from '@/components/Doodles';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/events', label: 'Events' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/powders', label: 'Powders' },
];

export default function Navbar() {
  const path = usePathname();
  return (
    <nav className="sticky top-0 z-50 flex items-center justify-between gap-3 px-[22px] py-[11px] border-b-2 border-dashed border-ink backdrop-blur bg-cream-light/85 max-md:flex-wrap max-md:justify-center max-md:px-3 max-md:py-[9px]">
      <Link href="/" className="flex items-center gap-[9px] font-display font-bold text-2xl text-forest no-underline leading-none">
        <MascotMini className="w-[34px] h-[34px] shrink-0 max-md:w-7 max-md:h-7" />
        Matcharap Eto
      </Link>
      <div className="flex gap-1.5 flex-wrap">
        {LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={`nav-link${active ? ' nav-link--active' : ''}`}>
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
