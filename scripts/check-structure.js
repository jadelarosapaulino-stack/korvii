const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const requiredPaths = [
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'apps/backend/package.json',
  'apps/backend/nest-cli.json',
  'apps/backend/tsconfig.json',
  'apps/backend/src/main.ts',
  'apps/backend/src/app.module.ts',
  'apps/frontend/package.json',
  'apps/frontend/angular.json',
  'apps/frontend/tsconfig.json',
  'apps/frontend/src/main.ts',
  'apps/frontend/src/app/app.component.ts',
  'apps/realtime/package.json',
  'apps/realtime/tsconfig.json',
  'apps/realtime/src/main.ts',
];

const expectedPackages = {
  'apps/backend/package.json': '@ruta-segura/backend',
  'apps/frontend/package.json': '@ruta-segura/frontend',
  'apps/realtime/package.json': '@ruta-segura/realtime',
};

const expectedScripts = {
  'apps/backend/package.json': ['build', 'start:dev', 'lint'],
  'apps/frontend/package.json': ['build', 'start', 'lint'],
  'apps/realtime/package.json': ['build', 'start:dev', 'lint'],
};

const errors = [];

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  } catch (error) {
    errors.push(`${relativePath}: no se pudo leer JSON valido (${error.message})`);
    return null;
  }
}

for (const relativePath of requiredPaths) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`${relativePath}: archivo requerido no encontrado`);
  }
}

const rootPackage = readJson('package.json');
if (rootPackage) {
  for (const scriptName of ['build', 'lint', 'test']) {
    if (!rootPackage.scripts?.[scriptName]) {
      errors.push(`package.json: falta script "${scriptName}"`);
    }
  }
}

for (const [relativePath, expectedName] of Object.entries(expectedPackages)) {
  const packageJson = readJson(relativePath);
  if (!packageJson) continue;

  if (packageJson.name !== expectedName) {
    errors.push(`${relativePath}: name debe ser "${expectedName}"`);
  }

  for (const scriptName of expectedScripts[relativePath]) {
    if (!packageJson.scripts?.[scriptName]) {
      errors.push(`${relativePath}: falta script "${scriptName}"`);
    }
  }
}

if (errors.length > 0) {
  console.error('Estructura invalida del proyecto:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Estructura del proyecto verificada.');
