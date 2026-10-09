import { Navbar } from "@/components/store/navbar";
import { Footer } from "@/components/store/footer";
import { serverGet } from "@/lib/server-api";
import type { CategoryNode } from "@/lib/types";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await serverGet<CategoryNode[]>("/store/categories", 120).catch(() => [] as CategoryNode[]);
  return (
    <>
      <Navbar categories={categories} />
      <main id="main">{children}</main>
      <Footer categories={categories} />
    </>
  );
}
