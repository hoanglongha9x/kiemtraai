export type QuestionTextBlock = {
  type: "text";
  content: string;
};

export type QuestionTableCell = {
  content: string;
  colSpan?: number;
  rowSpan?: number;
  bold?: boolean;
  italic?: boolean;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "center" | "bottom";
};

export type QuestionTableRow = {
  cells: QuestionTableCell[];
};

export type QuestionTableBlock = {
  type: "table";
  rows: QuestionTableRow[];
  columnWidths?: number[];
};

export type QuestionImageBlock = {
  type: "image";
  imageId?: string;
  imageUrl: string;
  alt?: string;
};

export type QuestionContentBlock =
  | QuestionTextBlock
  | QuestionTableBlock
  | QuestionImageBlock;
