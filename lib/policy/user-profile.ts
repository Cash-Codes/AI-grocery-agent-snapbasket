export interface UserProfile {
  userId: string;
  maxBudgetPence: number;
  allergens: string[];
  dietary: Array<"vegan" | "vegetarian" | "gluten_free" | "halal">;
}

export const DEFAULT_USER_PROFILE: UserProfile = {
  userId: "user_default",
  maxBudgetPence: 10_000, // £100.00
  allergens: ["nuts"],
  dietary: ["vegetarian"],
};

export function getUserProfile(_userId: string): UserProfile {
  return DEFAULT_USER_PROFILE;
}
