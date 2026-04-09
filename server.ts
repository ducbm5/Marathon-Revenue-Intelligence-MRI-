import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import fs from "fs/promises";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const AUTH_TOKEN_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT2-6kiwov9POZLPZEB7pBY6ced8BJZ8JEhpCg3PuYTY21TxawztC7gnEMQm2hVB3MB1cYXsDtu2UoI/pub?gid=1000314409&single=true&output=tsv";

  // API route to get current token from Google Sheets
  app.get("/api/token", async (req, res) => {
    try {
      // Add a timestamp to bypass potential caching
      const cacheBuster = `&t=${Date.now()}`;
      const response = await axios.get(AUTH_TOKEN_URL + cacheBuster);
      const tsvData = response.data;
      const lines = tsvData.split("\n");
      
      if (lines.length < 2) {
        return res.status(500).json({ error: "Invalid token data format" });
      }

      const token = lines[1].trim();
      res.json({ token });
    } catch (error) {
      console.error("Error fetching token from Google Sheets:", error);
      res.status(500).json({ error: "Failed to fetch token" });
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
