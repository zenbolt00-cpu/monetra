import prisma from "./prisma";
import { Role } from "@prisma/client";

export async function logAudit({
  action,
  entity,
  entityId,
  actorId,
  actorName,
  actorRole,
  before,
  after,
  ipAddress,
}: {
  action: string;
  entity: string;
  entityId: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  before?: any;
  after?: any;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        actorId,
        actorName,
        actorRole,
        before: before ? JSON.parse(JSON.stringify(before)) : null,
        after: after ? JSON.parse(JSON.stringify(after)) : null,
        ipAddress,
      },
    });
  } catch (error) {
    console.error("Failed to log audit:", error);
  }
}
