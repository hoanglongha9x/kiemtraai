import {
  auth,
} from "@/lib/firebase/client";

import type {
  AssignmentAction,

  AssignmentListItem,

  AssignmentOptions,

  CreateAssignmentInput,
} from "../types";

type ApiSuccessResponse<TData> = {
  status: "success";

  message?: string;

  data?: TData;
};

type ApiErrorResponse = {
  status?: "error";

  message?: string;
};

export type ListAssignmentsResponse = {
  status: "success";

  assignments:
    AssignmentListItem[];
};

export type CreateAssignmentResponse = {
  status: "success";

  count: number;

  assignment:
    AssignmentListItem;

  assignments:
    AssignmentListItem[];

  message: string;
};

export type UpdateAssignmentResponse = {
  status: "success";

  assignment:
    AssignmentListItem;

  message: string;
};

export class AssignmentApiError
  extends Error {
  statusCode: number;

  constructor(
    message: string,
    statusCode = 500
  ) {
    super(message);

    this.name =
      "AssignmentApiError";

    this.statusCode =
      statusCode;
  }
}

async function getAuthToken(): Promise<string> {
  const currentUser =
    auth.currentUser;

  if (!currentUser) {
    throw new AssignmentApiError(
      "Bạn chưa đăng nhập.",
      401
    );
  }

  try {
    return await currentUser.getIdToken();
  } catch {
    throw new AssignmentApiError(
      "Không thể xác thực phiên đăng nhập. Vui lòng đăng nhập lại.",
      401
    );
  }
}

async function parseResponse<TResponse>(
  response: Response
): Promise<TResponse> {
  const responseText =
    await response.text();

  let responseData:
    unknown = null;

  try {
    responseData =
      responseText
        ? JSON.parse(
            responseText
          )
        : null;
  } catch {
    throw new AssignmentApiError(
      `Máy chủ không trả về dữ liệu JSON hợp lệ. Status: ${response.status}.`,
      response.status
    );
  }

  const responseObject =
    responseData &&
    typeof responseData ===
      "object"
      ? responseData as
          Record<
            string,
            unknown
          >
      : null;

  const message =
    typeof responseObject?.message ===
    "string"
      ? responseObject.message
      : "";

  if (
    !response.ok ||
    responseObject?.status ===
      "error"
  ) {
    throw new AssignmentApiError(
      message ||
        "Có lỗi xảy ra khi xử lý giao đề.",
      response.status
    );
  }

  return responseData as
    TResponse;
}

async function assignmentRequest<TResponse>(
  options:
    RequestInit = {}
): Promise<TResponse> {
  const token =
    await getAuthToken();

  let response: Response;

  try {
    response =
      await fetch(
        "/api/teacher/assignments",
        {
          ...options,

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,

            ...(options.headers ??
              {}),
          },
        }
      );
  } catch {
    throw new AssignmentApiError(
      "Không thể kết nối đến máy chủ.",
      0
    );
  }

  return parseResponse<TResponse>(
    response
  );
}

export async function listAssignments(): Promise<
  AssignmentListItem[]
> {
  const response =
    await assignmentRequest<ListAssignmentsResponse>({
      method: "GET",
      cache: "no-store",
    });

  return response.assignments ??
    [];
}

export async function createAssignment(
  input:
    CreateAssignmentInput
): Promise<CreateAssignmentResponse> {
  return assignmentRequest<CreateAssignmentResponse>({
    method: "POST",

    body:
      JSON.stringify(
        input
      ),
  });
}

export type AssignmentOptionsResponse = {
  status: "success";

  tests:
    AssignmentOptions["tests"];

  classes:
    AssignmentOptions["classes"];
};

export async function updateAssignmentStatus(
  assignmentId: string,
  action:
    AssignmentAction
): Promise<UpdateAssignmentResponse> {
  const normalizedAssignmentId =
    assignmentId.trim();

  if (!normalizedAssignmentId) {
    throw new AssignmentApiError(
      "Thiếu mã lượt giao đề.",
      400
    );
  }

  return assignmentRequest<UpdateAssignmentResponse>({
    method: "PATCH",

    body:
      JSON.stringify({
        assignmentId:
          normalizedAssignmentId,

        action,
      }),
  });
}

export async function loadAssignmentOptions(): Promise<AssignmentOptions> {
  const token =
    await getAuthToken();

  let response: Response;

  try {
    response =
      await fetch(
        "/api/teacher/assignments/options",
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );
  } catch {
    throw new AssignmentApiError(
      "Không thể kết nối đến máy chủ.",
      0
    );
  }

  const data =
    await parseResponse<AssignmentOptionsResponse>(
      response
    );

  return {
    tests:
      data.tests ??
      [],

    classes:
      data.classes ??
      [],
  };
}