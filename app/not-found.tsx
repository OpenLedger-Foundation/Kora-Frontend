import Link from "next/link";
import { FileQuestion, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/back-button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <FileQuestion className="h-8 w-8 text-zinc-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Page not found</h1>
        <p className="max-w-sm text-sm text-zinc-400">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <div className="flex gap-3">
        <BackButton />
        <Button asChild>
          <Link href="/" className="gap-2 inline-flex items-center">
            <Home className="h-3.5 w-3.5" /> Go Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
