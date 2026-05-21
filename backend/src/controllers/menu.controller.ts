import { Request, Response } from 'express';
import { MenuService, MenuData } from '../services/menu.service';

interface GetMenuQuery {
  categoryId?: string;
  soldOut?: string;
}

interface SuccessResponse {
  success: true;
  data: MenuData;
}

interface ErrorResponse {
  success: false;
  message: string;
}

export class MenuController {
  /**
   * Handles GET /api/menu request
   */
  static async getMenu(
    req: Request<{}, {}, {}, GetMenuQuery>, 
    res: Response<SuccessResponse | ErrorResponse>
  ): Promise<void> {
    try {
      const { categoryId, soldOut } = req.query;

      // Validate soldOut query param if provided
      if (soldOut !== undefined && soldOut !== 'true' && soldOut !== 'false') {
        res.status(400).json({
          success: false,
          message: 'Invalid soldOut parameter. Must be "true" or "false"'
        });
        return;
      }

      const result = await MenuService.getMenu(categoryId, soldOut);

      // result is null only if categoryId was provided but not found in DB
      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Category not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[MenuController] Error fetching menu:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}
