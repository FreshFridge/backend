const express = require("express");

const app = express();

app.get("/", (req, res) => {
  res.send("FreshFridge API is running");
});

app.listen(3000, () => {
  console.log("Server started on http://localhost:3000");
});