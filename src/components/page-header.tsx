import Link from "next/link";
import { ArrowLeftIcon } from "./icons";
import { ThemeSwitch } from "./theme-switch";
import { SearchButton } from "./tx-search";
import { Wordmark } from "./wordmark";

/** Slim sticky header for reading pages (evidence stories, How it works). */
export function PageHeader({ back }: { back: { href: string; label: string } }) {
  return (
    <header className="pg-top">
      <div className="pg-frame pg-top-in">
        <Link href="/" className="brand" aria-label="GhostWatch home">
          <Wordmark />
          <span className="wordmark">Ghost<span>Watch</span></span>
        </Link>
        <Link href={back.href} className="pg-back"><ArrowLeftIcon aria-hidden /> {back.label}</Link>
        <SearchButton />
        <ThemeSwitch />
      </div>
    </header>
  );
}
