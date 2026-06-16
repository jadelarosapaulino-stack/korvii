const { existsSync } = require("node:fs");
const { join } = require("node:path");

const requiredFiles = [
  "uploads/default-reports/accident.png",
  "uploads/default-reports/traffic-light-damaged.png",
  "uploads/default-reports/road-damage.png",
  "uploads/default-reports/road-obstruction.png",
  "uploads/default-reports/poor-lighting.png",
  "uploads/default-reports/missing-signage.png",
  "uploads/default-reports/reckless-driving.png",
  "uploads/default-reports/dangerous-crossing.png",
  "uploads/default-reports/flood-zone.png",
  "uploads/default-reports/other.png",
  "uploads/education/casco-ajuste.jpg",
  "uploads/education/casco-checklist.jpg",
  "uploads/education/celular-conduccion-distraida.jpg",
  "uploads/education/celular-no-texting-senal.jpg",
  "uploads/education/seguridad-cinturon.jpg",
  "uploads/education/seguridad-cruce-peatonal.jpg",
];

const missing = requiredFiles.filter((file) => !existsSync(join(process.cwd(), file)));

if (missing.length) {
  console.error(`Missing upload assets:\n${missing.join("\n")}`);
  process.exit(1);
}

console.log(`Upload assets check passed (${requiredFiles.length} files).`);
