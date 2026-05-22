import { db } from '../database';
import { CategoryEntity, Result } from '../models';

export class CategoryRepository {
  // Expose query for useLiveQuery (React equivalent of Flow)
  getAllQuery() {
    return db.categories.orderBy('sortOrder');
  }

  async getAll(): Promise<Result<CategoryEntity[]>> {
    try {
      const data = await db.categories.orderBy('sortOrder').toArray();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  async insert(category: CategoryEntity): Promise<Result<string>> {
    try {
      await db.categories.add(category);
      return { success: true, data: category.id };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }

  async update(id: string, updates: Partial<CategoryEntity>): Promise<Result<void>> {
    try {
      await db.categories.update(id, updates);
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e as Error };
    }
  }
}

export const categoryRepo = new CategoryRepository();
