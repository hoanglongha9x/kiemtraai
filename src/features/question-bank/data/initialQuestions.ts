import type {
  QuestionCardData,
} from "@/components/question-bank";

export const initialQuestions: QuestionCardData[] = [
  {
    id: "Q-0001",
    content:
      "Trong Python, từ khóa nào được sử dụng để khai báo một hàm?",
    subject: "Tin học",
    grade: "10",
    topic: "Ngôn ngữ lập trình Python",
    type: "single_choice",
    difficulty: "easy",
    cognitiveLevel: "recognition",
    tags: [
      "python",
      "function",
      "programming",
    ],
    updatedAt: "Hôm nay",
    options: [
      {
        id: "A",
        content: "function",
      },
      {
        id: "B",
        content: "def",
      },
      {
        id: "C",
        content: "func",
      },
      {
        id: "D",
        content: "declare",
      },
    ],
    correctOptionId: "B",
  },
  {
    id: "Q-0002",
    content:
      "Giao thức nào được sử dụng để truyền tải trang web trên Internet?",
    subject: "Tin học",
    grade: "10",
    topic: "Mạng máy tính và Internet",
    type: "single_choice",
    difficulty: "medium",
    cognitiveLevel: "understanding",
    tags: [
      "network",
      "internet",
      "protocol",
    ],
    updatedAt: "Hôm qua",
    options: [
      {
        id: "A",
        content: "FTP",
      },
      {
        id: "B",
        content: "SMTP",
      },
      {
        id: "C",
        content: "HTTP",
      },
      {
        id: "D",
        content: "SSH",
      },
    ],
    correctOptionId: "C",
  },
  {
    id: "Q-0003",
    content:
      "Đánh giá tính đúng hoặc sai của các phát biểu về an toàn thông tin.",
    subject: "Tin học",
    grade: "11",
    topic: "An toàn thông tin",
    type: "true_false_group",
    difficulty: "hard",
    cognitiveLevel: "application",
    tags: [
      "security",
      "true-false",
    ],
    updatedAt: "3 ngày trước",
    statements: [
      {
        id: "A",
        content:
          "Mật khẩu mạnh nên chứa chữ hoa, chữ thường, số và ký tự đặc biệt.",
        correctAnswer: true,
      },
      {
        id: "B",
        content:
          "Có thể sử dụng cùng một mật khẩu cho tất cả các tài khoản.",
        correctAnswer: false,
      },
      {
        id: "C",
        content:
          "Xác thực hai yếu tố giúp tăng mức độ bảo mật.",
        correctAnswer: true,
      },
      {
        id: "D",
        content:
          "Mọi đường dẫn được gửi qua email đều an toàn.",
        correctAnswer: false,
      },
    ],
  },
  {
    id: "Q-0004",
    content:
      "Viết từ khóa Python dùng để khai báo một hàm.",
    subject: "Tin học",
    grade: "10",
    topic: "Ngôn ngữ lập trình Python",
    type: "short_answer",
    difficulty: "easy",
    cognitiveLevel: "high_application",
    tags: [
      "python",
      "function",
      "short-answer",
    ],
    updatedAt: "1 tuần trước",
    acceptedAnswers: [
      "def",
    ],
    caseSensitive: false,
    trimWhitespace: true,
    explanation:
      "Trong Python, từ khóa def được sử dụng để khai báo một hàm.",
  },
];