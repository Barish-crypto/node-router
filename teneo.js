const WebSocket = require("ws");
const fs = require("fs/promises");

async function readFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return data.split("\n").map(line => line.trim()).filter(line => line);
  } catch (error) {
    console.log(`Error reading ${filePath}: ${error.message}`);
    return [];
  }
}

class WebSocketClient {
  constructor(token, accountIndex) {
    this.token = token;
    this.accountIndex = accountIndex;
    this.socket = null;
    this.pingInterval = null;
    this.reconnectAttempts = 0;
    this.wsUrl = "wss://secure.ws.teneo.pro";
    this.version = "v0.2";
  }

  connect() {
    const wsUrl = `${this.wsUrl}/websocket?accessToken=${encodeURIComponent(this.token)}&version=${encodeURIComponent(this.version)}`;
    const options = { headers: { host: "secure.ws.teneo.pro", origin: "chrome-extension://emcclcoaglgcpoognfiggmhnhgabppkm" } };

    this.socket = new WebSocket(wsUrl, options);

    this.socket.onopen = () => {
      console.log(`[Account ${this.accountIndex + 1}] Connected`);
      this.reconnectAttempts = 0;
      this.startPinging();
    };

    this.socket.onclose = () => {
      this.stopPinging();
      this.reconnect();
    };

    this.socket.onerror = () => {
      // Không xử lý lỗi chi tiết, chỉ reconnect
    };
  }

  reconnect() {
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
      this.stopPinging();
    }
  }

  startPinging() {
    this.stopPinging();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: "PING" }));
      }
    }, 10000); // Ping mỗi 10 giây
  }

  stopPinging() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

async function main() {
  const tokens = await readFile("tokens.txt");
  if (tokens.length === 0) {
    console.log("No tokens found in tokens.txt!");
    return;
  }

  const wsClients = tokens.map((token, i) => {
    const wsClient = new WebSocketClient(token, i);
    wsClient.connect();
    return wsClient;
  });

  process.on("SIGINT", () => {
    console.log("Shutting down...");
    wsClients.forEach(client => client.disconnect());
    process.exit(0);
  });
}

main();