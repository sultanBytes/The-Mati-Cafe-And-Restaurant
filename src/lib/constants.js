export const SCHEMA_VERSION = 1;
export const DRAFT_STORAGE_KEY = "tmc.menu.draft.v1";
export const IMAGE_DB_NAME = "tmc-menu-images";
export const IMAGE_STORE_NAME = "blobs";
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const INITIAL_VISIBLE_PER_CATEGORY = 8;
export const ADMIN_PAGE_SIZE = 20;
export const SPICE_LEVELS = ["", "none", "mild", "medium", "hot"];
export const OWNER_REVIEW_NOTICE =
  "Catalogue prices and availability are initial suggestions and require owner review before launch.";
export const DRAFT_NOTICE =
  "Save writes this menu into public/data/menu.json while the local server is running. Uploaded photos stay in public/images/menu/ until you change or remove them.";
export const ADMIN_SECURITY_NOTICE =
  "This route is an editing utility on a static site. A hidden URL is not secure authentication.";
