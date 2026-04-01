import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { markdownToHtml } from "@/lib/markdown";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Not Found" };

  return {
    title: `${post.title} | OraClaw Blog`,
    description: post.excerpt,
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const html = markdownToHtml(post.content);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
      <Link
        href="/blog"
        className="inline-flex items-center text-sm font-mono text-gray-500 hover:text-claw-400 transition-colors mb-8"
      >
        &larr; Back to blog
      </Link>

      <article>
        <header className="mb-10">
          <time
            dateTime={post.date}
            className="text-sm font-mono text-gray-500"
          >
            {formatDate(post.date)}
          </time>
          <h1 className="text-3xl md:text-4xl font-mono font-bold mt-2 leading-tight">
            {post.title}
          </h1>
        </header>

        <div
          className="blog-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>

      <div className="mt-16 pt-8 border-t border-gray-800">
        <Link
          href="/blog"
          className="inline-flex items-center text-sm font-mono text-claw-500 hover:text-claw-400 transition-colors"
        >
          &larr; All posts
        </Link>
      </div>
    </div>
  );
}
