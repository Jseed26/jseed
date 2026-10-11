export type PointCategory =
  | "circle"
  | "triangle"
  | "star"
  | "leaf"
  | "chai";

export type Point = {
  id: number;
  name: string;
  name_en?: string | null;
  category: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  description_en?: string | null;
  address?: string | null;
  website?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  userId?: string | null;
  parentId?: number | null; // 🌟 תוסיפי את השורה הזו!
  createdAt?: string | Date;

  _count?: {
    viewedBy: number;
    savedBy: number;
  };
}