import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog | OraClaw",
  description: "Decision intelligence insights",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogIndex() {
  const posts = getAllPosts();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <div className="mb-12">
        <h1 className="text-3xl md:text-4xl font-mono font-bold mb-3">
          <span className="text-claw-500">&gt;_</span> Blog
        </h1>
        <p className="text-gray-400 font-mono text-sm">
          Decision intelligence insights, benchmarks, and architecture deep-dives.
        </p>
      </div>

      {posts.length === 0 ? (
        <p className="text-gray-500 font-mono">No posts yet. Check back soon.</p>
      ) : (
        <div className="space-y-8">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="block group"
            >
              <article className="p-6 rounded-lg border border-gray-800 bg-gray-900/50 card-hover transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <time
                    dateTime={post.date}
                    className="text-xs font-mono text-gray-500"
                  >
                    {formatDate(post.date)}
                  </time>
                </div>
                <h2 className="text-xl font-mono font-semibold text-white group-hover:text-claw-400 transition-colors mb-2">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed line-clamp-3">
                  {post.excerpt}
                </p>
                <span className="inline-block mt-4 text-sm font-mono text-claw-500 group-hover:text-claw-400 transition-colors">
                  Read more &rarr;
                </span>
              </article>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
