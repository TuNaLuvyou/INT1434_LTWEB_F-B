import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import prisma from '../config/prisma';
import cloudinary from '../config/cloudinary';

/**
 * Trích xuất public_id từ URL Cloudinary để xóa ảnh
 * Ví dụ: https://res.cloudinary.com/cloud_name/image/upload/v12345678/restoflow/menu-items/abc.jpg -> restoflow/menu-items/abc
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  try {
    const parts = url.split('/image/upload/');
    if (parts.length < 2) return null;
    
    const pathWithVersion = parts[1];
    const pathParts = pathWithVersion.split('/');
    
    // Nếu phần đầu tiên là version (bắt đầu bằng 'v'), loại bỏ nó
    if (pathParts[0].startsWith('v')) {
      pathParts.shift();
    }
    
    const remainingPath = pathParts.join('/');
    
    // Loại bỏ đuôi mở rộng file (.png, .jpg...)
    const dotIndex = remainingPath.lastIndexOf('.');
    if (dotIndex !== -1) {
      return remainingPath.substring(0, dotIndex);
    }
    return remainingPath;
  } catch (error) {
    console.error('[Cloudinary] Lỗi phân tích public_id từ URL:', error);
    return null;
  }
};

// 1. GET /api/admin/menu-items - Lấy danh sách món ăn cho quản lý (bao gồm các món ẩn isActive=false)
export const getAdminMenuItems = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const items = await prisma.menuItem.findMany({
      include: {
        category: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('[Admin Menu CRUD] Lỗi lấy danh sách món:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi truy vấn danh sách món ăn' });
  }
};

// 2. POST /api/admin/menu-items - Thêm mới món ăn
export const createMenuItem = async (req: AuthenticatedRequest, res: Response) => {
  let uploadedImageUrl: string | null = null;
  try {
    const { name, description, price, categoryId, isActive, isSoldOut } = req.body;

    if (!name || !price || !categoryId) {
      // Nếu có ảnh đã tải lên Cloudinary bằng Multer, cần rollback xóa đi
      if (req.file) {
        uploadedImageUrl = req.file.path;
        const publicId = getPublicIdFromUrl(uploadedImageUrl!);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp đầy đủ thông tin: Tên, Giá và Danh mục' });
    }

    // Kiểm tra category tồn tại
    const categoryExists = await prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!categoryExists) {
      if (req.file) {
        uploadedImageUrl = req.file.path;
        const publicId = getPublicIdFromUrl(uploadedImageUrl!);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      return res.status(400).json({ success: false, message: 'Danh mục món ăn không tồn tại' });
    }

    uploadedImageUrl = req.file ? req.file.path : null;

    const newItem = await prisma.menuItem.create({
      data: {
        name,
        description: description || null,
        price: Number(price),
        categoryId,
        imageUrl: uploadedImageUrl,
        isActive: isActive === 'true' || isActive === true,
        isSoldOut: isSoldOut === 'true' || isSoldOut === true,
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Thêm món ăn thành công',
      data: newItem,
    });
  } catch (error) {
    console.error('[Admin Menu CRUD] Lỗi thêm món ăn:', error);
    // Rollback xóa ảnh trên Cloudinary nếu DB lưu thất bại
    if (req.file) {
      const publicId = getPublicIdFromUrl(req.file.path);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log('[Cloudinary] Đã rollback xóa ảnh do lưu DB thất bại:', publicId);
        } catch (delError) {
          console.error('[Cloudinary] Lỗi rollback ảnh:', delError);
        }
      }
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi lưu thông tin món ăn' });
  }
};

// 3. PUT /api/admin/menu-items/:id - Cập nhật món ăn
export const updateMenuItem = async (req: AuthenticatedRequest, res: Response) => {
  let newUploadedImageUrl: string | null = null;
  const id = req.params.id as string;

  try {
    const { name, description, price, categoryId, isActive, isSoldOut } = req.body;

    // Tìm món ăn cũ trong DB
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      if (req.file) {
        const publicId = getPublicIdFromUrl(req.file.path);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
      return res.status(404).json({ success: false, message: 'Món ăn không tồn tại' });
    }

    // Nếu thay đổi categoryId, kiểm tra category mới có tồn tại không
    if (categoryId && categoryId !== existingItem.categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: categoryId },
      });
      if (!categoryExists) {
        if (req.file) {
          const publicId = getPublicIdFromUrl(req.file.path);
          if (publicId) await cloudinary.uploader.destroy(publicId);
        }
        return res.status(400).json({ success: false, message: 'Danh mục món ăn mới không tồn tại' });
      }
    }

    // Xử lý ảnh mới
    let finalImageUrl = existingItem.imageUrl;
    if (req.file) {
      newUploadedImageUrl = req.file.path;
      finalImageUrl = newUploadedImageUrl;

      // Xóa ảnh cũ trên Cloudinary nếu có
      if (existingItem.imageUrl) {
        const oldPublicId = getPublicIdFromUrl(existingItem.imageUrl);
        if (oldPublicId) {
          try {
            await cloudinary.uploader.destroy(oldPublicId);
            console.log('[Cloudinary] Đã xóa ảnh cũ thành công:', oldPublicId);
          } catch (delError) {
            console.error('[Cloudinary] Lỗi khi xóa ảnh cũ trên Cloudinary:', delError);
          }
        }
      }
    }

    const updatedItem = await prisma.menuItem.update({
      where: { id },
      data: {
        name: name !== undefined ? name : existingItem.name,
        description: description !== undefined ? description : existingItem.description,
        price: price !== undefined ? Number(price) : existingItem.price,
        categoryId: categoryId !== undefined ? categoryId : existingItem.categoryId,
        imageUrl: finalImageUrl,
        isActive: isActive !== undefined ? (isActive === 'true' || isActive === true) : existingItem.isActive,
        isSoldOut: isSoldOut !== undefined ? (isSoldOut === 'true' || isSoldOut === true) : existingItem.isSoldOut,
      },
      include: {
        category: {
          select: { name: true },
        },
      },
    });

    return res.json({
      success: true,
      message: 'Cập nhật món ăn thành công',
      data: updatedItem,
    });
  } catch (error) {
    console.error('[Admin Menu CRUD] Lỗi cập nhật món ăn:', error);
    // Rollback xóa ảnh mới tải lên nếu DB cập nhật bị lỗi
    if (req.file) {
      const publicId = getPublicIdFromUrl(req.file.path);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log('[Cloudinary] Đã rollback xóa ảnh mới do cập nhật DB thất bại:', publicId);
        } catch (delError) {
          console.error('[Cloudinary] Lỗi rollback ảnh:', delError);
        }
      }
    }
    return res.status(500).json({ success: false, message: 'Lỗi server khi cập nhật món ăn' });
  }
};

// 4. DELETE /api/admin/menu-items/:id - Xóa món ăn
export const deleteMenuItem = async (req: AuthenticatedRequest, res: Response) => {
  const id = req.params.id as string;

  try {
    const existingItem = await prisma.menuItem.findUnique({
      where: { id },
    });

    if (!existingItem) {
      return res.status(404).json({ success: false, message: 'Món ăn không tồn tại' });
    }

    // 1. Xóa ảnh trên Cloudinary trước
    if (existingItem.imageUrl) {
      const publicId = getPublicIdFromUrl(existingItem.imageUrl);
      if (publicId) {
        try {
          await cloudinary.uploader.destroy(publicId);
          console.log('[Cloudinary] Đã xóa ảnh món ăn trên Cloudinary trước khi xóa DB:', publicId);
        } catch (delError) {
          console.error('[Cloudinary] Lỗi xóa ảnh khi xóa món ăn:', delError);
        }
      }
    }

    // 2. Xóa bản ghi trong DB
    await prisma.menuItem.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Xóa món ăn thành công',
    });
  } catch (error) {
    console.error('[Admin Menu CRUD] Lỗi xóa món ăn:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server khi xóa món ăn. Món ăn này có thể đã được gọi trong hóa đơn của khách.' });
  }
};
