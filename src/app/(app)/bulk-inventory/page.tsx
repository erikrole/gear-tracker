import { redirect } from "next/navigation";

export default function BulkInventoryRedirect() {
  redirect("/items");
}
