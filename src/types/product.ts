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
  name: string | null;
  slug: string | null;
  type: string | null;
  status: string | null;
  featured: boolean | null;
  catalog_visibility: string | null;
  description: string | null;
  short_description: string | null;
  sku: string | null;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  on_sale: boolean | null;
  total_sales: number | null;
  sold_individually: boolean | null;
  related_ids: any | null;
  stock_status: string | null;
  brands: string | null;
  dimensions_length: number | null;
  dimensions_width: number | null;
  dimensions_height: number | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string | null;
  primary_term_product_cat: string | null;
  images: any | null;
  categories_ids: any | null;
  categories_name: string | null;
  tags: any | null;
  created_at: string;
  updated_at: string;
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