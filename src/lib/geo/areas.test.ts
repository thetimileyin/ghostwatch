import { describe, expect, it } from "vitest";
import { nodeAreas } from "./areas";

describe("nodeAreas", () => {
  it("names areas after the nearest major city and counts their nodes", () => {
    const areas = nodeAreas([
      [50.1, 8.7],
      [50.0, 8.5],
      [48.9, 2.3],
    ]);
    expect(areas[0]).toMatchObject({ name: "Near Frankfurt, DE", count: 2 });
    expect(areas[0].share).toBeCloseTo(2 / 3);
    expect(areas[1].name).toBe("Near Paris, FR");
  });

  it("falls back to a coordinate cell far from any listed city", () => {
    const [a] = nodeAreas([[-60, -120]]);
    expect(a.name).toBe("Around 58°S 118°W");
    expect(a.count).toBe(1);
  });

  it("returns only coordinates and counts", () => {
    const [a] = nodeAreas([[40.7, -74]]);
    expect(Object.keys(a).sort()).toEqual(["count", "lat", "lng", "name", "share"]);
  });
});
