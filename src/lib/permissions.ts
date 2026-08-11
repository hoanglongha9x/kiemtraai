import type { Teacher } from '@/types/models';

export function isAdmin(user: Teacher | null | undefined): boolean {
  return !!user && user.role === 'admin' && user.status === 'active';
}

export function isTeacher(user: Teacher | null | undefined): boolean {
  return !!user && user.role === 'teacher' && user.status === 'active';
}

export function assertActiveUser(user: Teacher | null | undefined): asserts user is Teacher {
  if (!user || user.status !== 'active') {
    throw new Error('Bạn chưa đăng nhập hoặc tài khoản đã bị khóa.');
  }
}

export function assertAdmin(user: Teacher | null | undefined): asserts user is Teacher {
  assertActiveUser(user);
  if (user.role !== 'admin') {
    throw new Error('Bạn không có quyền quản trị.');
  }
}

export function canAccessTeacherOwnedData(user: Teacher, ownerTeacherId: string): boolean {
  if (user.role === 'admin') return true;
  return user.teacherId === ownerTeacherId;
}
