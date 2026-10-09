import { Prisma } from "@prisma/client";
import { prisma, type Db } from "../../database/prisma";
import { cached, invalidate } from "../../database/redis";
import { audit, type AuditContext } from "../audit/audit.service";
import { settingSchemas, SETTING_KEYS, type SettingKey, type Settings } from "./settings.schemas";

const CACHE_KEY = "settings:all";
const CACHE_TTL_SECONDS = 300;

async function loadAll(db: Db = prisma): Promise<Settings> {
  const rows = await db.setting.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = {} as Record<SettingKey, unknown>;
  for (const key of SETTING_KEYS) {
    // Stored values are merged over defaults, so new fields get sane defaults.
    const parsed = settingSchemas[key].safeParse(byKey.get(key) ?? {});
    out[key] = parsed.success ? parsed.data : settingSchemas[key].parse({});
  }
  return out as Settings;
}

export function getSettings(): Promise<Settings> {
  return cached(CACHE_KEY, CACHE_TTL_SECONDS, () => loadAll());
}

export async function getSetting<K extends SettingKey>(key: K): Promise<Settings[K]> {
  return (await getSettings())[key];
}

/** Uncached read for use inside money/stock transactions. */
export async function getSettingFresh<K extends SettingKey>(db: Db, key: K): Promise<Settings[K]> {
  const row = await db.setting.findUnique({ where: { key } });
  return settingSchemas[key].parse(row?.value ?? {}) as Settings[K];
}

export async function updateSetting<K extends SettingKey>(
  key: K,
  value: unknown,
  ctx: AuditContext,
): Promise<Settings[K]> {
  const parsed = settingSchemas[key].parse(value) as Settings[K];
  await prisma.$transaction(async (tx) => {
    const before = await tx.setting.findUnique({ where: { key } });
    await tx.setting.upsert({
      where: { key },
      create: { key, value: parsed as Prisma.InputJsonValue, updatedById: ctx.userId },
      update: { value: parsed as Prisma.InputJsonValue, updatedById: ctx.userId },
    });
    await audit(tx, ctx, { action: "settings.update", entityType: "setting", entityId: key, oldValue: before?.value, newValue: parsed });
  });
  await invalidate(CACHE_KEY);
  return parsed;
}
