import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';

// Helper tạo slug từ tên danh mục
const generateSlug = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD') // Tách dấu ra khỏi chữ cái
    .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu
    .replace(/[đĐ]/g, 'd')
    .replace(/\s+/g, '-') // Đổi khoảng trắng thành gạch ngang
    .replace(/[^\w\-]+/g, '') // Bỏ các ký tự đặc biệt
    .replace(/\-\-+/g, '-') // Đổi nhiều gạch ngang liên tiếp thành 1 gạch ngang
    .replace(/^-+/, '') // Bỏ gạch ngang ở đầu
    .replace(/-+$/, ''); // Bỏ gạch ngang ở cuối
};

// 1. GET /api/admin/categories - Lấy danh sách danh mục
export const getCategories = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: {
        sortOrder: 'asc',
      },
      include: {
        _count: {
          select: { menuItems: true } // Đếm số món ăn trong mỗi danh mục
        }
      }
    });

    return res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('[Admin Category] Lỗi lấy danh sách:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi lấy danh sách danh mục' });
  }
};

// 2. POST /api/admin/categories - Thêm mới danh mục
export const createCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp tên danh mục' });
    }

    // Tạo slug
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    // Đảm bảo slug là duy nhất
    while (await prisma.category.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    const newCategory = await prisma.category.create({
      data: {
        name,
        slug,
        sortOrder: sortOrder ? Number(sortOrder) : 0,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Thêm danh mục thành công',
      data: newCategory,
    });
  } catch (error) {
    console.error('[Admin Category] Lỗi thêm danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi thêm danh mục' });
  }
};

// 3. PUT /api/admin/categories/:id - Cập nhật danh mục
export const updateCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { name, sortOrder } = req.body;

    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' });
    }

    let updateData: any = {
      sortOrder: sortOrder !== undefined ? Number(sortOrder) : existingCategory.sortOrder,
    };

    // Nếu tên thay đổi, cập nhật name và có thể cập nhật slug
    if (name && name !== existingCategory.name) {
      updateData.name = name;
      let baseSlug = generateSlug(name);
      let slug = baseSlug;
      let counter = 1;

      // Kiểm tra slug mới có bị trùng không (loại trừ chính nó)
      while (await prisma.category.findFirst({ where: { slug, id: { not: id } } })) {
        slug = `${baseSlug}-${counter}`;
        counter++;
      }
      updateData.slug = slug;
    }

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return res.json({
      success: true,
      message: 'Cập nhật danh mục thành công',
      data: updatedCategory,
    });
  } catch (error) {
    console.error('[Admin Category] Lỗi cập nhật danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật danh mục' });
  }
};

// 4. DELETE /api/admin/categories/:id - Xóa danh mục
export const deleteCategory = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;

    const existingCategory = await prisma.category.findUnique({ where: { id } });
    if (!existingCategory) {
      return res.status(404).json({ success: false, message: 'Danh mục không tồn tại' });
    }

    // Kiểm tra xem danh mục có món ăn nào không
    const menuItemsCount = await prisma.menuItem.count({ where: { categoryId: id } });
    if (menuItemsCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Không thể xóa! Danh mục này đang chứa ${menuItemsCount} món ăn. Vui lòng chuyển các món sang danh mục khác trước khi xóa.` 
      });
    }

    await prisma.category.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Đã xóa danh mục thành công.',
    });
  } catch (error) {
    console.error('[Admin Category] Lỗi xóa danh mục:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa danh mục' });
  }
};
