export const MAKTAB_TEACHERS = [
  { slug: 'teacher-1', name: 'Hafiz Faiyaz' },
  { slug: 'teacher-2', name: 'Hafiz Shamshad' },
] as const;

export type MaktabTeacherSlug = (typeof MAKTAB_TEACHERS)[number]['slug'];

export const MAKTAB_TEACHER_SLUGS: readonly string[] = MAKTAB_TEACHERS.map((teacher) => teacher.slug);

export const isMaktabTeacherSlug = (value: string): value is MaktabTeacherSlug =>
  MAKTAB_TEACHER_SLUGS.includes(value);

export const getMaktabTeacherName = (slug: string): string =>
  MAKTAB_TEACHERS.find((teacher) => teacher.slug === slug)?.name ?? slug;
