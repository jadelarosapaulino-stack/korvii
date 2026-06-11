import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Institution } from "./institution.entity";

@Injectable()
export class InstitutionsService {
  constructor(
    @InjectRepository(Institution)
    private readonly institutionsRepo: Repository<Institution>,
  ) {}

  async findActive(filters: { province?: string; municipality?: string }) {
    const qb = this.institutionsRepo
      .createQueryBuilder("institution")
      .where("institution.isActive = :isActive", { isActive: true })
      .orderBy("institution.name", "ASC");

    if (filters.province) {
      qb.andWhere(
        "(institution.province IS NULL OR LOWER(institution.province) = LOWER(:province))",
        {
          province: filters.province,
        },
      );
    }

    if (filters.municipality) {
      qb.andWhere(
        "(institution.municipality IS NULL OR LOWER(institution.municipality) = LOWER(:municipality))",
        {
          municipality: filters.municipality,
        },
      );
    }

    const institutions = await qb.getMany();
    return institutions.map((institution) => ({
      id: institution.id,
      name: institution.name,
      type: institution.type,
      province: institution.province,
      municipality: institution.municipality,
      coverageArea: institution.coverageArea,
      phone: institution.phone,
      emergencyPhone: institution.emergencyPhone,
      whatsapp: institution.whatsapp,
      email: institution.email,
      websiteUrl: institution.websiteUrl,
      sourceUrl: institution.sourceUrl,
      address: institution.address,
    }));
  }
}
