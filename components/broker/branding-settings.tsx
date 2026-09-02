"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

const ERROR_MESSAGES: Record<string, string> = {
  slugTaken: "That URL is already taken by another broker.",
  invalidSlug: "Enter a valid URL slug.",
  invalidColor: "Enter a valid color (e.g. #1a73e8).",
  updateFailed: "Couldn't save your changes. Please try again.",
};

export function BrandingSettings({
  initialSlug,
  initialLogoUrl,
  initialColor,
  publicUrlBase,
}: {
  initialSlug: string;
  initialLogoUrl: string;
  initialColor: string;
  publicUrlBase: string;
}) {
  const router = useRouter();
  const [slug, setSlug] = useState(initialSlug);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [color, setColor] = useState(initialColor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const publicUrl = `${publicUrlBase}/b/${slug || initialSlug}`;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/broker/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, logoUrl, primaryColor: color }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(ERROR_MESSAGES[data.error] ?? "Something went wrong.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your public page</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-2 rounded-md border bg-muted/50 p-2 text-sm">
          <span className="truncate">{publicUrl}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigator.clipboard.writeText(publicUrl)}
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL (optional)</Label>
            <Input
              id="logoUrl"
              type="url"
              placeholder="https://yoursite.ch/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Brand color (optional)</Label>
            <div className="flex items-center gap-2">
              <input
                id="color"
                type="color"
                value={color || "#b91c1c"}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-12 rounded border"
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#b91c1c"
                className="flex-1"
              />
            </div>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {saved && !error && (
            <p className="text-sm text-green-600 dark:text-green-500">
              Saved.
            </p>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
