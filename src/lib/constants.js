export const SCHEMA_VERSION = 1;
export const DRAFT_STORAGE_KEY = "tmc.menu.draft.v1";
export const IMAGE_DB_NAME = "tmc-menu-images";
export const IMAGE_STORE_NAME = "blobs";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_DATA_IMAGE_CHARS = 160_000;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const INITIAL_VISIBLE_PER_CATEGORY = 8;
export const ADMIN_PAGE_SIZE = 20;
export const SPICE_LEVELS = ["", "none", "mild", "medium", "hot"];
export const OWNER_REVIEW_NOTICE =
  "Catalogue prices and availability are initial suggestions and require owner review before launch.";
export const DRAFT_NOTICE =
  "Save publishes prices and photos to guest phones without rebuilding the site. On this live website, paste a GitHub token once on Dashboard. Photos are compressed to base64 and published with the live menu. On your computer, npm run dev still writes public/data/menu.json and public/images/menu/.";
export const ADMIN_SECURITY_NOTICE =
  "Staff sign-in protects this browser session. It is not a full server login.";
export const RESTAURANT_NAME = "The Maati Cafe & Restaurant";
