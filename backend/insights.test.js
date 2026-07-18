import { describe, it, expect } from "vitest";
import {
  average,
  round1,
  computeOverallAverages,
  computeTrend,
  findWeakestDimension
} from "./insights.js";

describe("average", () => {
  it("computes the mean of a numeric field across items", () => {
    const items = [{ score: 2 }, { score: 4 }, { score: 6 }];
    expect(average(items, "score")).toBe(4);
  });
});

describe("round1", () => {
  it("rounds to one decimal place", () => {
    expect(round1(6.666666)).toBe(6.7);
    expect(round1(3)).toBe(3);
    expect(round1(3.04)).toBe(3);
  });
});

describe("computeOverallAverages", () => {
  it("returns a rounded average per score dimension", () => {
    const submissions = [
      { clarity_score: 6, politeness_score: 4, professionalism_score: 8 },
      { clarity_score: 8, politeness_score: 6, professionalism_score: 6 }
    ];
    expect(computeOverallAverages(submissions)).toEqual({
      Clarity: 7,
      Politeness: 5,
      Professionalism: 7
    });
  });
});

describe("findWeakestDimension", () => {
  it("returns the label with the lowest average", () => {
    const overall = { Clarity: 7, Politeness: 4.5, Professionalism: 6 };
    expect(findWeakestDimension(overall)).toBe("Politeness");
  });

  it("breaks ties by taking the first lowest in iteration order", () => {
    const overall = { Clarity: 5, Politeness: 5, Professionalism: 8 };
    expect(findWeakestDimension(overall)).toBe("Clarity");
  });
});

describe("computeTrend", () => {
  it("splits into last-5 vs. everything before it when there are 6+ submissions", () => {
    // 8 submissions: first 3 score low, last 5 score high, so the trend
    // should show a positive delta.
    const submissions = [
      { clarity_score: 2, politeness_score: 2, professionalism_score: 2 },
      { clarity_score: 2, politeness_score: 2, professionalism_score: 2 },
      { clarity_score: 2, politeness_score: 2, professionalism_score: 2 },
      { clarity_score: 8, politeness_score: 8, professionalism_score: 8 },
      { clarity_score: 8, politeness_score: 8, professionalism_score: 8 },
      { clarity_score: 8, politeness_score: 8, professionalism_score: 8 },
      { clarity_score: 8, politeness_score: 8, professionalism_score: 8 },
      { clarity_score: 8, politeness_score: 8, professionalism_score: 8 }
    ];

    const trend = computeTrend(submissions);

    expect(trend.Clarity.recentAvg).toBe(8);
    expect(trend.Clarity.previousAvg).toBe(2);
    expect(trend.Clarity.delta).toBe(6);
  });

  it("splits roughly in half when there are fewer than 6 submissions", () => {
    const submissions = [
      { clarity_score: 4, politeness_score: 4, professionalism_score: 4 },
      { clarity_score: 4, politeness_score: 4, professionalism_score: 4 },
      { clarity_score: 6, politeness_score: 6, professionalism_score: 6 }
    ];

    // total=3 -> recentSize = ceil(3/2) = 2, so recent = last 2, previous = first 1
    const trend = computeTrend(submissions);

    expect(trend.Clarity.previousAvg).toBe(4);
    expect(trend.Clarity.recentAvg).toBe(5);
    expect(trend.Clarity.delta).toBe(1);
  });

  it("returns a null previousAvg and delta when there's nothing to compare against", () => {
    const submissions = [
      { clarity_score: 5, politeness_score: 5, professionalism_score: 5 }
    ];

    const trend = computeTrend(submissions);

    expect(trend.Clarity.previousAvg).toBeNull();
    expect(trend.Clarity.delta).toBeNull();
    expect(trend.Clarity.recentAvg).toBe(5);
  });
});
