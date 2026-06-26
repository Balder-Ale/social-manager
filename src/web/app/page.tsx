import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full max-w-3xl flex-col items-center justify-center py-32 px-16 bg-white dark:bg-black gap-8">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <h1 className="text-3xl font-semibold text-black dark:text-zinc-50 text-center">
          Social Manager
        </h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 text-center max-w-md">
          Create, optimize, and publish social media content across multiple platforms.
        </p>
        <nav className="flex flex-col gap-4 w-full max-w-xs">
          <Link
            href="/brand-lab"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-5 text-white font-medium transition-colors hover:bg-indigo-700"
          >
            Brand Lab
          </Link>
          <Link
            href="/post-wizard"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-indigo-600 px-5 text-indigo-600 dark:text-indigo-400 font-medium transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          >
            New Post Wizard
          </Link>
          <Link
            href="/settings"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-300 dark:border-gray-600 px-5 text-gray-600 dark:text-gray-400 font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Settings
          </Link>
        </nav>
      </main>
    </div>
  );
}
