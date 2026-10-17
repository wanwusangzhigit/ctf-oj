import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Category } from '@/types';

export function listCategories(): Promise<Category[]> {
  return apiGet<Category[]>('/categories');
}

export function createCategory(input: {
  name: string;
  slug: string;
  description?: string;
  sortOrder?: number;
}): Promise<Category> {
  return apiPost<Category>('/categories', input);
}

export function updateCategory(
  id: number,
  input: { name: string; slug: string; description?: string; sortOrder?: number },
): Promise<Category> {
  return apiPut<Category>(`/categories/${id}`, input);
}

export function deleteCategory(id: number): Promise<void> {
  return apiDelete<void>(`/categories/${id}`);
}
