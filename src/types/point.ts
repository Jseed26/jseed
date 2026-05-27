export type PointCategory =
  | "circle"
  | "triangle"
  | "star"
  | "leaf";

export type Point = {
  id: number;

  name: string;

  category: PointCategory;

  coords: [number, number];
};