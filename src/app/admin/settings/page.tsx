import { requireSuperadminUser } from "@/lib/rbac";
import SettingsClient from "./SettingsClient";

export default async function AdminSettingsPage() {
  await requireSuperadminUser();
  return <SettingsClient />;
}
