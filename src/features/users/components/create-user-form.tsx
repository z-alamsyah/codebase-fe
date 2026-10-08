"use client";

import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { ApiError, userMessage } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateUser } from "../api/queries";
import {
  createUserSchema,
  emptyCreateUserValues,
  toCreateUserRequest,
  type CreateUserValues,
} from "../schemas/create-user";

const FIELDS: { name: keyof CreateUserValues; label: string; type?: string; placeholder?: string }[] = [
  { name: "name", label: "Name" },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Phone (optional)", placeholder: "+6281234567890" },
  { name: "password", label: "Password", type: "password" },
];

function errorText(errors: unknown[]): string | undefined {
  const first = errors.find(Boolean);
  if (!first) return undefined;
  return typeof first === "string" ? first : (first as { message?: string }).message;
}

export function CreateUserForm({ tenant, onCreated }: { tenant: string; onCreated: (id: string) => void }) {
  const createUser = useCreateUser(tenant);
  const [formError, setFormError] = useState<string>();

  const form = useForm({
    defaultValues: emptyCreateUserValues,
    validators: { onChange: createUserSchema },
    onSubmit: async ({ value, formApi }) => {
      setFormError(undefined);
      try {
        const res = await createUser.mutateAsync({ body: toCreateUserRequest(value) });
        if (res.data) onCreated(res.data.id);
      } catch (e) {
        const err = ApiError.from(e);
        // Show backend validation errors (error.details) next to their fields.
        for (const [field, message] of Object.entries(err.fieldErrors)) {
          if (field in emptyCreateUserValues) {
            formApi.setFieldMeta(field as keyof CreateUserValues, (meta) => ({
              ...meta,
              errorMap: { ...meta.errorMap, onSubmit: message },
            }));
          }
        }
        setFormError(err.code === "CONFLICT" ? err.message : userMessage(err));
      }
    },
  });

  return (
    <form
      noValidate
      className="max-w-lg space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {FIELDS.map((f) => (
        <form.Field key={f.name} name={f.name}>
          {(field) => {
            const error =
              field.state.meta.isTouched || form.state.submissionAttempts > 0
                ? errorText(field.state.meta.errors)
                : undefined;
            const id = `user-${f.name}`;
            return (
              <div className="space-y-1.5">
                <Label htmlFor={id}>{f.label}</Label>
                <Input
                  id={id}
                  name={f.name}
                  type={f.type ?? "text"}
                  placeholder={f.placeholder}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                />
                {error && (
                  <p id={`${id}-error`} className="text-destructive text-sm">
                    {error}
                  </p>
                )}
              </div>
            );
          }}
        </form.Field>
      ))}

      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}

      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating…" : "Create user"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
