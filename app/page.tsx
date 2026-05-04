import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { Separator } from "@/components/ui/separator";
import { WhyThisExists } from "@/components/WhyThisExists";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-16 px-6 py-20 sm:py-28">
      <Hero />
      <Separator />
      <HowItWorks />
      <Separator />
      <WhyThisExists />
      <footer className="pt-8 text-xs text-zinc-400">
        Built as a durable-orchestration exploration.{" "}
        <a
          href="https://github.com/Cash-Codes/AI-grocery-agent-snapbasket"
          className="underline hover:text-zinc-600"
        >
          Source on GitHub
        </a>
        .
      </footer>
    </main>
  );
}
