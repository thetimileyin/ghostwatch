import Link from "next/link";
import { ArrowLeftIcon } from "./icons";
import { ThemeSwitch } from "./theme-switch";
import { SearchButton } from "./tx-search";
import { Wordmark } from "./wordmark";

/**
 * Slim sticky header for reading pages (stories, journeys, How it works): brand on the
 * left, tools on the right. The way back sits at the top of the page content, under the
 * header, where conventional sites put it.
 */
export function PageHeader({ back }: { back: { href: string; label: string } }) {
  return (
    <>
      <header className="pg-top">
        <div className="pg-frame pg-top-in">
          <Link href="/" className="brand" aria-label="GhostWatch home">
            <Wordmark />
            <span className="wordmark">Ghost<span>Watch</span></span>
          </Link>
          <div className="pg-tools">
            <SearchButton />
            <ThemeSwitch />
          </div>
        </div>
      </header>
      <nav className="pg-frame pg-crumb" aria-label="Back">
        <Link href={back.href} className="pg-back"><ArrowLeftIcon aria-hidden /> {back.label}</Link>
      </nav>
    </>
  );
}
