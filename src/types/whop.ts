// Import WhopCategory from Prisma to ensure consistency
import { WhopCategory as PrismaWhopCategory } from '@prisma/client';

export type WhopCategory = PrismaWhopCategory;

export type PromoType = 'discount' | 'free_trial' | 'exclusive_access' | 'bundle_deal' | 'limited_time' | 'other';

export interface Review {
  id: string;
  username: string;
  rating: number; // 1-5
  text: string;
  date: string;
  verified: boolean;
}

export interface WhopPromo {
  id: string;
  whopName: string;
  promoType: PromoType;
  promoValue: number;
  promoText: string;
  logoUrl: string;
  promoCode?: string;
  affiliateLink: string;
  isActive: boolean;
  reviews?: Review[];
  whopCategory?: WhopCategory;
}

export interface FilterState {
  searchTerm: string;
  promoType: PromoType | '';
  whopCategory: WhopCategory | '';
  whop: string;
  sortBy: 'highest' | 'lowest' | 'alpha-asc' | 'alpha-desc' | 'newest' | 'highest-rated' | '';
}

// Helper function to convert enum values to display labels
export function getCategoryLabel(category: WhopCategory): string {
  const labels: Record<WhopCategory, string> = {
    PERSONAL_DEVELOPMENT: 'Personal Development',
    SOCIAL_MEDIA: 'Social Media',
    LANGUAGES: 'Languages',
    CAREERS: 'Careers',
    GAMING: 'Gaming',
    AI: 'AI',
    TRADING: 'Trading',
    RECREATION: 'Recreation',
    FITNESS: 'Fitness',
    REAL_ESTATE: 'Real Estate',
    TRAVEL: 'Travel',
    SPORTS_BETTING: 'Sports Betting',
    ECOMMERCE: 'E-commerce',
    BUSINESS: 'Business',
    RESELLING: 'Reselling',
    DATING: 'Dating',
    COMPUTER_SCIENCE: 'Computer Science',
    PERSONAL_FINANCE: 'Personal Finance',
    OTHER: 'Other'
  };
  return labels[category];
} 