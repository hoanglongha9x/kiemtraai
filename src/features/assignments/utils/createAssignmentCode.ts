import {
  ASSIGNMENT_CODE_PREFIX,
  ASSIGNMENT_CODE_RANDOM_LENGTH,
} from "../constants";

const CODE_CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function createRandomPart(
  length: number
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

export function createAssignmentCode(): string {
  return [
    ASSIGNMENT_CODE_PREFIX,
    createRandomPart(
      ASSIGNMENT_CODE_RANDOM_LENGTH
    ),
  ].join("-");
}