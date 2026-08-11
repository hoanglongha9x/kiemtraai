import {
  NextResponse,
} from "next/server";

export const runtime =
  "nodejs";

const TEMPLATE_FILE_NAME =
  "kiemtra-ai-mau-nhap-cau-hoi.txt";

const TEMPLATE_CONTENT = `HƯỚNG DẪN NHẬP CÂU HỎI KIEMTRA.AI

Mỗi câu hỏi phải bắt đầu bằng:
Câu 1.
Câu 2.
Câu 3.

Các trường hỗ trợ:
- Môn
- Khối
	- Chủ đề
	- Đơn vị kiến thức
	- Kỹ năng
	- Yêu cầu cần đạt
	- Độ khó: Dễ | Trung bình | Khó
	- Mức độ: Nhận biết | Thông hiểu | Vận dụng | Vận dụng cao
	- Đáp án
	- Giải thích

Không cần thêm dòng Loại, hệ thống tự nhận diện từ cấu trúc câu hỏi.
Không thay đổi các ký hiệu A, B, C, D hoặc a, b, c, d trong câu đúng/sai.

==================================================
MẪU 1: CÂU HỎI TRẮC NGHIỆM
==================================================

Câu 1. Thủ đô của Việt Nam là thành phố nào?
Môn: Địa lý
Khối: 10
	Chủ đề: Địa lý Việt Nam
	Đơn vị kiến thức: Vị trí và phạm vi lãnh thổ Việt Nam
	Kỹ năng: Nhận biết địa danh
	Yêu cầu cần đạt: Xác định được thủ đô của Việt Nam
	Độ khó: Dễ
	Mức độ: Nhận biết
A. Hà Nội
B. Đà Nẵng
C. Huế
D. Thành phố Hồ Chí Minh
	Đáp án: A
	Giải thích: Hà Nội là thủ đô của nước Cộng hòa xã hội chủ nghĩa Việt Nam.

==================================================
MẪU 2: CÂU HỎI ĐÚNG / SAI
==================================================

Câu 2. Xác định tính đúng hoặc sai của các phát biểu sau về máy tính.
Môn: Tin học
Khối: 10
Chủ đề: Phần cứng máy tính
Độ khó: Trung bình
Mức độ: Thông hiểu
a) CPU là bộ xử lý trung tâm của máy tính. Đúng
b) RAM là thiết bị lưu trữ dữ liệu vĩnh viễn. Sai
c) Bàn phím là một thiết bị nhập. Đúng
d) Màn hình là một thiết bị xuất. Đúng

==================================================
MẪU 3: CÂU HỎI TRẢ LỜI NGẮN
==================================================

Câu 3. Kết quả của phép tính 5 + 5 là bao nhiêu?
Môn: Toán
Khối: 10
Chủ đề: Phép tính cơ bản
Độ khó: Dễ
Mức độ: Nhận biết
Đáp án: 10; mười

==================================================
MẪU ĐÚNG / SAI VIẾT ĐÁP ÁN NGAY SAU MỆNH ĐỀ
==================================================

Câu 4. Xác định tính đúng hoặc sai của các phát biểu sau.
Môn: Tin học
Khối: 10
Chủ đề: Thiết bị máy tính
Độ khó: Dễ
Mức độ: Nhận biết
a) Chuột máy tính là một thiết bị nhập. Đúng
b) Máy in là một thiết bị nhập. Sai
c) CPU có chức năng xử lý dữ liệu. Đúng
d) RAM lưu dữ liệu vĩnh viễn khi tắt máy. Sai

==================================================
MẪU 5: CÂU HỎI TOÁN / HÓA CÓ CÔNG THỨC
==================================================

Câu 5. Tính đạo hàm của hàm số \(f(x)=x^2+3x\).
Môn: Toán
Khối: 11
Chủ đề: Đạo hàm
Độ khó: Dễ
Mức độ: Nhận biết
A. \(2x+3\)
B. \(x+3\)
C. \(2x\)
D. \(x^2+3\)
Đáp án: A

Câu 6. Phương trình nào sau đây là phản ứng trung hòa?
Môn: Hóa học
Khối: 10
Chủ đề: Axit - bazơ
Độ khó: Trung bình
Mức độ: Thông hiểu
A. \(\ce{HCl + NaOH -> NaCl + H2O}\)
B. \(\ce{CaCO3 -> CaO + CO2}\)
C. \(\ce{Fe + CuSO4 -> FeSO4 + Cu}\)
D. \(\ce{2H2 + O2 -> 2H2O}\)
Đáp án: A

==================================================
LƯU Ý
==================================================

1. Không sử dụng cùng một số cho nhiều câu hỏi.
2. Câu trắc nghiệm cần có đủ A, B, C, D.
3. Đáp án trắc nghiệm phải là A, B, C hoặc D.
4. Câu đúng/sai nên có đủ bốn mệnh đề a, b, c, d hoặc A, B, C, D.
5. Câu trả lời ngắn có thể có nhiều đáp án, ngăn cách bằng dấu chấm phẩy.
6. Lưu file với mã hóa UTF-8 để không bị lỗi tiếng Việt.
	7. Nên điền đủ Chủ đề, Đơn vị kiến thức, Kỹ năng và Yêu cầu cần đạt để hệ thống phân tích năng lực.
	8. Có thể xóa toàn bộ phần hướng dẫn trước khi tải file lên.
`;

export async function GET() {
  const contentWithBom =
    `\uFEFF${TEMPLATE_CONTENT}`;

  return new NextResponse(
    contentWithBom,
    {
      status: 200,

      headers: {
        "Content-Type":
          "text/plain; charset=utf-8",

        "Content-Disposition":
          `attachment; filename="${TEMPLATE_FILE_NAME}"`,

        "Cache-Control":
          "no-store",
      },
    }
  );
}
