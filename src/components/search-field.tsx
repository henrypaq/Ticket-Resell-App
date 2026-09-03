"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloseIcon, SearchIcon } from "./icons";

export function SearchField({ defaultValue = "" }: { defaultValue?: string }) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <div className="pill flex flex-1 items-center gap-3 px-4 py-3">
        <SearchIcon className="h-[19px] w-[19px] shrink-0 text-muted" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Events, artists, venues"
          aria-label="Search events, artists or venues"
          className="w-full bg-transparent text-[16px] text-ink outline-none placeholder:text-muted"
        />
      </div>

      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            router.push("/search");
          }}
          className="pill flex h-[48px] w-[48px] shrink-0 items-center justify-center text-ink"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
    </form>
  );
}
