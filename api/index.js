import { createApp } from "../dist/app.js";

const app = createApp();

export default function handler(req, res) {
  return app(req, res);
}

