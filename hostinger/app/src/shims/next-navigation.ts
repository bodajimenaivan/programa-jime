// Reemplazo de next/navigation para la versión PHP.
import { navigate, refresh, useLocation } from "../router";

const router = {
  push: (href: string) => navigate(href),
  replace: (href: string) => navigate(href, { replace: true }),
  refresh,
  back: () => window.history.back(),
  forward: () => window.history.forward(),
  prefetch: () => {},
};

export function useRouter() {
  return router;
}

export function usePathname() {
  return useLocation().pathname;
}

export function useSearchParams() {
  return useLocation().search;
}

export function redirect(href: string): never {
  navigate(href, { replace: true });
  throw new Error("redirect");
}

export function notFound(): never {
  throw new Error("notFound");
}
