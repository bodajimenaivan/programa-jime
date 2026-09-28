// Reemplazo de next/link para la versión PHP.
import { forwardRef } from "react";
import { url } from "@/lib/base";
import { navigate } from "../router";

type Props = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string | { pathname?: string; search?: string };
  replace?: boolean;
  prefetch?: boolean | null;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link({ href, replace, prefetch, scroll, onClick, ...rest }, ref) {
  void prefetch;
  void scroll;
  const to = typeof href === "string" ? href : `${href.pathname ?? ""}${href.search ?? ""}`;
  const internal = to.startsWith("/");
  return (
    <a
      ref={ref}
      {...rest}
      href={internal ? url(to) : to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || !internal || rest.target || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(to, { replace });
      }}
    />
  );
});

export default Link;
