import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/database/prisma";
import { closeQueues } from "../src/jobs/queues";
import { client, createUser, loginAs, resetDatabase } from "./helpers";

beforeEach(resetDatabase);
afterAll(closeQueues);

describe("authorization", () => {
  it("requires authentication for admin routes", async () => {
    const c = await client();
    const res = await c.get("/api/users").expect(401);
    expect(res.body).toMatchObject({ success: false, code: "UNAUTHENTICATED" });
  });

  it("blocks customers and under-privileged staff", async () => {
    const { client: customer } = await loginAs(["CUSTOMER"]);
    await customer.get("/api/users").expect(403);

    const { client: cashier } = await loginAs(["CASHIER"]);
    await cashier.get("/api/users").expect(403);
    await cashier.get("/api/settings").expect(403);
  });

  it("lets an admin manage staff and records an audit trail", async () => {
    const { client: admin, user: adminUser } = await loginAs(["ADMIN"]);
    const created = await admin
      .post("/api/users")
      .send({ email: "cashier@test.local", firstName: "Ravi", password: "Cashier123", roleCodes: ["CASHIER"] })
      .expect(201);
    expect(created.body.data.roles.map((r: { code: string }) => r.code)).toEqual(["CASHIER"]);

    const id = created.body.data.id;
    await admin.put(`/api/users/${id}/roles`).send({ roleCodes: ["CASHIER", "SUPPORT"] }).expect(200);

    const logs = await prisma.auditLog.findMany({ where: { entityId: id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.action)).toEqual(["user.create", "user.roles.update"]);
    expect(logs[1]!.userId).toBe(adminUser.id);
    expect(logs[1]!.oldValue).toEqual(["CASHIER"]);
  });

  it("only a super admin can grant super admin", async () => {
    const { client: admin } = await loginAs(["ADMIN"]);
    const target = await createUser({ roles: ["SUPPORT"] });
    const res = await admin.put(`/api/users/${target.id}/roles`).send({ roleCodes: ["SUPER_ADMIN"] }).expect(403);
    expect(res.body.code).toBe("FORBIDDEN");
  });

  it("applies role permission changes immediately (cache invalidation)", async () => {
    const { client: support } = await loginAs(["SUPPORT"]);
    await support.get("/api/audit-logs").expect(403);

    const { client: superAdmin } = await loginAs(["SUPER_ADMIN"]);
    const roles = await superAdmin.get("/api/roles").expect(200);
    const supportRole = roles.body.data.find((r: { code: string }) => r.code === "SUPPORT");
    await superAdmin
      .put(`/api/roles/${supportRole.id}`)
      .send({ name: supportRole.name, permissions: [...supportRole.permissions, "audit.read"] })
      .expect(200);

    await support.get("/api/audit-logs").expect(200);
  });

  it("disabling a user signs them out everywhere", async () => {
    const { client: staffClient, user: staff } = await loginAs(["SUPPORT"]);
    await staffClient.get("/api/auth/me").expect(200);
    const { client: admin } = await loginAs(["ADMIN"]);
    await admin.post(`/api/users/${staff.id}/status`).send({ status: "DISABLED" }).expect(200);
    await staffClient.get("/api/auth/me").expect(401);
  });

  it("settings are validated and audited", async () => {
    const { client: admin } = await loginAs(["ADMIN"]);
    const bad = await admin.put("/api/settings/checkout").send({ reservationTtlMinutes: 1 }).expect(400);
    expect(bad.body.code).toBe("VALIDATION_ERROR");
    const good = await admin.put("/api/settings/checkout").send({ reservationTtlMinutes: 20 }).expect(200);
    expect(good.body.data).toMatchObject({ reservationTtlMinutes: 20, allowGuestCheckout: false });
    expect(await prisma.auditLog.count({ where: { action: "settings.update" } })).toBe(1);
  });
});

describe("customer account", () => {
  it("manages addresses and derives the GST state code server-side", async () => {
    const { client: c } = await loginAs(["CUSTOMER"]);
    const res = await c
      .post("/api/account/addresses")
      .send({ fullName: "Asha Rao", phone: "9876501234", line1: "12 MG Road", city: "Bengaluru", state: "Karnataka", postalCode: "560001" })
      .expect(201);
    expect(res.body.data).toMatchObject({ stateCode: "29", isDefaultShipping: true, phone: "+919876501234" });

    const bad = await c
      .post("/api/account/addresses")
      .send({ fullName: "X Y", phone: "9876501234", line1: "Somewhere", city: "Nowhere", state: "Atlantis", postalCode: "12" })
      .expect(400);
    expect(bad.body.errors.map((e: { path: string }) => e.path).sort()).toEqual(["postalCode", "state"]);
  });

  it("cannot read another customer's address", async () => {
    const { client: a } = await loginAs(["CUSTOMER"]);
    const created = await a
      .post("/api/account/addresses")
      .send({ fullName: "Asha Rao", phone: "9876501234", line1: "12 MG Road", city: "Chennai", state: "Tamil Nadu", postalCode: "600001" })
      .expect(201);
    const { client: b } = await loginAs(["CUSTOMER"]);
    await b.delete(`/api/account/addresses/${created.body.data.id}`).expect(404);
  });
});
