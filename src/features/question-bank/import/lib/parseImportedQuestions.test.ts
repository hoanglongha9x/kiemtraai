import { describe, expect, it } from "vitest";

import { parseImportedQuestions } from "./parseImportedQuestions";

describe("parseImportedQuestions true/false recognition", () => {
  it("removes empty metadata labels from content and normalizes Tin", () => {
    const result = parseImportedQuestions(`
Câu 1. Sau khi tìm hiểu cơ sở dữ liệu, một số học sinh đưa ra ý kiến như sau:
Môn: Tin
Khối: 12
Đơn vị kiến thức:
Kĩ năng:
Yêu cầu cần đạt:
a) Mã hóa đơn xác định duy nhất một hóa đơn. Đúng
b) Mã hàng xác định duy nhất một khách hàng. Sai
c) Số lượng cho biết số hàng trong hóa đơn. Đúng
d) Ngày lập là khóa chính của hóa đơn. Sai
`);

    expect(result.questions).toHaveLength(1);

    const question = result.questions[0].question;
    expect(question.content).toBe(
      "Sau khi tìm hiểu cơ sở dữ liệu, một số học sinh đưa ra ý kiến như sau:"
    );
    expect(question.subject).toBe("Tin học");
    expect(question.knowledgeUnit).toBeUndefined();
    expect(question.skill).toBeUndefined();
    expect(question.learningOutcome).toBeUndefined();
  });

  it("recognizes the explicit Dung/Sai type with a slash", () => {
    const result = parseImportedQuestions(`
Câu 25. Từ tình huống trên, hãy xác định tính đúng sai của các nhận định.
Loại: Đúng/Sai
Môn: Tin học
Khối: 12
a) Thuộc tính href dùng để định dạng màu chữ.
b) Nội dung trong thẻ p không hiển thị nếu thiếu br.
c) target="_blank" mở liên kết trong tab hoặc cửa sổ mới.
d) meta charset="utf-8" hỗ trợ hiển thị Unicode.
Đáp án: a Sai; b Sai; c Đúng; d Đúng
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question.type).toBe("true_false_group");

    const question = result.questions[0].question;
    expect(question.type === "true_false_group" && question.statements).toEqual([
      expect.objectContaining({ id: "A", correctAnswer: false }),
      expect.objectContaining({ id: "B", correctAnswer: false }),
      expect.objectContaining({ id: "C", correctAnswer: true }),
      expect.objectContaining({ id: "D", correctAnswer: true }),
    ]);
  });

  it("merges repeated option labels when the second occurrence is only a boolean answer", () => {
    const result = parseImportedQuestions(`
Câu 26. Một số học sinh đưa ra các quan điểm như sau.
a) Thuộc tính href dùng để định dạng màu chữ.
b) Nội dung trong thẻ p không hiển thị nếu thiếu br.
c) target="_blank" mở liên kết trong tab hoặc cửa sổ mới.
d) meta charset="utf-8" hỗ trợ hiển thị Unicode.
A. Sai
B. Sai
C. Đúng
D. Đúng
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question.type).toBe("true_false_group");
    expect(result.warnings.map((warning) => warning.message)).not.toContain(
      "Phương án A xuất hiện nhiều lần."
    );

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements[0].content).toContain("Thuộc tính href");
    expect(question.statements.map((statement) => statement.correctAnswer)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("keeps a lowercase multiple-choice question as single choice", () => {
    const result = parseImportedQuestions(`
Câu 27. Thẻ HTML nào dùng để tạo liên kết?
a) <p>
b) <a>
c) <h1>
d) <meta>
Đáp án: B
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question.type).toBe("single_choice");
  });

  it("removes image insertion notes from question content", () => {
    const result = parseImportedQuestions(`
Câu 16. Hình vẽ nào sau đây mô tả đúng chiều dòng điện cảm ứng trong khung dây?
[GHI CHÚ: Cần chèn ảnh minh họa - mạch điện với khung dây]
Loại: Trắc nghiệm
Môn: Vật lý
Khối: 12
A. Hình 1
B. Hình 2
C. Hình 3
D. Hình 4
Đáp án: C
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question.content).toBe(
      "Hình vẽ nào sau đây mô tả đúng chiều dòng điện cảm ứng trong khung dây?"
    );
  });

  it("keeps OCR placeholders for formula recovery but reports them as unreadable", () => {
    const result = parseImportedQuestions(`
Câu 4. Động năng tịnh tiến trung bình của phân tử được xác định bằng hệ thức:
Loại: Trắc nghiệm
Môn: Vật lý
Khối: 12
A. .
B. .
C. .
D. .
Đáp án: CHƯA CÓ ĐÁP ÁN
`);

    expect(result.questions).toHaveLength(1);
    expect(
      result.warnings.some((warning) =>
        warning.message.includes(
          "Không nhận diện được nội dung có nghĩa ở phương án A, B, C, D"
        )
      )
    ).toBe(true);
  });

  it("uses section headings as the primary question type", () => {
    const result = parseImportedQuestions(`
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1. Thẻ HTML nào dùng để tạo liên kết?
a) <p>
b) <a>
c) <h1>
d) <meta>
Đáp án: B

PHẦN II. Trắc nghiệm đúng sai. (4.0đ)
Câu 1. Trong mỗi ý, thí sinh chọn Đúng hoặc Sai.
a) href xác định địa chỉ liên kết. Đúng
b) p tạo liên kết. Sai
c) target="_blank" mở trang mới. Đúng
d) meta charset hỗ trợ Unicode. Đúng

PHẦN III. Trả lời ngắn.
Câu 1. HTML là viết tắt của cụm từ nào?
Đáp án: HyperText Markup Language
`);

    expect(result.questions.map((item) => item.question.type)).toEqual([
      "single_choice",
      "true_false_group",
      "short_answer",
    ]);
    expect(result.warnings.map((warning) => warning.message)).not.toContain(
      "Số câu bị trùng trong tài liệu."
    );
  });

  it("keeps the first statement while reading answers from repeated true-false rows", () => {
    const result = parseImportedQuestions(`
PHẦN II. Trắc nghiệm đúng sai.
Câu 25. Một số học sinh đưa ra các quan điểm như sau.
a) Thuộc tính href dùng để định dạng màu chữ.
b) Nội dung thẻ p không hiển thị nếu thiếu br.
c) target="_blank" mở liên kết trong tab hoặc cửa sổ mới.
d) meta charset="utf-8" hỗ trợ Unicode.
A. Thuộc tính href dùng để định dạng màu chữ. Sai
B. Nội dung thẻ p không hiển thị nếu thiếu br. Sai
C. target="_blank" mở liên kết trong tab hoặc cửa sổ mới. Đúng
D. meta charset="utf-8" hỗ trợ Unicode. Đúng
`);

    expect(result.questions).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.message)).not.toContain(
      "Phương án A xuất hiện nhiều lần."
    );

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements.map((statement) => statement.correctAnswer)).toEqual([
      false,
      false,
      true,
      true,
    ]);
    expect(question.statements[0].content).toBe(
      "Thuộc tính href dùng để định dạng màu chữ."
    );
  });

  it("reads a true-false answer list as true statement ids", () => {
    const result = parseImportedQuestions(`
PHẦN II. Trắc nghiệm đúng sai.
Câu 25. Một số học sinh đưa ra các quan điểm như sau.
a) Thuộc tính href dùng để định dạng màu chữ.
b) Nội dung thẻ p không hiển thị nếu thiếu br.
c) target="_blank" mở liên kết trong tab hoặc cửa sổ mới.
d) meta charset="utf-8" hỗ trợ Unicode.
Các mệnh đề đúng: C, D
`);

    expect(result.questions).toHaveLength(1);

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements.map((statement) => statement.correctAnswer)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("uses the section number when a section title is split across lines", () => {
    const result = parseImportedQuestions(`
PHẦN II.
Trắc nghiệm đúng sai. (4.0đ)
Câu 1. Một số học sinh đưa ra các quan điểm như sau.
a) href xác định địa chỉ liên kết. Sai
b) p tạo liên kết. Sai
c) target="_blank" mở trang mới. Đúng
d) meta charset hỗ trợ Unicode. Đúng
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].question.type).toBe("true_false_group");
  });

  it("joins repeated true-false labels caused by PDF line wrapping", () => {
    const result = parseImportedQuestions(`
PHẦN II. Trắc nghiệm đúng sai.
Câu 26. Một số học sinh đưa ra các quan điểm như sau.
a) Thuộc tính href dùng để định dạng màu chữ.
b) Nội dung thẻ p không hiển thị nếu thiếu br.
c) target="_blank" mở liên kết trong tab hoặc cửa sổ mới.
d) Thẻ meta charset="utf-8" giúp trang web hỗ trợ hiển thị Unicode,
d) đảm bảo tương thích với các ngôn ngữ đặc biệt.
Đáp án: C, D
`);

    expect(result.questions).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.message)).not.toContain(
      "Mệnh đề D xuất hiện nhiều lần."
    );

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements[3].content).toContain(
      "đảm bảo tương thích"
    );
    expect(question.statements.map((statement) => statement.correctAnswer)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  it("accepts punctuation after the final true-false answer", () => {
    const result = parseImportedQuestions(`
