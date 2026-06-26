import express from "express";

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.json());

// A curated set of real Unsplash photo URLs. We use direct image URLs (instead of
// the deprecated source.unsplash.com or the API, which needs a key) so this server
// stays dependency-free and works anywhere Docker runs, with no secrets to inject.
const UNSPLASH_IMAGES = [
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb", // landscape
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e", // mountains
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05", // foggy forest
  "https://images.unsplash.com/photo-1447752875215-b2761acb3c5d", // forest path
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e", // sunlit trees
  "https://images.unsplash.com/photo-1518791841217-8f162f1e1131", // cat
  "https://images.unsplash.com/photo-1493246507139-91e8fad9978e", // mountain lake
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff", // valley
  "https://images.unsplash.com/photo-1500534623283-312aade485b7", // beach
  "https://images.unsplash.com/photo-1465146344425-f00d5f5c8f07", // flowers
];

function randomImageUrl() {
  const base = UNSPLASH_IMAGES[Math.floor(Math.random() * UNSPLASH_IMAGES.length)];
  // Ask Unsplash's image CDN for a reasonably sized JPEG.
  return `${base}?auto=format&fit=crop&w=1200&q=80`;
}

// Health/info root.
app.get("/", (_req, res) => {
  res.json({
    name: "docker-sandbox-express",
    status: "ok",
    endpoints: {
      "GET /image": "returns a random Unsplash image URL",
      "POST /": "returns 200 confirming the POST worked",
    },
  });
});

// GET → random Unsplash image URL.
app.get("/image", (_req, res) => {
  res.json({ imageUrl: randomImageUrl() });
});

// POST → confirm it worked.
app.post("/", (req, res) => {
  res.status(200).json({
    ok: true,
    message: "POST received successfully",
    received: req.body ?? null,
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
