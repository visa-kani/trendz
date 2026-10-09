import { Router } from "express";
import { z } from "zod";
import { authenticate, requireStaff } from "../../common/middleware/authenticate";
import { requirePermission } from "../../common/guards/permissions";
import { ok } from "../../common/utils/http";
import { auditContext } from "../audit/audit.service";
import { SETTING_KEYS, type SettingKey } from "./settings.schemas";
import { getSettings, updateSetting } from "./settings.service";

export const settingsRouter = Router();
settingsRouter.use(authenticate, requireStaff);

settingsRouter.get("/", requirePermission("settings.read"), async (_req, res) => ok(res, await getSettings()));

settingsRouter.put("/:key", requirePermission("settings.write"), async (req, res) => {
  const { key } = z.object({ key: z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]]) }).parse(req.params);
  ok(res, await updateSetting(key, req.body, auditContext(req)));
});
