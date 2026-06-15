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
  createdAt?: string;

  description?: string | null;
  imageUrl?: string | null;
  address?: string | null;
  website?: string | null;
};