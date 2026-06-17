import { Suspense } from "react";
import ScannerClient from "./ScannerClient";

export default function ScannerPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-black text-white p-8">
          Loading scanner...
        </main>
      }
    >
      <ScannerClient />
    </Suspense>
  );
}
