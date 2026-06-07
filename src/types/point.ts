//C:\Users\hadar\Desktop\jseed\jseed-web\src\types\point.ts

export type PointCategory =
  | "circle"
  | "triangle"
  | "star"
  | "leaf";

export type Point = {
  id: number;
  name: string;
  category: PointCategory;
  latitude: number;
  longitude: number;
};