import net from "net";

export interface SendToPrinterOptions {
  ip: string;
  port?: number;
  data: Buffer;
  timeoutMs?: number;
}

/**
 * Sends ESC/POS byte buffers to a network thermal printer over raw TCP (port 9100).
 * Enforces a strict 2000ms connection & write timeout (NFR-02, ERR-06).
 */
export async function sendToPrinter({
  ip,
  port = 9100,
  data,
  timeoutMs = 2000,
}: SendToPrinterOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const socket = new net.Socket();

    const cleanupAndReject = (err: Error) => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(err);
      }
    };

    const cleanupAndResolve = () => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.on("timeout", () => {
      cleanupAndReject(
        new Error(`Timeout: Không thể kết nối tới máy in qua ${ip}:${port} sau ${timeoutMs}ms`),
      );
    });

    socket.on("error", (err: Error) => {
      cleanupAndReject(err);
    });

    socket.connect(port, ip, () => {
      socket.write(data, (writeErr) => {
        if (writeErr) {
          cleanupAndReject(writeErr);
        } else {
          // Allow printer buffer to flush before closing socket
          socket.end();
        }
      });
    });

    socket.on("close", () => {
      cleanupAndResolve();
    });
  });
}
