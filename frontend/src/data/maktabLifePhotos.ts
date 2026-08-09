export type MaktabLifePhoto = {
  src: string;
  alt: string;
  caption: string;
  featured?: boolean;
};

export const MAKTAB_LIFE_PHOTOS: MaktabLifePhoto[] = [
  {
    src: '/maktab/class-in-session-1.jpg',
    alt: 'Girls and boys seated in two rows on the musalla during Maktab class, with teachers at the front',
    caption: 'Class in session',
    featured: true,
  },
  {
    src: '/maktab/class-in-session-2.jpg',
    alt: 'Teachers seated with children around the musalla during a Maktab lesson',
    caption: 'Class in session',
    featured: true,
  },
  {
    src: '/maktab/students-boys-line.jpg',
    alt: 'Boys standing in a disciplined line for Maktab assembly',
    caption: 'Boys’ assembly',
  },
  {
    src: '/maktab/students-girls-line.jpg',
    alt: 'Girls standing in line on the prayer rugs at Maktab',
    caption: 'Girls’ assembly',
  },
  {
    src: '/maktab/students-salah-boys.jpg',
    alt: 'Boys practising salah in ruku with their teacher',
    caption: 'Salah practice',
  },
  {
    src: '/maktab/students-salah-girls.jpg',
    alt: 'Girls practising salah postures with their teacher guiding',
    caption: 'Learning salah',
  },
  {
    src: '/maktab/students-with-teacher.jpg',
    alt: 'Girls lined up on the musalla with their teacher at HikmahSphere Maktab',
    caption: 'With the teacher',
  },
  {
    src: '/maktab/students-girls-assembly.jpg',
    alt: 'Girls lined up in the Maktab hall at Taiyeba Masjid',
    caption: 'Our students',
  },
  {
    src: '/maktab/students-boys-row.jpg',
    alt: 'Boys standing in a row on the musalla ready for lesson',
    caption: 'Ready to learn',
  },
];
