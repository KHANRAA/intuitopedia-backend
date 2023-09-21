const mongoose = require('mongoose');
const winston = require('winston');
const chalk = require('chalk');

module.exports = () => {
    mongoose.connect(`${process.env.MONGO_DB_CONNECTION_STRING}`)
        .then(() => console.log(chalk.cyan('Connected to mongodb...')))
        .catch((err) =>
            console.log(chalk.red(err)));
};
