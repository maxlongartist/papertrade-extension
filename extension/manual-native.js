import {readAccount} from './account.js';
import { readTicket, readPositions, assertFullPositions } from "./native.js";
export function manualSnapshot(document, market) {
  const owner = readAccount(document,market);
  assertFullPositions(document, { allowPending: true });
  const panel = document.querySelector("#postable.active");
  const rows = [...panel.querySelectorAll('.pt-card[role="listitem"]')];
  const pending = rows.filter((row) =>
    /pending trade$/.test(row.getAttribute("aria-label") ?? ""),
  ).length;
  const positions = readPositions(document);
  if (rows.length !== positions.length + pending)
    throw Error("Some position rows cannot be identified safely.");
  const value = document.querySelector("#acct_avail")?.textContent ?? "";
  const available = Number(value.replace(/[$,\s]/g, ""));
  const price = Number(
    document
      .querySelector("#assetPill .prw.numeric")
      ?.textContent?.replace(/[$,\s]/g, ""),
  );
  return {
    ok: true,
    owner,
    market,
    positions,
    pending,
    available: value.trim() && Number.isFinite(available) ? available : null,
    price: Number.isFinite(price) && price > 0 ? price : null,
    ticket: readTicket(document),
  };
}
