import "reflect-metadata";
import { DataSource } from "typeorm";
import { buildTypeOrmOptions, loadBackendEnv } from "./typeorm-options";

loadBackendEnv();

export default new DataSource(buildTypeOrmOptions());