PHẦN II. Trắc nghiệm đúng sai.
Câu 30. Một số học sinh đưa ra các quan điểm như sau.
a) href dùng để định dạng màu chữ. Sai
b) p tạo liên kết. Sai
c) target="_blank" mở trang mới. Đúng
d) meta charset hỗ trợ Unicode. Đúng.
`);

    expect(result.questions).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.message)).not.toContain(
      "Thiếu đáp án Đúng/Sai cho mệnh đề D."
    );

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements[3].correctAnswer).toBe(true);
    expect(question.statements[3].content).toBe(
      "meta charset hỗ trợ Unicode."
    );
  });

  it("keeps a true-false question when only one statement answer is missing", () => {
    const result = parseImportedQuestions(`
PHẦN II. Trắc nghiệm đúng sai.
Câu 25. Sau đây là một số nhận xét về hệ thống mạng.
a) Các máy tính trong cùng một phòng có thể kết nối với nhau qua mạng LAN thông qua Switch. Đúng
b) Cáp xoắn đôi sẽ hiệu quả hơn khi truyền dữ liệu đi xa so với cáp quang. Sai
c) Để kết nối các mạng LAN ở các phòng với nhau cần phải sử dụng Router. Đúng
d) Các máy tính trong cùng một mạng LAN không nhất thiết phải khác địa chỉ IP với nhau.
`);

    expect(result.questions).toHaveLength(1);
    expect(result.warnings.map((warning) => warning.message)).toContain(
      "Chưa xác định được đáp án Đúng/Sai cho mệnh đề D; cần giáo viên xác nhận trước khi sử dụng."
    );
    expect(result.questions[0].answerSource).toBe("manual_required");
    expect(result.questions[0].needsManualReview).toBe(true);

    const question = result.questions[0].question;
    if (question.type !== "true_false_group") {
      throw new Error("Expected a true/false question");
    }

    expect(question.statements.map((statement) => statement.correctAnswer)).toEqual([
      true,
      false,
      true,
      false,
    ]);
    expect(question.explanation).toContain("Cảnh báo import");
  });

  it("uses a trailing official answer key for all exam sections", () => {
    const result = parseImportedQuestions(`
