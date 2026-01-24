
export interface BenchmarkDataset {
  id: string;
  title: string;
  source: 'arXiv' | 'Hugging Face' | 'Scholar' | 'Semantic Scholar' | 'Other';
  paperLink: string;
  githubLink?: string;
  description: string;
  itemCount?: string;
  specs?: string;
  year?: string;
  authors?: string[];
  groundingSources?: { uri: string; title: string }[];
}

export interface SearchState {
  isSearching: boolean;
  results: BenchmarkDataset[];
  error?: string;
  progress: number;
  status: string;
}

export type ViewMode = 'grid' | 'list';
