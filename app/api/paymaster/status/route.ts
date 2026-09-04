import { NextResponse } from "next/server";

/** Whether the server holds a Portal key for sponsored submits. */
export async function GET() {
  return NextResponse.json({
    sponsored: Boolean(process.env.PAYMASTER_API_KEY),
  });
}
