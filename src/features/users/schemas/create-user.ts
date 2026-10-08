import { z } from "zod";
import type { DtoCreateUserRequest } from "@/lib/api/generated";

/**
 * Mirrors the backend rules (see the Swagger spec: required, minLength,
 * maxLength, format). The backend validates again; its errors are shown per field.
 */
export const createUserSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(100, "At most 100 characters"),
  email: z.email("Must be a valid email address").max(255),
  phone: z.union([z.literal(""), z.e164("Use E.164 format, e.g. +6281234567890")]),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});

export type CreateUserValues = z.infer<typeof createUserSchema>;

export const emptyCreateUserValues: CreateUserValues = { name: "", email: "", phone: "", password: "" };

export function toCreateUserRequest(values: CreateUserValues): DtoCreateUserRequest {
  return {
    name: values.name.trim(),
    email: values.email,
    password: values.password,
    ...(values.phone ? { phone: values.phone } : {}),
  };
}
