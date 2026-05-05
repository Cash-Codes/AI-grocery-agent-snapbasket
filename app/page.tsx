import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { WhyThisExists } from "@/components/WhyThisExists";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-24 px-6 pb-24 pt-16 sm:gap-32">
      <Hero />
      <HowItWorks />
      <WhyThisExists />
      <footer
        className="animate-fade-up text-muted-foreground/80 border-border/60 border-t pt-8 text-[12.5px]"
        style={{ ["--stagger" as string]: "150ms" }}
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
          Built as a durable orchestration exploration.
        </span>{" "}
        <a
          href="https://github.com/Cash-Codes/AI-grocery-agent-snapbasket"
          className="text-foreground/90 hover:text-primary underline decoration-dotted underline-offset-4 transition-colors hover:decoration-solid"
        >
          Source on GitHub
        </a>
        .
      </footer>
    </main>
  );
}
