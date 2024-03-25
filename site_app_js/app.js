const express = require('express');
const sequelize = require('sequelize');
const mysql = require('mysql2');



const app = express();
const hostname = '127.0.0.1';
const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});