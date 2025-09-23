import type { Database } from './database';

// Database user profile type
export type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
export type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
export type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// Enhanced user type for UI components
export interface EnhancedUser extends UserProfile {
  // Computed properties for better UX
  fullName: string;
  displayName: string;
  hasContract: boolean;
  hasAcceptedTerms: boolean;
  registrationStatus: 'complete' | 'incomplete' | 'pending';
  completionPercentage: number;
}

// Legacy User type for backward compatibility (if needed)
export type User = {
  id: number;
  username: string;
  email: string;
  registered_date: string;
  first_name: string;
  last_name: string;
  billing_first_name: string;
  billing_last_name: string;
  rut: string;
  birth_date: string;
  billing_phone: string;
  instagram: string;
  billing_address_1: string;
  billing_city: string;
  billing_country: string;
  customer_type: string;
  billing_company: string;
  company_rut: string;
  company_city: string;
  company_address: string;
  company_erut: string;
  image_direccion: string;
  image_rut: string;
  image_rut_: string;
  user_signature: string;
  url_user_contrato: string;
  terms_accepted: string;
  pdf_preview_path: string;
};

// User statistics type
export interface UserStats {
  totalUsers: number;
  usersWithContracts: number;
  usersWithTerms: number;
  recentUsers: number;
  contractCompletionRate: string;
  termsAcceptanceRate: string;
}

// API response types
export interface UsersApiResponse {
  success: boolean;
  data: {
    users: UserProfile[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    searchTerm?: string;
  };
  error?: string;
}

export interface UserApiResponse {
  success: boolean;
  data?: UserProfile;
  error?: string;
}