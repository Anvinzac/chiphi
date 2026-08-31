import { createQuickSignIn } from "@/lib/quickAuth";
import { KITCHEN_EMAIL, KITCHEN_USERNAME } from "@/lib/kitchenAccount";

const KITCHEN_PASSWORD = "MiseKitchen2024!";

/**
 * Kitchen account — restricted to the Orders page. Not a throwaway account, so
 * it is never seeded with demo data and never purge-scrubbed.
 */
export const signInAsKitchen = createQuickSignIn({
  email: KITCHEN_EMAIL,
  password: KITCHEN_PASSWORD,
  username: KITCHEN_USERNAME,
});
