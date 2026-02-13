export interface SerpDataOrganic {
  type: 'organic';
  position?: number;
  snippet?: string | null;
  displayedLink?: string | null;
  favicon?: string | null;
  thumbnail?: string | null;
  sitelinks?: any | null;
  richSnippet?: any | null;
  aboutThisResult?: any | null;
  cachedPageLink?: string | null;
  relatedPagesLink?: string | null;
}

export interface SerpDataLocal {
  type: 'local';
  position?: number;
  placeId?: string | null;
  dataId?: string | null;
  dataCid?: string | null;
  address?: string | null;
  rating?: number | null;
  reviews?: number | null;
  reviewsOriginal?: string | null;
  priceLevel?: string | null;
  businessType?: string | null;
  types?: string[] | null;
  thumbnail?: string | null;
  serviceOptions?: any | null;
  hours?: string | null;
  operatingHours?: any | null;
  gpsCoordinates?: { latitude: number; longitude: number } | null;
  description?: string | null;
}

export interface SerpDataLinkedin {
  type: 'linkedin';
  position?: number;
  snippet?: string | null;
  linkedinId?: string | null;
}

export type SerpData = SerpDataOrganic | SerpDataLocal | SerpDataLinkedin | any;

export interface Lead {
  id: string;
  company: string;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  whatsappValid: boolean | null;
  source: string;
  searchTerm: string;
  bio?: string | null;
  createdAt: string;
  serpData?: SerpData;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  organic_results: SearchResult[];
  search_metadata: {
    total_results: number;
    next_page_token?: string;
  };
}

export interface AdminSettings {
  serpApiKey: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstance: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalResults: number;
  hasMore: boolean;
  nextPageToken?: string;
}
