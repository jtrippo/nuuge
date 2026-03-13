import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const accessCode = process.env.ACCESS_CODE;

  if (!accessCode) {
    return NextResponse.json({ valid: true });
  }

  return NextResponse.json({ valid: code === accessCode });
}
