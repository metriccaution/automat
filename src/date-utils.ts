/**
 * Return a new date that is a copy of the passed one, but set to midnight.
 */
export function removeTime(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCHours(0);
  copy.setUTCMinutes(0);
  copy.setUTCSeconds(0);
  copy.setUTCMilliseconds(0);

  return copy;
}

/**
 * Pick a number of days after a given day, skipping out items on a blacklist.
 */
export function pickDays(
  daysToPick: number,
  blacklist: Date[],
  start: Date
): Date[] {
  if (daysToPick <= 0) {
    return [];
  }

  const blacklistTimestamps = blacklist.map(d => removeTime(d).getTime());
  const chosen: Date[] = [];

  let next = removeTime(start).getTime();
  while (chosen.length < daysToPick) {
    if (blacklistTimestamps.indexOf(next) === -1) {
      chosen.push(new Date(next));
    }

    next = next + 1000 * 60 * 60 * 24;
  }

  return chosen;
}
