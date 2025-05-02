export interface Theme {
  _id: string;
  title: string;
  description?: string;
  slug: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateThemePayload {
  title: string;
  description?: string;
  slug: string;
  isActive?: boolean;
}

export interface UpdateThemePayload {
  title?: string;
  description?: string;
  slug?: string;
  isActive?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface UserResponse {
  user: User;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
  role?: string;
}

export interface SiteConfig {
  _id: string;
  title: string;
  aboutMessage: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UpdateSiteConfigPayload {
  title: string;
  aboutMessage: string;
}

export interface VectorSearchResult {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
  similarity: number;
}

export interface VectorSearchParams {
  queryText: string;
  itemType: "problem" | "solution";
  k?: number;
}

export interface ClusteringParams {
  itemType: "problem" | "solution";
  method?: "kmeans" | "hierarchical";
  params?: {
    // For K-Means and optionally Hierarchical
    n_clusters?: number;
    // Specifically for Hierarchical
    distance_threshold?: number;
    // Linkage method could also be added here if needed
    // linkage?: 'ward' | 'complete' | 'average' | 'single';
  };
}

// Represents a single item with its assigned cluster ID from the clustering API
export interface ClusteredItem {
  id: string; // ID of the item (e.g., problem ID, solution ID)
  cluster: number; // The index of the cluster this item belongs to
  text?: string; // Optional text content of the item (may not be present depending on API)
}

// Define the hierarchical node structure (matches backend enrichment)
export interface HierarchicalClusterNode {
  is_leaf: boolean;
  count: number;
  // For leaf nodes
  id?: string;
  text?: string;
  // For internal nodes
  children?: HierarchicalClusterNode[];
  // Optional: distance if provided by backend
  // distance?: number;
}

// Represents the overall result from the clustering API
export interface ClusteringResult {
  // clusters can now be an array (kmeans) or a single root node object (hierarchical), or null if empty
  clusters: ClusteredItem[] | HierarchicalClusterNode | null;
  message?: string; // Optional message from backend
}

export interface Question {
  _id: string;
  themeId: string;
  questionText: string;
  createdAt: string;
  updatedAt: string;
}

export interface Problem {
  _id: string;
  statement: string;
  themeId: string;
  sourceType: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionWithProblems extends Question {
  relatedProblems?: Problem[];
}

export interface AdminCountResponse {
  adminCount: number;
}
