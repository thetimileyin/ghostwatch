import { TrendDownIcon, TrendUpIcon } from "./icons";

/** 24-hour price change as a chip that sits against the price it describes. */
export function ChangeChip({ change, suffix = "" }: { change: number; suffix?: string }) {
  const up = change >= 0;
  return (
    <span className={`chg ${up ? "chg--up" : "chg--down"}`} title={`${up ? "Up" : "Down"} ${Math.abs(change * 100).toFixed(2)}% over 24 hours`}>
      {up ? <TrendUpIcon aria-hidden /> : <TrendDownIcon aria-hidden />}
      <span className="num">{up ? "+" : "−"}{Math.abs(change * 100).toFixed(2)}%</span>
      {suffix && <span className="chg-s">{suffix}</span>}
    </span>
  );
}
