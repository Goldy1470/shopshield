import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "@/db/encrypt";

process.env.ENCRYPTION_KEY ??= Buffer.from(
  "unit-test-encryption-key-32-bytes!!!".slice(0, 32),
  "utf8",
).toString("base64");

describe("encrypt/decrypt (AES-256-GCM)", () => {
  it("round-trips", () => {
    const secret = "pat_test_9f8e7d6c5b4a3210 • 中文 ✓";
    const enc = encryptText(secret);
    expect(enc.startsWith("v1.")).toBe(true);
    expect(decryptText(enc)).toBe(secret);
  });

  it("produces a fresh IV per call", () => {
    expect(encryptText("same")).not.toBe(encryptText("same"));
  });

  it("detects tampering", () => {
    const enc = encryptText("trust nothing");
    const parts = enc.split(".");
    const encBytes = Buffer.from(parts[3], "base64");
    encBytes[0] = encBytes[0] ^ 0x01;
    const tampered = ["v1", parts[1], parts[2], encBytes.toString("base64")].join(".");
    expect(() => decryptText(tampered)).toThrow();
  });

  it("rejects malformed envelopes", () => {
    expect(() => decryptText("v2.a.b")).toThrow("Malformed ciphertext envelope");
  });
});
