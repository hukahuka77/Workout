import path from "node:path";
export const mediaDir = () => process.env.MEDIA_DIR || path.join(process.cwd(), "data", "media");
