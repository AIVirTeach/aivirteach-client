import { demoLearner, type DemoLearner } from "../../../lib/mock-profile";

export async function GET() {
  return Response.json(demoLearner, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const profile = await request.json() as DemoLearner;
  return Response.json(profile, { headers: { "Cache-Control": "no-store" } });
}
