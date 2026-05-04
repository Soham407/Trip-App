export type TabRoute = {
  key: "dashboard" | "lists" | "ledger";
  name: "Dashboard" | "Lists" | "Ledger";
  href: "/" | "/lists" | "/ledger";
  icon: "house" | "list" | "book";
};

export const TAB_ROUTES: TabRoute[] = [
  { key: "dashboard", name: "Dashboard", href: "/", icon: "house" },
  { key: "lists", name: "Lists", href: "/lists", icon: "list" },
  { key: "ledger", name: "Ledger", href: "/ledger", icon: "book" }
];
