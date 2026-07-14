import { NextRequest, NextResponse } from "next/server";
import { OpenRouter } from "@openrouter/sdk";

export async function GET(request: NextRequest) {
  //checks if the openRouter key is configured
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENROUTER_API_KEY is not defined" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch models" },
        { status: 502 },
      );
    }

    const data = await res.json(); // { data: Model[] }
    const freeModels = data.data.filter(
      (m: any) => m.pricing.prompt === "0" && m.pricing.completion === "0",
    );

    return NextResponse.json(freeModels);
  } catch (err: any) {
    console.log("an err occurred in openroure api ",err)
    return NextResponse.json({ error:"Could not reach OpenRouter" }, { status: 500 });
  }
}
