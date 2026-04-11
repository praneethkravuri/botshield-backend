const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

// 👇 PASTE IT HERE
app.get('/install', (req, res) => {
    const shop = req.query.shop;

    res.send(`Installing app for ${shop}... 🚀`);
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
})