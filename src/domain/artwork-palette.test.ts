import { expect, it } from "vitest";
import { artworkPalette } from "./artwork-palette";
const pixels = (colors: number[][]) => Uint8ClampedArray.from(colors.flatMap(color => [...color, 255]));
it("extracts population-dominant colors rather than averaging opposite hues to grey", () => {
  expect(artworkPalette(pixels([[240, 20, 20], [240, 20, 20], [20, 40, 230]]))).toEqual([[181, 49, 49], [51, 63, 177]]);
});
it("ignores transparent pixels and handles absent/neutral artwork", () => {
  expect(artworkPalette(new Uint8ClampedArray())).toBeNull();
  expect(artworkPalette(new Uint8ClampedArray([255, 0, 0, 0]))).toBeNull();
  expect(artworkPalette(pixels([[130, 130, 130]]))).toEqual([[130, 130, 130], [130, 130, 130]]);
});
it("bounds ambient saturation without inventing colors for monochrome covers", () => {
  const palette = artworkPalette(pixels([[255, 0, 0]]))!;
  expect(Math.max(...palette[0]) - Math.min(...palette[0])).toBeLessThan(160);
  expect(artworkPalette(pixels([[0, 0, 0]]))).toEqual([[0, 0, 0], [0, 0, 0]]);
});

it("finds cover colors past neutral borders without coloring monochrome art", () => {
  const palette = artworkPalette(pixels([...Array.from({ length: 9 }, () => [245, 245, 245]), [20, 40, 230]]))!;
  expect(palette[0][2]).toBeGreaterThan(palette[0][0]);
});
