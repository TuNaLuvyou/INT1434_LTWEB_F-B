import prisma from '../config/prisma';

const vietnameseFoodNames: Record<string, string> = {
  'phở': 'Pho',
  'bún': 'Vermicelli',
  'cơm': 'Rice',
  'cháo': 'Porridge',
  'mì': 'Noodles',
  'bánh mì': 'Baguette',
  'bánh': 'Cake',
  'chè': 'Sweet Soup',
  'canh': 'Soup',
  'lẩu': 'Hotpot',
  'nướng': 'Grilled',
  'chiên': 'Fried',
  'xào': 'Stir-fried',
  'hấp': 'Steamed',
  'luộc': 'Boiled',
  'kho': 'Braised',
  'rim': 'Simmered',
  'tráng miệng': 'Dessert',
  'khai vị': 'Appetizer',
  'salad': 'Salad',
  'gỏi': 'Salad',
  'súp': 'Soup',
  'cà phê': 'Coffee',
  'trà': 'Tea',
  'nước ngọt': 'Soft Drink',
  'sinh tố': 'Smoothie',
  'nước ép': 'Juice',
  'bia': 'Beer',
  'rượu vang': 'Wine',
  'rượu': 'Alcohol',
  'thịt bò': 'Beef',
  'thịt heo': 'Pork',
  'thịt gà': 'Chicken',
  'thịt vịt': 'Duck',
  'tôm': 'Shrimp',
  'cua': 'Crab',
  'cá': 'Fish',
  'mực': 'Squid',
  'ốc': 'Snails',
  'hải sản': 'Seafood',
  'rau': 'Vegetables',
  'đậu': 'Tofu/Beans',
  'trứng': 'Egg',
  'phô mai': 'Cheese',
  'sữa': 'Milk',
  'kem': 'Ice Cream',
  'sốt': 'Sauce',
  'tương': 'Sauce',
  'muối': 'Salt',
  'tiêu': 'Pepper',
  'chanh': 'Lemon',
  'ớt': 'Chili',
  'hành': 'Onion',
  'tỏi': 'Garlic',
  'gừng': 'Ginger',
  'sả': 'Lemongrass',
};

export class TranslateService {
  static async toEnglish(text: string): Promise<string | null> {
    if (!text || text.trim().length === 0) return null;

    const trimmed = text.trim();

    try {
      const { default: translate } = await import('translate');
      const result = await translate(trimmed, { from: 'vi', to: 'en' });
      if (result && result !== trimmed) {
        return String(result);
      }
    } catch {
      // fallback to dictionary
    }

    return null;
  }

  static translateWithDictionary(text: string): string | null {
    const lower = text.toLowerCase().trim();
    if (vietnameseFoodNames[lower]) return vietnameseFoodNames[lower];
    for (const [vi, en] of Object.entries(vietnameseFoodNames)) {
      if (lower.includes(vi)) {
        return lower.replace(vi, en.toLowerCase());
      }
    }
    return null;
  }

  static async autoTranslateMenuItem(menuItemId: string): Promise<string | null> {
    const item = await prisma.menuItem.findUnique({
      where: { id: menuItemId },
      select: { name: true, englishName: true },
    });

    if (!item) return null;
    if (item.englishName) return item.englishName;

    const translated = await this.toEnglish(item.name);
    if (translated && translated !== item.name) {
      await prisma.menuItem.update({
        where: { id: menuItemId },
        data: { englishName: translated },
      });
      return translated;
    }

    return null;
  }
}
