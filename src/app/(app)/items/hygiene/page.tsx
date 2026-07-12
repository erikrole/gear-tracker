import { redirect } from "next/navigation";

// Inventory Hygiene merged into the consolidated Operations page.
export default function InventoryHygienePage() {
  redirect("/operations");
}
