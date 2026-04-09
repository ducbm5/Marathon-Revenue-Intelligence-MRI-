import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const TOKEN_FILE = path.join(process.cwd(), "token.json");

  // API route to get current token
  app.get("/api/token", async (req, res) => {
    try {
      const data = await fs.readFile(TOKEN_FILE, "utf-8");
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({ error: "Failed to read token" });
    }
  });

  // API route to update token
  app.post("/api/token", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Token is required" });
      
      await fs.writeFile(TOKEN_FILE, JSON.stringify({ token }, null, 2));
      res.json({ success: true, token });
    } catch (error) {
      res.status(500).json({ error: "Failed to update token" });
    }
  });

  // API route to fetch marathon data from Google Sheets TSV
  app.get("/api/marathon-data", async (req, res) => {
    try {
      const url = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2-6kiwov9POZLPZEB7pBY6ced8BJZ8JEhpCg3PuYTY21TxawztC7gnEMQm2hVB3MB1cYXsDtu2UoI/pub?output=tsv";
      const response = await axios.get(url);
      const tsvData = response.data;
      
      // Simple TSV to JSON parser
      const lines = tsvData.split("\n");
      const headers = lines[0].split("\t").map((h: string) => h.trim());
      const result = [];
      
      for (let i = 1; i < lines.length; i++) {
        const currentLine = lines[i].split("\t");
        if (currentLine.length < headers.length) continue;
        
        const obj: any = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = currentLine[j]?.trim();
        }
        result.push(obj);
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching marathon data:", error);
      res.status(500).json({ error: "Failed to fetch data" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
