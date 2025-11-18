import checks from "./checks.json";
import { PrecheckApp } from "@/components/precheck-app";

export default function Home() {
  return (
    <div className="min-h-screen bg-white px-4 py-12 text-neutral-800">
      <main className="mx-auto flex max-w-5xl justify-center">
        <PrecheckApp checks={checks} />
      </main>
    </div>
  );
}
