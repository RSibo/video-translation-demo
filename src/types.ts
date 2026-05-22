export interface ProcessVideoRequest {
  videoUrl: string;
  language: string;
}

export interface ProcessVideoResponse {
  success: boolean;
  videoTitle: string;
  videoId: string;
  thumbnailUrl: string;
  transcriptSource: "scraped" | "synthetic";
  originalEnglish: string;
  baselineTranslation: string;
  plainTranslation: string;
  expressiveTranslation: string;
}

export interface GenerateTTSRequest {
  text: string;
  voice: string;
  language: string;
}

export interface GenerateTTSResponse {
  success: boolean;
  audioBase64: string;
}

export type TargetLanguage =
  | "English (US Accent)"
  | "English (UK Accent)"
  | "English (Canadian Accent)"
  | "English (Australian Accent)"
  | "English (Indian Accent)"
  | "English (Irish Accent)"
  | "Spanish (Castilian)"
  | "Spanish (Latin American)"
  | "Spanish (Mexican)"
  | "French (European)"
  | "French (Canadian)"
  | "German"
  | "Italian"
  | "Portuguese";

export interface PresetVideo {
  title: string;
  url: string;
  instructor: string;
  type: string;
}
