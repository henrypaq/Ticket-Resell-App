"use client";

import Link, { type LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { flushSync } from "react-dom";
import type { AnchorHTMLAttributes } from "react";

/**
 * A next/link that navigates through the browser's native View Transitions
 * API when it's available, instead of an instant swap.
 *
 * No transition library, no global router patch — this only touches
 * navigations that opt in. Where the API isn't supported (Firefox as of this
 * writing) or the user has reduced motion set, it falls through to a plain
 * router.push with zero added cost. The actual transition itself is defined
 * in CSS (globals.css `::view-transition-*`), not here — this component's
 * only job is calling the browser API at the right moment.
 *
 * The callback passed to startViewTransition is synchronous, wrapping
 * router.push in flushSync so React commits before the callback returns. An
 * earlier version returned a Promise resolved via a double
 * requestAnimationFrame guess at "next paint" — that raced React's actual
 * commit on slower (force-dynamic) routes and could leave the promise
 * unsettled, which the browser eventually reports as
 * "View transition update callback timed out." flushSync removes the guess:
 * there's nothing left to wait on, so there's nothing to time out.
 */
export function TransitionLink({
  href,
  children,
  className,
  ...rest
}: LinkProps & AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) {
  const router = useRouter();

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    rest.onClick?.(e);
    if (e.defaultPrevented) return;
    // Let modified clicks (new tab, etc.) behave normally.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    const supportsViewTransitions = typeof document !== "undefined" && "startViewTransition" in document;
    const reducedMotion =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!supportsViewTransitions || reducedMotion) return; // plain Link navigation

    e.preventDefault();
    const url = href.toString();
    try {
      document.startViewTransition(() => {
        flushSync(() => {
          router.push(url);
        });
      });
    } catch {
      // Defensive: never let a transition-API failure block navigation.
      router.push(url);
    }
  }

  return (
    <Link href={href} className={className} {...rest} onClick={onClick}>
      {children}
    </Link>
  );
}