PHẦN 1. Thí sinh trả lời từ câu 1 đến câu 2. Mỗi câu hỏi thí sinh chỉ chọn một phương án.
Câu 1: Nhóm sinh vật nào có vai trò phân giải chất hữu cơ?
A. Động vật có xương sống.
B. Tảo lam.
C. Vi khuẩn phân giải.
D. Thực vật.
Câu 2: Kiểu cấu tạo xương chi trước tương đồng là bằng chứng tiến hóa nào?
A. Giải phẫu so sánh. B. Hóa thạch. C. Sinh học phân tử. D. Tế bào học.

PHẦN II. Thí sinh trả lời từ câu 1 đến 1. Trong mỗi ý a), b), c), d), thí sinh chọn đúng hoặc sai.
Câu 1: Sau đây là một số nhận xét về hệ sinh thái.
a) Nhận xét thứ nhất.
b) Nhận xét thứ hai.
c) Nhận xét thứ ba.
d) Nhận xét thứ tư.

PHẦN III. Thí sinh trả lời từ câu 1 đến câu 1.
Câu 1: Tính tổng số chromatid của 96 tế bào ở kì giữa.

ĐÁP ÁN
Phần I: Trắc nghiệm nhiều phương án lựa chọn
Câu
1
2
ĐA
C
A
Phần II: Trắc nghiệm đúng sai
Câu
1
Đáp án
SDDD
Phần III: Trả Lời Ngắn
Câu
1
Đáp án
1536
`);

    expect(result.questions).toHaveLength(4);
    expect(result.questions.map((item) => item.question.type)).toEqual([
      "single_choice",
      "single_choice",
      "true_false_group",
      "short_answer",
    ]);

    const firstQuestion = result.questions[0].question;
    const secondQuestion = result.questions[1].question;
    const trueFalseQuestion = result.questions[2].question;
    const shortAnswerQuestion = result.questions[3].question;

    if (
      firstQuestion.type !== "single_choice" ||
      secondQuestion.type !== "single_choice" ||
      trueFalseQuestion.type !== "true_false_group" ||
      shortAnswerQuestion.type !== "short_answer"
    ) {
      throw new Error("Unexpected parsed question types");
    }

    expect(firstQuestion.correctOptionId).toBe("C");
    expect(secondQuestion.correctOptionId).toBe("A");
    expect(secondQuestion.options).toHaveLength(4);
    expect(trueFalseQuestion.statements.map((statement) => statement.correctAnswer)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    expect(shortAnswerQuestion.acceptedAnswers).toEqual(["1536"]);
    expect(result.questions.map((item) => item.answerSource)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ]);
  });

  it("keeps single-choice questions without answers for manual confirmation", () => {
    const result = parseImportedQuestions(`
PHẦN I. Câu trắc nghiệm nhiều phương án lựa chọn.
Câu 1. Chất nào sau đây là khí?
A. Nước.
B. Oxygen.
C. Muối ăn.
D. Đường.
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answerSource).toBe("manual_required");
    expect(result.questions[0].needsManualReview).toBe(true);
    expect(result.warnings.map((warning) => warning.message)).toContain(
      "Chưa xác định được đáp án trắc nghiệm; cần giáo viên xác nhận trước khi sử dụng."
    );
  });

  it("keeps short-answer questions without answers for manual confirmation", () => {
    const result = parseImportedQuestions(`
PHẦN III. Trả lời ngắn.
Câu 1. Có bao nhiêu giá trị nguyên của tham số m thỏa mãn điều kiện đã cho?
`);

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0].answerSource).toBe("manual_required");
    expect(result.questions[0].needsManualReview).toBe(true);

    const question = result.questions[0].question;
    if (question.type !== "short_answer") {
      throw new Error("Expected a short-answer question");
    }

    expect(question.acceptedAnswers).toEqual([]);
  });
});
