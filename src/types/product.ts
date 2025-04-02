export type ProductCategory = {
  id: number;
  name: string;
  slug: string;
  parent?: number;
  description?: string;
  display?: string;
  image?: {
    id: number;
    src: string;
    name?: string;
    alt?: string;
  } | null;
  menu_order?: number;
  count?: number;
};

export type ProductImage = {
  id: number;
  src: string;
  alt: string;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  status: string;
  short_description: string;
  sku: string;
  price: string;
  stock_status: string;
  categories: ProductCategory[];
  images: ProductImage[];
};

export type ProductsApiResponse = {
  success: boolean;
  message: string;
  data: {
    products: Product[];
    total: number;
  };
};

export type CategoriesApiResponse = {
  success: boolean;
  message: string;
  data: {
    categories: ProductCategory[];
    total?: string;
    totalPages?: string;
  };
}; 