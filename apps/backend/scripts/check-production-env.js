const required = [
  "NODE_ENV",
  "FRONTEND_URL",
  "CORS_ORIGINS",
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

const insecureValues = new Set([
  "",
  "change_me_for_production",
  "ruta_segura_pwd",
]);

const missing = required.filter((key) => !process.env[key]);
const insecure = ["JWT_SECRET", "DB_PASSWORD"].filter((key) =>
  insecureValues.has(process.env[key] || ""),
);

if (process.env.NODE_ENV !== "production") {
  console.error("NODE_ENV must be production for this check.");
  process.exitCode = 1;
}

if (missing.length) {
  console.error(`Missing required env vars: ${missing.join(", ")}`);
  process.exitCode = 1;
}

if (insecure.length) {
  console.error(`Replace insecure placeholder values: ${insecure.join(", ")}`);
  process.exitCode = 1;
}

if (process.env.STORAGE_DRIVER === "s3") {
  const s3Required = [
    "STORAGE_S3_BUCKET",
    "STORAGE_S3_ACCESS_KEY_ID",
    "STORAGE_S3_SECRET_ACCESS_KEY",
    "STORAGE_PUBLIC_BASE_URL",
  ];
  const missingS3 = s3Required.filter((key) => !process.env[key]);
  if (missingS3.length) {
    console.error(`Missing S3 storage env vars: ${missingS3.join(", ")}`);
    process.exitCode = 1;
  }
}

if (
  process.env.IMAGE_MODERATION_ENABLED !== "false" &&
  process.env.IMAGE_MODERATION_REQUIRED === "true" &&
  !process.env.OPENAI_API_KEY
) {
  console.error(
    "OPENAI_API_KEY is required when IMAGE_MODERATION_REQUIRED=true.",
  );
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log("Production env check passed.");
}
