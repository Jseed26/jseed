export type PointCategory =
  | "circle"
  | "triangle"
  | "star"
  | "leaf"
  | "chai";

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
  imageUrls?: string[];
  extraInfo: string | null;
  linkClicks: number;
  name_en?: string | null;
  description_en?: string | null;
  extraInfo_en?: string | null;

  _count?: {
    viewedBy: number;
    savedBy: number;
  };
}