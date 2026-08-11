import {
  assignmentCodeExists,
} from "./assignmentRepository";

const CODE_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const DEFAULT_CODE_LENGTH =
  6;

function generateRandomCode(
  length =
    DEFAULT_CODE_LENGTH
): string {
  let result =
    "";

  for (
    let index = 0;
    index < length;
    index += 1
  ) {
    const randomIndex =
      Math.floor(
        Math.random() *
          CODE_CHARACTERS.length
      );

    result +=
      CODE_CHARACTERS[
        randomIndex
      ];
  }

  return result;
}

export async function generateUniqueAssignmentCode(): Promise<string> {
  const maximumAttempts =
    20;

  for (
    let attempt = 0;
    attempt < maximumAttempts;
    attempt += 1
  ) {
    const code =
      generateRandomCode();

    const exists =
      await assignmentCodeExists(
        code
      );

    if (!exists) {
      return code;
    }
  }

  throw new Error(
    "Không thể tạo mã bài giao duy nhất."
  );
}