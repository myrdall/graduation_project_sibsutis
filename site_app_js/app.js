const express = require('express');
const sequelize = require('sequelize');
const mysql = require('mysql2');

const { SRV_PORT, SRV_HOST, DB_HOST, DB_USER, DB_PASSWORD, DB_NAME} = require('./config');

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/booking', (req, res) => {
    res.render('booking');
});

app.use((req, res, next) => {
    res.status(404).render('oops');
});

app.listen(SRV_PORT, SRV_HOST, () => {
    console.log(`Server running at http://${SRV_HOST}:${SRV_PORT}/`);
});