export type Rating = { avg: number; count: number };

export type Product = {
  id: number;
  name: string;
  category: string;
  price: number;
  description: string;
  stock: number | null;
  rating: Rating | null;
};
