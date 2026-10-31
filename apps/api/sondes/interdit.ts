// @ts-nocheck : sonde volontairement fautive, jamais importée par le Worker.
// Preuve que la garde de build.mjs détecte réellement Next.js.
export { NextResponse } from "next/server";
