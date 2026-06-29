export type GenerateDevelopmentPlansState = {
  status: "idle" | "success" | "error";
  message: string | null;
  generatedTitles: string[];
};

export const initialGenerateDevelopmentPlansState: GenerateDevelopmentPlansState = {
  status: "idle",
  message: null,
  generatedTitles: [],
};
