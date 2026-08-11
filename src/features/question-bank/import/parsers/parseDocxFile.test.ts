import {
  describe,
  expect,
  it,
} from "vitest";

import {
  parseDocxDocumentContent,
} from "./parseDocxFile";

import {
  parseImportedQuestions,
} from "../lib/parseImportedQuestions";

describe("parseDocxDocumentContent", () => {
  it("keeps a Word table in document order with basic formatting", () => {
    const documentXml = `
      <w:document xmlns:w="word">
        <w:body>
          <w:p><w:r><w:t>Câu 2. Cho hai đoạn chương trình sau:</w:t></w:r></w:p>
          <w:tbl>
            <w:tblGrid>
              <w:gridCol w:w="4200" />
              <w:gridCol w:w="4200" />
            </w:tblGrid>
            <w:tr>
              <w:tc>
                <w:p><w:r><w:rPr><w:i /></w:rPr><w:t>Python</w:t></w:r></w:p>
              </w:tc>
              <w:tc>
                <w:p><w:r><w:rPr><w:i /></w:rPr><w:t>C++</w:t></w:r></w:p>
              </w:tc>
            </w:tr>
            <w:tr>
              <w:tc><w:p><w:r><w:t>s=0</w:t></w:r></w:p></w:tc>
              <w:tc><w:p><w:r><w:t>s=0;</w:t></w:r></w:p></w:tc>
            </w:tr>
          </w:tbl>
          <w:p><w:r><w:t>Giá trị của s là bao nhiêu?</w:t></w:r></w:p>
          <w:p><w:r><w:t>A. 40</w:t></w:r></w:p>
          <w:p><w:r><w:t>B. 70</w:t></w:r></w:p>
          <w:p><w:r><w:t>C. 5</w:t></w:r></w:p>
          <w:p><w:r><w:t>D. 4</w:t></w:r></w:p>
          <w:p><w:r><w:t>Đáp án: A</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `;

    const parsed =
      parseDocxDocumentContent(
        documentXml
      );

    expect(parsed.assets).toHaveLength(1);
    expect(parsed.rawText).toContain(
      "Câu 2. Cho hai đoạn chương trình sau:\n__KIEMTRA_DOCX_ASSET_0__\nGiá trị của s là bao nhiêu?"
    );

    const asset = parsed.assets[0];
    expect(asset.kind).toBe("table");

    if (asset.kind !== "table") {
      throw new Error("Expected a table asset");
    }

    expect(asset.table.columnWidths).toEqual([
      4200,
      4200,
    ]);
    expect(asset.table.rows).toHaveLength(2);
    expect(asset.table.rows[0].cells).toEqual([
      expect.objectContaining({
        content: "Python",
        italic: true,
      }),
      expect.objectContaining({
        content: "C++",
        italic: true,
      }),
    ]);

    const questions =
      parseImportedQuestions(
        parsed.rawText
      );

    expect(questions.questions).toHaveLength(1);
    expect(
      questions.questions[0].question.content
    ).toContain(
      "__KIEMTRA_DOCX_ASSET_0__"
    );
  });

  it("extracts embedded images and preserves merged table cells", () => {
    const documentXml = `
      <w:document xmlns:w="word" xmlns:r="rels">
        <w:body>
          <w:p><w:r><w:t>Câu 1. Quan sát hình và bảng sau.</w:t></w:r></w:p>
          <w:p>
            <w:r>
              <w:drawing><a:blip r:embed="rId7" /></w:drawing>
            </w:r>
          </w:p>
          <w:tbl>
            <w:tr>
              <w:tc>
                <w:tcPr><w:gridSpan w:val="2" /></w:tcPr>
                <w:p><w:r><w:rPr><w:b /></w:rPr><w:t>Tiêu đề</w:t></w:r></w:p>
              </w:tc>
            </w:tr>
          </w:tbl>
          <w:p><w:r><w:t>A. Một</w:t></w:r></w:p>
          <w:p><w:r><w:t>B. Hai</w:t></w:r></w:p>
          <w:p><w:r><w:t>C. Ba</w:t></w:r></w:p>
          <w:p><w:r><w:t>D. Bốn</w:t></w:r></w:p>
          <w:p><w:r><w:t>Đáp án: B</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `;
    const relationshipsXml = `
      <Relationships>
        <Relationship Id="rId7" Type="image" Target="media/chart.png" />
      </Relationships>
    `;
    const imageBuffer =
      Buffer.from([
        137,
        80,
        78,
        71,
      ]);
    const entries =
      new Map([
        [
          "word/media/chart.png",
          imageBuffer,
        ],
      ]);

    const parsed =
      parseDocxDocumentContent(
        documentXml,
        entries,
        relationshipsXml
      );

    expect(parsed.assets).toHaveLength(2);
    expect(parsed.rawText).toContain(
      "__KIEMTRA_DOCX_ASSET_0__\n__KIEMTRA_DOCX_ASSET_1__"
    );

    const image = parsed.assets[0];
    expect(image.kind).toBe("image");

    if (image.kind !== "image") {
      throw new Error("Expected an image asset");
    }

    expect(image.fileName).toBe("chart.png");
    expect(image.mimeType).toBe("image/png");
    expect(image.buffer).toEqual(imageBuffer);

    const table = parsed.assets[1];
    expect(table.kind).toBe("table");

    if (table.kind !== "table") {
      throw new Error("Expected a table asset");
    }

    expect(table.table.rows[0].cells[0]).toEqual(
      expect.objectContaining({
        content: "Tiêu đề",
        colSpan: 2,
        bold: true,
      })
    );
  });
});
