import { apiClient } from "./api/apiClient";
import type { Theme, ThemeWithCounts } from "../types";

export class ThemeService {
  static async getAllThemes(): Promise<ThemeWithCounts[]> {
    const result = await apiClient.getAllThemes();

    if (result.isErr()) {
      throw result.error;
    }

    return result.value as ThemeWithCounts[];
  }

  static async getThemeById(id: string): Promise<ThemeWithCounts> {
    const result = await apiClient.getThemeById(id);

    if (result.isErr()) {
      throw result.error;
    }

    return result.value as ThemeWithCounts;
  }
}
