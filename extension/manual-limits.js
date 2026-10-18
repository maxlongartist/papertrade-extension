export function validateManualTicket(snapshot, venue, now = Date.now()) {
  if (
    !venue ||
    venue.schemaVersion !== 1 ||
    venue.tradingPaused !== false ||
    !Number.isFinite(venue.receivedAt) ||
    now - venue.receivedAt > 60000 ||
    venue.receivedAt > now + 1000
  )
    throw Error("Venue limits unavailable. Wait for the extension connection.");
  const row = venue.instruments?.find((row) => row[1] === snapshot.market);
  if (
    !row ||
    row.length !== 23 ||
    row[4] !== true ||
    row[5] !== false ||
    row.slice(6, 9).some(Boolean)
  )
    throw Error("This market is not available for new entries.");
  if (
    !Number.isInteger(row[14]) ||
    row[14] < 1 ||
    ![venue.minimumTradeSizeRaw, venue.minimumOpenNotionalRaw, row[15]].every(
      (v) =>
        typeof v === "string" &&
        /^\d+$/.test(v) &&
        Number.isFinite(Number(v)) &&
        Number(v) > 0,
    )
  )
    throw Error("Venue limit schema changed.");
  const { margin, leverage } = snapshot.ticket,
    minimum = Number(venue.minimumTradeSizeRaw) / 1e18,
    notional = Number(venue.minimumOpenNotionalRaw) / 1e18;
  if (margin < minimum || margin * leverage < notional)
    throw Error(
      `Each leg needs at least $${minimum} margin and $${notional.toLocaleString()} notional.`,
    );
  if (leverage > row[14] || margin * leverage > Number(row[15]) / 1e18)
    throw Error(
      "Native ticket exceeds the venue’s leverage or notional limit.",
    );
}
