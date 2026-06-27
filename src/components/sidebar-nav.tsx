"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/roles";

const linkCls =
  "block rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
const activeCls = "bg-sidebar-accent text-sidebar-accent-foreground";

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = pathname === item.href;
  return (
    <Link href={item.href!} className={`${linkCls} ${active ? activeCls : ""}`}>
      {item.label}
    </Link>
  );
}

function NavGroup({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const children = item.children ?? [];
  const childActive = children.some((c) => c.href === pathname);
  const [open, setOpen] = useState(childActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`${linkCls} flex w-full items-center justify-between`}
      >
        <span>{item.label}</span>
        <span className={`text-xs transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="mt-1 ml-3 flex flex-col gap-1 border-l border-sidebar-border pl-2">
          {children.map((c) => (
            <NavLink key={c.href} item={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ items }: { items: NavItem[] }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {items.map((item) =>
        item.children ? (
          <NavGroup key={item.label} item={item} />
        ) : (
          <NavLink key={item.href} item={item} />
        )
      )}
    </nav>
  );
}
