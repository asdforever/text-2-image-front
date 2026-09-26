export type PromptCategoryFilter = "all" | "uncategorized" | string;

export interface CategorizedPromptTemplate {
  id: string;
  name: string;
  code: string;
  categoryName?: string | null;
  categoryId?: string | null;
}

export function filterPromptTemplates<T extends CategorizedPromptTemplate>(items: T[], category: PromptCategoryFilter, query: string): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    const categoryMatches = category === "all"
      || (category === "uncategorized" ? !item.categoryId : item.categoryId === category);
    if (!categoryMatches) return false;
    if (!normalizedQuery) return true;
    return `${item.name} ${item.code} ${item.categoryName ?? ""}`.toLowerCase().includes(normalizedQuery);
  });
}

export function countPromptTemplatesByCategory<T extends CategorizedPromptTemplate>(items: T[], filters: PromptCategoryFilter[]): Record<string, number> {
  return Object.fromEntries(filters.map((filter) => [
    filter,
    filter === "all"
      ? items.length
      : filter === "uncategorized"
        ? items.filter((item) => !item.categoryId).length
        : items.filter((item) => item.categoryId === filter).length,
  ]));
}
