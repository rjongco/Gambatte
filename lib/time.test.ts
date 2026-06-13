import { describe, it, expect } from "vitest";
import { snapTo30, computeScale, minuteToX, xToMinute, formatMinute, formatHour12 } from "./time";

describe("snapTo30", () => {
  it("rounds to the nearest 30-minute mark", () => {
    expect(snapTo30(0)).toBe(0);
    expect(snapTo30(14)).toBe(0);
    expect(snapTo30(15)).toBe(30);
    expect(snapTo30(44)).toBe(30);
    expect(snapTo30(45)).toBe(60);
    expect(snapTo30(490)).toBe(480);
  });
});

describe("computeScale / minuteToX / xToMinute", () => {
  it("fills the cell width across the dayStart..out span", () => {
    // 08:00..24:00 = 960 minutes across 480px => 0.5 px/min
    const ppm = computeScale(480, 480, 1440);
    expect(ppm).toBeCloseTo(0.5);
    expect(minuteToX(480, { dayStart: 480, pxPerMinute: ppm })).toBe(0);
    expect(minuteToX(1440, { dayStart: 480, pxPerMinute: ppm })).toBe(480);
    expect(minuteToX(960, { dayStart: 480, pxPerMinute: ppm })).toBe(240);
  });

  it("inverts minuteToX", () => {
    const ctx = { dayStart: 480, pxPerMinute: computeScale(480, 480, 1440) };
    expect(xToMinute(0, ctx)).toBe(480);
    expect(xToMinute(240, ctx)).toBe(960);
    expect(xToMinute(480, ctx)).toBe(1440);
  });

  it("rescales when out is lowered (a shorter day fills the same width)", () => {
    // 08:00..17:00 = 540 minutes across 480px => wider per minute
    const ppm = computeScale(480, 480, 1020);
    expect(ppm).toBeCloseTo(480 / 540);
    expect(minuteToX(1020, { dayStart: 480, pxPerMinute: ppm })).toBe(480);
  });
});

describe("formatMinute (12-hour)", () => {
  it("formats h:mm AM/PM", () => {
    expect(formatMinute(0)).toBe("12:00 AM");
    expect(formatMinute(90)).toBe("1:30 AM");
    expect(formatMinute(480)).toBe("8:00 AM");
    expect(formatMinute(720)).toBe("12:00 PM");
    expect(formatMinute(780)).toBe("1:00 PM");
    expect(formatMinute(1020)).toBe("5:00 PM");
    expect(formatMinute(1410)).toBe("11:30 PM");
    expect(formatMinute(1440)).toBe("12:00 AM");
  });
});

describe("formatHour12 (compact ruler labels)", () => {
  it("formats whole hours without minutes", () => {
    expect(formatHour12(0)).toBe("12 AM");
    expect(formatHour12(480)).toBe("8 AM");
    expect(formatHour12(720)).toBe("12 PM");
    expect(formatHour12(780)).toBe("1 PM");
    expect(formatHour12(1440)).toBe("12 AM");
  });
});
