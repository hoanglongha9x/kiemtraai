export type QuestionImageUploadResult = {
  imageId: string;
  imageUrl: string;
  viewUrl?: string;
  fileName?: string;
};

export type QuestionImageUploadHandler = (
  file: File
) => Promise<QuestionImageUploadResult>;