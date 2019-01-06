import { pickDays, removeTime } from "./date-utils";

describe("Picking a range of dates", () => {
  it("Picks a consecutive range of dates when there's no blacklist", () => {
    expect(pickDays(5, [], new Date("2019-01-06T12:34:56.789Z"))).toEqual([
      new Date("2019-01-06T00:00:00.000Z"),
      new Date("2019-01-07T00:00:00.000Z"),
      new Date("2019-01-08T00:00:00.000Z"),
      new Date("2019-01-09T00:00:00.000Z"),
      new Date("2019-01-10T00:00:00.000Z")
    ]);
  });

  it("Skips days on a provided blacklist", () => {
    expect(
      pickDays(
        5,
        [
          new Date("2019-01-07T00:00:00.000Z"),
          new Date("2019-01-09T01:00:00.000Z")
        ],
        new Date("2019-01-06T12:34:56.789Z")
      )
    ).toEqual([
      new Date("2019-01-06T00:00:00.000Z"),
      new Date("2019-01-08T00:00:00.000Z"),
      new Date("2019-01-10T00:00:00.000Z"),
      new Date("2019-01-11T00:00:00.000Z"),
      new Date("2019-01-12T00:00:00.000Z")
    ]);
  });

  it("Returns an empty date range when asked to give no days", () => {
    expect(pickDays(0, [], new Date("2019-01-06T12:34:56.789Z"))).toEqual([]);
  });

  it("Returns an empty date range when asked to give negative days", () => {
    expect(pickDays(-1, [], new Date("2019-01-06T12:34:56.789Z"))).toEqual([]);
  });
});

describe("Zeroing out the time component of a date", () => {
  it("Zeroes out the time to midnight, without affecting the date", () => {
    expect(removeTime(new Date("2019-01-06T12:34:56.789Z"))).toEqual(
      new Date("2019-01-06T00:00:00.000Z")
    );
  });

  it("Returns the correct day when given a date thats already midnight", () => {
    expect(removeTime(new Date("2019-01-06T00:00:00.000Z"))).toEqual(
      new Date("2019-01-06T00:00:00.000Z")
    );
  });

  it("Returns the correct day when given a date thats one milli to midnight", () => {
    expect(removeTime(new Date("2019-01-06T23:29:59.999Z"))).toEqual(
      new Date("2019-01-06T00:00:00.000Z")
    );
  });
});
