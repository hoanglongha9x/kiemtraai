export type TeacherRole =
  | "admin"
  | "teacher";

export type TeacherStatus =
  | "active"
  | "locked";

export type TeacherProfile = {
  uid?: string;
  email: string;
  name: string;
  role: TeacherRole;
  status: TeacherStatus;
  subject?: string;
  schoolId?: string;
  picture?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type TeacherMeSuccessResponse = {
  status: "success";
  teacher: TeacherProfile;
};

export type TeacherNeedsRegistrationResponse =
  {
    status: "needs_registration";
    email: string;
    name?: string;
    picture?: string;
    message: string;
  };

export type TeacherErrorResponse = {
  status: "error";
  message: string;
};

export type TeacherMeResponse =
  | TeacherMeSuccessResponse
  | TeacherNeedsRegistrationResponse
  | TeacherErrorResponse;