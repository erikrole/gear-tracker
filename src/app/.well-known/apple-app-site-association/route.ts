import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json({
    webcredentials: {
      apps: ["T26T3G8C7Q.com.erikrole.Wisconsin"],
    },
  });
}
