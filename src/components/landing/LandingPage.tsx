import { useCallback, useRef } from "react";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Nav } from "@/components/landing/Nav";
import { PrivacyBand } from "@/components/landing/PrivacyBand";
import { ACCEPT_ATTRIBUTE } from "@/lib/media";
import { useStudio } from "@/store/studio";

export function LandingPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const openFile = useStudio((state) => state.openFile);

  const onPick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <>
      <a
        href="#main"
        className="sr-only z-[100] rounded-full bg-paper px-4 py-2 font-semibold text-ink focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <Nav onPick={onPick} />

      <main id="main">
        <Hero onPick={onPick} />
        <HowItWorks />
        <FeatureGrid />
        <PrivacyBand onPick={onPick} />
      </main>

      <Footer onPick={onPick} />

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        aria-label="Choose a video to edit"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void openFile(file);
        }}
      />
    </>
  );
}
