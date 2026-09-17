// @ts-nocheck
import cookieParser from "cookie-parser";
import express from "express";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cookieParser());

app.get("/", (req, res) => {
  res.status(200).json({
    True: "OK",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
