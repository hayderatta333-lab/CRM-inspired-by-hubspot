import { NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/whatsapp/send";

export async function GET() {
  try {
    const result = await sendWhatsAppMessage("923141899043", "CRM se test message! Yeh outbound function kaam kar raha hai.");
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
