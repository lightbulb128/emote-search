export interface EmoteEntry {
  id: string;
  character: string;
  name: string;
  action: string;
  variant: string;
  tags: string[];
  filename: string;
  /** Primary URL — either local (/emotes/...) or absolute R2 URL */
  url: string;
  /** Always-local URL for dev fallback */
  localUrl?: string;
}
