const express = require('express');

const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('Backend is running!');
});

// 👇 PASTE IT HERE
app.get('/install', (req, res) => {
  res.send('Install route coming soon 🚀');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});