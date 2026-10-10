import { Router } from "express";
import { z } from "zod";
import { authenticate, requireStaff } from "../../common/middleware/authenticate";
import { requirePermission } from "../../common/guards/permissions";
import { ok } from "../../common/utils/http";
import { auditContext } from "../audit/audit.service";
import { SETTING_KEYS, type SettingKey } from "./settings.schemas";
import { getSettingRecord, getSettings, updateSetting } from "./settings.service";

export const settingsRouter = Router();
settingsRouter.use(authenticate, requireStaff);

settingsRouter.get("/", requirePermission("settings.read"), async (_req, res) => ok(res, await getSettings()));

const keyParam = z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]) });

settingsRouter.get("/:key", requirePermission("settings.read"), async (req, res) => ok(res, await getSettingRecord(keyParam.parse(req.params).key)));

settingsRouter.put("/:key", requirePermission("settings.write"), async (req, res) => {
  ok(res, await updateSetting(keyParam.parse(req.params).key, req.body, auditContext(req)));
});
