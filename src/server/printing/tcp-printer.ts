import net from "net";

export interface SendToPrinterOptions {
  ip: string;
  port?: number;
  data: Buffer;
  timeoutMs?: number;
  onSocket?: (socket: net.Socket) => void;
}

/**
 * Sends ESC/POS byte buffers to a network thermal printer over raw TCP.
 * Enforces strict connection & write timeout (default 1500ms).
 * Resolves promptly upon write callback completion and cleans up the client socket (Point 3 & 4).
 */
export async function sendToPrinter({
  ip,
  port = 9100,
  data,
  timeoutMs = 1500,
  onSocket,
}: SendToPrinterOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const socket = new net.Socket();
    if (onSocket) {
      onSocket(socket);
    }

    const timer = setTimeout(() => {
      cleanupAndReject(
        new Error(`Timeout: Không thể kết nối tới máy in qua ${ip}:${port} sau ${timeoutMs}ms`),
      );
    }, timeoutMs);

    const cleanupAndReject = (err: Error) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        reject(err);
      }
    };

    const cleanupAndResolve = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.end();
        if (typeof (socket as any).destroySoon === "function") {
          (socket as any).destroySoon();
        } else {
          socket.destroy();
        }
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
          cleanupAndResolve();
        }
      });
    });
  });
}
