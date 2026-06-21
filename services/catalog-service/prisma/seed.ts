// Сидирование каталога: 5 категорий и 13 пицц с проверенными фото Unsplash.
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://pizza:pizza@localhost:5432/catalog_db?schema=public';
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// Базовый шаблон URL фотографии Unsplash
function photo(id: string): string {
  return `https://images.unsplash.com/photo-${id}?w=600&q=80&auto=format&fit=crop`;
}

// Описание категории: человекочитаемое имя и порядок сортировки
interface CategorySeed {
  slug: string;
  name: string;
  sortOrder: number;
}

// Описание пиццы: имя, slug категории, цена (в рублях), id фото, состав
interface ProductSeed {
  name: string;
  categorySlug: string;
  price: number;
  photoId: string;
  description: string;
}

// Категории меню в нужном порядке отображения
const categories: CategorySeed[] = [
  { slug: 'meat', name: 'Мясные', sortOrder: 1 },
  { slug: 'cheese', name: 'Сырные', sortOrder: 2 },
  { slug: 'spicy', name: 'Острые', sortOrder: 3 },
  { slug: 'chicken', name: 'С курицей', sortOrder: 4 },
  { slug: 'mushroom', name: 'Грибные', sortOrder: 5 },
];

// Перечень пицц с короткими осмысленными описаниями состава
const products: ProductSeed[] = [
  {
    name: 'Пепперони',
    categorySlug: 'meat',
    price: 700,
    photoId: '1628840042765-356cda07504e',
    description: 'Острая пепперони, моцарелла и томатный соус.',
  },
  {
    name: 'Мясная',
    categorySlug: 'meat',
    price: 700,
    photoId: '1565299624946-b28f40a0ae38',
    description: 'Пепперони, ветчина, бекон, говядина и моцарелла.',
  },
  {
    name: 'Ассорти',
    categorySlug: 'meat',
    price: 700,
    photoId: '1534308983496-4fabb1a015ee',
    description: 'Ветчина, колбаски, бекон, перец и моцарелла.',
  },
  {
    name: 'Барбекю',
    categorySlug: 'meat',
    price: 700,
    photoId: '1590947132387-155cc02f3212',
    description: 'Говядина, бекон, лук и фирменный соус барбекю.',
  },
  {
    name: '4 сыра',
    categorySlug: 'cheese',
    price: 700,
    photoId: '1513104890138-7c749659a591',
    description: 'Моцарелла, пармезан, чеддер и дорблю.',
  },
  {
    name: 'Маргарита',
    categorySlug: 'cheese',
    price: 650,
    photoId: '1574071318508-1cdbab80d002',
    description: 'Моцарелла, томаты, базилик и томатный соус.',
  },
  {
    name: 'Сицилия',
    categorySlug: 'spicy',
    price: 700,
    photoId: '1604382354936-07c5d9983bd3',
    description: 'Острая салями, перец халапеньо и моцарелла.',
  },
  {
    name: 'Дьябло',
    categorySlug: 'spicy',
    price: 750,
    photoId: '1571407970349-bc81e7e96d47',
    description: 'Пепперони, перец чили, халапеньо и острый соус.',
  },
  {
    name: 'Цезарь',
    categorySlug: 'chicken',
    price: 700,
    photoId: '1548369937-47519962c11a',
    description: 'Курица, томаты, салат романо и соус цезарь.',
  },
  {
    name: 'Куриная',
    categorySlug: 'chicken',
    price: 700,
    photoId: '1593560708920-61dd98c46a4e',
    description: 'Курица, грибы, лук, моцарелла и сливочный соус.',
  },
  {
    name: 'Гавайская',
    categorySlug: 'chicken',
    price: 700,
    photoId: '1565958011703-44f9829ba187',
    description: 'Курица, ананасы, моцарелла и томатный соус.',
  },
  {
    name: 'Жульен',
    categorySlug: 'mushroom',
    price: 700,
    photoId: '1576458088443-04a19bb13da6',
    description: 'Шампиньоны, курица, лук и сливочный соус.',
  },
  {
    name: 'Грибная',
    categorySlug: 'mushroom',
    price: 700,
    photoId: '1593504049359-74330189a345',
    description: 'Шампиньоны, моцарелла, лук и томатный соус.',
  },
];

async function main(): Promise<void> {
  // Очищаем товары перед сидом, чтобы избежать дублей при повторном запуске
  await prisma.product.deleteMany();

  // Категории создаём/обновляем по уникальному slug
  const slugToId = new Map<string, string>();
  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: {
        name: category.name,
        slug: category.slug,
        sortOrder: category.sortOrder,
      },
    });
    slugToId.set(category.slug, saved.id);
  }

  // Создаём товары, привязывая их к id соответствующей категории
  let createdCount = 0;
  for (const product of products) {
    const categoryId = slugToId.get(product.categorySlug);
    if (!categoryId) {
      // Защита от опечатки в slug категории
      throw new Error(`Не найдена категория со slug "${product.categorySlug}"`);
    }
    await prisma.product.create({
      data: {
        name: product.name,
        description: product.description,
        price: product.price,
        imageUrl: photo(product.photoId),
        categoryId,
      },
    });
    createdCount += 1;
  }

  console.log(
    `Сид завершён: категорий ${categories.length}, товаров ${createdCount}.`,
  );
}

main()
  .catch((error) => {
    console.error('Ошибка при сидировании каталога:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
