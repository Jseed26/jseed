export type PointCategory =
  | "circle"
  | "triangle"
  | "star"
  | "leaf";

export type Point = {
  id: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  description: string | null;
  address: string | null;
  website: string | null;
  imageUrl: string | null;
  extraInfo: string | null; 
  linkClicks: number;
  }