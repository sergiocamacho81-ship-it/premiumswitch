"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SubmissionStatus } from "@/lib/submissions";

export function StatusSelect({
  id,
  status,
  endpoint,
}: {
  id: string;
  status: SubmissionStatus;
  endpoint: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(value: string) {
    setPending(true);
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: value }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={pending}>
      <SelectTrigger className="h-8 w-32">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="new">New</SelectItem>
        <SelectItem value="contacted">Contacted</SelectItem>
        <SelectItem value="done">Done</SelectItem>
      </SelectContent>
    </Select>
  );
}
