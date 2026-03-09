import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="breadcrumb">
        <Link href="/settings">Settings</Link>
        <span>&rsaquo;</span>
        <span>Categories</span>
      </div>
      {children}
    </>
  );
}
