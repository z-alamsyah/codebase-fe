"use client";

import { useRouter } from "next/navigation";
import { CreateUserForm } from "@/features/users/components/create-user-form";

export function CreateUserPanel({ tenant }: { tenant: string }) {
  const router = useRouter();
  return <CreateUserForm tenant={tenant} onCreated={(id) => router.push(`/${tenant}/users/${id}`)} />;
}
