export enum ObjectPermission {
  READ = "read",
  WRITE = "write",
}

export interface ObjectAclPolicy {
  owner: string; // userId
  visibility: "public" | "private";
}

export function canAccessObject({
  userId,
  aclPolicy,
  requestedPermission = ObjectPermission.READ,
}: {
  userId?: string;
  aclPolicy: ObjectAclPolicy;
  requestedPermission?: ObjectPermission;
}): boolean {

  // Public dosyaları herkes okuyabilir
  if (aclPolicy.visibility === "public" && requestedPermission === ObjectPermission.READ) {
    return true;
  }

  // User yoksa erişemez
  if (!userId) return false;

  // Sahibi ise tüm yetkilere sahip
  if (aclPolicy.owner === userId) {
    return true;
  }

  return false;
}
