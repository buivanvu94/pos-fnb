import { describe, it, expect, afterAll } from "vitest";
import net from "net";
import { sendToPrinter } from "@/server/printing/tcp-printer";

describe("TCP Printer Unit Tests (Point 3 & 4)", () => {
  let mockServer: net.Server | undefined;
  const mockPort = 9107;

  afterAll(async () => {
    if (mockServer) {
      await new Promise<void>((resolve) => mockServer!.close(() => resolve()));
    }
  });

  it("succeeds promptly and cleans up client socket when mock printer does NOT close connection (Point 3 & 4)", async () => {
    let receivedBytes = 0;

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
    let clientSocket: net.Socket | undefined;

    await expect(
      sendToPrinter({
        ip: "127.0.0.1",
        port: mockPort,
        data: testPayload,
        timeoutMs: 2000,
        onSocket: (s) => {
          clientSocket = s;
        },
      }),
    ).resolves.toBeUndefined();

    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);

    // Allow mock server event loop to receive the chunk and client destroySoon to settle
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(receivedBytes).toBe(testPayload.length);

    // Point 3: Client socket must be cleaned up (destroyed) even if server leaves connection open
    expect(clientSocket).toBeDefined();
    expect(clientSocket!.destroyed).toBe(true);
  });

  it("destroys client socket when connection times out (Point 3)", async () => {
    // Unreachable loopback IP on port that drops / doesn't respond
    let clientSocket: net.Socket | undefined;

    const timeoutPromise = sendToPrinter({
      ip: "10.255.255.1", // Non-routable private IP causing timeout
      port: 9100,
      data: Buffer.from([0x00]),
      timeoutMs: 100,
      onSocket: (s) => {
        clientSocket = s;
      },
    });

    await expect(timeoutPromise).rejects.toThrow(/Timeout/);
    expect(clientSocket).toBeDefined();
    expect(clientSocket!.destroyed).toBe(true);
  });
});
