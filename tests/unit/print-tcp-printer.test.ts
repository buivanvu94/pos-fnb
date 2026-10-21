import { describe, it, expect, afterAll } from "vitest";
import net from "net";
import { sendToPrinter } from "@/server/printing/tcp-printer";

describe("TCP Printer Unit Tests (Point 4)", () => {
  let mockServer: net.Server | undefined;
  const mockPort = 9107;

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    }
  });

  it("succeeds promptly when mock printer does NOT close connection after receiving bytes (Point 4)", async () => {
    let receivedBytes = 0;

    // Start a mock server that intentionally never calls socket.end() or socket.destroy()
    await new Promise<void>((resolve) => {
      mockServer = net.createServer((socket) => {
        socket.on("data", (chunk) => {
          receivedBytes += chunk.length;
          // Intentionally do NOT close or end socket!
        });
      });
      mockServer.listen(mockPort, "127.0.0.1", () => resolve());
    });

    const testPayload = Buffer.from([0x1b, 0x40, 0x1d, 0x56, 0x42, 0x00]);
    const start = performance.now();

    // sendToPrinter must resolve immediately upon write flush without waiting for remote FIN
    await expect(
      sendToPrinter({
        ip: "127.0.0.1",
        port: mockPort,
        data: testPayload,
        timeoutMs: 2000,
      }),
    ).resolves.toBeUndefined();

    const elapsed = performance.now() - start;

    // Must resolve almost instantaneously (< 500ms), NOT hanging for 2000ms timeout
    expect(elapsed).toBeLessThan(500);

    // Allow mock server event loop to receive the chunk
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(receivedBytes).toBe(testPayload.length);
  });
});
